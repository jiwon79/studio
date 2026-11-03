import * as THREE from 'three';
import GUI from 'lil-gui';
import { createStepper } from '../../common/stepper';
import { PROCESS_STEPS, isProcessStage, processView, type ProcessStage } from './process';
import { PathDebug } from './path-debug';
import { PondDepthPass } from './depth-pass';
import { DepthMotion } from './depth';
import { SpineDebug } from './spine-debug';
import { createSchool, MAX_FISH, MAX_SCENE_FISH, type PointerState } from './school';
import { FishGeometry, FISH_LENGTH } from './geometry';
import { AsciiPass, isAsciiStyle, type AsciiStyle } from './ascii';
import { PondEditor } from './editor';
import { WaterRipples } from './ripples';
import { sketchFootprint, type Bounds } from './editor-model';
import licenseUrl from './LICENSE?url';

// Retain the upstream MIT notice in the built artwork as document metadata.
const license = document.createElement('link');
license.rel = 'license';
license.href = licenseUrl;
document.head.append(license);

const canvas = document.querySelector('canvas')!;
const motion = matchMedia('(prefers-reduced-motion: reduce)');

function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor('#1d4ce9', 1);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  let editor: PondEditor<ReturnType<ReturnType<typeof createSchool>['capture']>> | undefined;
  const ripples = new WaterRipples(scene);
  type ViewMode = 'ascii' | 'low-poly' | 'spine';
  const url = new URL(location.href);
  const requestedStyle = url.searchParams.get('style');
  const requestedMode = url.searchParams.get('view');
  const settings: { mode: ViewMode; asciiStyle: AsciiStyle; body: boolean; depth: boolean; process: boolean; paused: boolean } = {
    mode: requestedMode === 'low-poly' || requestedMode === 'spine' ? requestedMode : 'ascii',
    asciiStyle: isAsciiStyle(requestedStyle) ? requestedStyle : 'classic',
    body: true, depth: true, process: url.searchParams.get('process') === '1', paused: false,
  };
  const requestedStage = url.searchParams.get('stage');
  let stage: ProcessStage = isProcessStage(requestedStage) ? requestedStage : 'motion';
  const ascii = new AsciiPass(settings.asciiStyle);
  const depthPass = new PondDepthPass();
  const depthMotion = new DepthMotion();
  url.searchParams.set('ascii', 'medium');
  history.replaceState(null, '', url);
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 10);
  camera.position.z = 4;
  scene.add(new THREE.AmbientLight('#ffffff', 0.95));
  const light = new THREE.DirectionalLight('#ffffff', 2);
  light.position.set(-3, 4, 3);
  scene.add(light);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true, side: THREE.DoubleSide });
  const finMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true,
    side: THREE.DoubleSide, transparent: true, opacity: 0.43, depthWrite: true });
  const ghostMaterial = new THREE.MeshBasicMaterial({ color: '#d9e8ff', wireframe: true,
    transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false });
  const eyesMaterial = new THREE.MeshBasicMaterial({ color: '#183d93' });
  const eyeGeometry = new THREE.OctahedronGeometry(FISH_LENGTH * 0.008);
  const makeFish = (i: number) => {
    const geometry = new FishGeometry(i);
    const mesh = new THREE.Mesh<FishGeometry, THREE.Material[]>(geometry, [material, finMaterial]);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const path = new PathDebug();
    scene.add(path.group);
    const debug = new SpineDebug();
    scene.add(debug.group);
    const eyes = [-1, 1].map(() => {
      const eye = new THREE.Mesh(eyeGeometry, eyesMaterial);
      scene.add(eye);
      return eye;
    });
    return { geometry, mesh, eyes, debug, path };
  };
  const fish = Array.from({ length: MAX_FISH }, (_, i) => makeFish(i));
  const pointer: PointerState = { target: [0.5, 0.5], over: false };
  let spine: Float32Array = new Float32Array(MAX_SCENE_FISH * 20);
  let states: Float32Array = new Float32Array(MAX_SCENE_FISH * 4);
  const fishScale = () => Math.min(1, canvas.clientWidth / canvas.clientHeight / 0.9);
  const school = createSchool({ canvas, options: () => ({ size: 1.15 * fishScale(), interactive: !motion.matches }),
    isPaused: index => editor?.selectedId === index,
    uniform: (name, value) => { if (name === 'uSpine') spine = value; else states = value; },
  }, pointer);
  const previousSpine = new Float32Array(MAX_SCENE_FISH * 20);
  const previousStates = new Float32Array(MAX_SCENE_FISH * 4);
  const renderedSpine = new Float32Array(MAX_SCENE_FISH * 20);
  const renderedStates = new Float32Array(MAX_SCENE_FISH * 4);
  const step = 1 / 60;
  let accumulator = 0;
  const events = new AbortController();
  const signal = events.signal;
  const resize = () => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    ascii.resize(canvas.clientWidth, canvas.clientHeight);
    depthPass.resize(canvas.clientWidth, canvas.clientHeight);
    camera.right = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    school.frame(time);
    previousSpine.set(spine);
    previousStates.set(states);
    draw();
  };
  let time = 20;
  function draw(alpha = 1) {
    const view = settings.process ? processView(stage).mode : settings.mode;
    const depthEnabled = settings.process ? processView(stage).depth : settings.depth && view !== 'spine';
    // Interpolate whole poses between fixed physics steps. 90/120/144 Hz
    // displays no longer repeat the same pose then jump to the next one.
    for (let j = 0; j < spine.length; j++) renderedSpine[j] = previousSpine[j] + (spine[j] - previousSpine[j]) * alpha;
    for (let j = 0; j < states.length; j++) renderedStates[j] = previousStates[j] + (states[j] - previousStates[j]) * alpha;
    while (fish.length < school.count) fish.push(makeFish(fish.length));
    fish.forEach(({ geometry, mesh, eyes, debug, path }, i) => {
      const visible = i < school.count && school.enabled(i);
      mesh.visible = visible && view !== 'path' && (view !== 'spine' || (!settings.process && settings.body));
      mesh.material = view === 'spine' ? [ghostMaterial, ghostMaterial] : [material, finMaterial];
      debug.group.visible = visible && view === 'spine';
      path.group.visible = visible && view === 'path';
      eyes.forEach(eye => { eye.visible = visible && view !== 'spine' && view !== 'path'; });
      if (!visible) return;
      const diving = depthMotion.sample(i, time, editor?.selectedId === i);
      const depth = depthEnabled ? diving : { scale: 1, z: 0, pitch: 0 };
      if (path.group.visible) path.update(school.copyPath(i, path.positions), renderedSpine[i * 20], renderedSpine[i * 20 + 1]);
      const scale = fishScale() * school.scale(i);
      geometry.update(renderedSpine, renderedStates[i * 4], renderedStates[i * 4 + 1], scale, depth.pitch);
      if (debug.group.visible) debug.update(renderedSpine, i, scale);
      const [stretchX, stretchY] = school.stretch(i);
      const sx = stretchX * depth.scale, sy = stretchY * depth.scale;
      const hx = renderedSpine[i * 20], hy = renderedSpine[i * 20 + 1];
      for (const object of [mesh, debug.group]) {
        object.scale.set(sx, sy, 1);
        object.position.set(hx * (1 - sx), hy * (1 - sy), depth.z);
      }
      eyes.forEach((eye, j) => {
        const [x, y, z] = geometry.eyes[j];
        eye.position.set(hx + (x - hx) * sx, hy + (y - hy) * sy, z + depth.z);
        eye.scale.setScalar(scale * depth.scale);
      });
    });
    const count = fish.filter((_, i) => i < school.count && school.enabled(i)).length;
    const description = `더블클릭한 곳을 피해 헤엄치는 ${{ ascii: '아스키아트', 'low-poly': '로우폴리', spine: '척추 디버그', path: '이동 경로', pixels: '픽셀' }[view]} 잉어 ${count}마리`;
    if (canvas.getAttribute('aria-label') !== description) canvas.setAttribute('aria-label', description);
    ripples.update(time);
    if (depthEnabled) depthPass.render(renderer, scene, camera, view === 'ascii' ? ascii : undefined);
    else if (view === 'ascii' || view === 'pixels') ascii.render(renderer, scene, camera, view === 'pixels');
    else renderer.render(scene, camera);
    editor?.refresh();
  }
  let last = 0;
  function frame(now: number) {
    if (document.hidden || motion.matches || settings.paused) { last = 0; accumulator = 0; return; }
    if (last) accumulator += Math.min((now - last) / 1000, 0.05);
    last = now;
    while (accumulator >= step) {
      previousSpine.set(spine);
      previousStates.set(states);
      time += step;
      pointer.over = ripples.active(time);
      school.frame(time);
      accumulator -= step;
    }
    draw(accumulator / step);
  }
  window.addEventListener('resize', resize, { signal });
  document.addEventListener('visibilitychange', () => { last = 0; accumulator = 0; pointer.over = false; }, { signal });
  motion.addEventListener('change', () => { last = 0; accumulator = 0; draw(); }, { signal });
  const refresh = () => {
    const index = editor?.selectedId;
    if (index !== undefined && index !== null) {
      previousSpine.set(spine.subarray(index * 20, index * 20 + 20), index * 20);
      previousStates.set(states.subarray(index * 4, index * 4 + 4), index * 4);
    } else { previousSpine.set(spine); previousStates.set(states); }
    draw();
  };
  const nodes = () => fish.flatMap(({ geometry, mesh }, id) => {
    if (id >= school.count || !school.enabled(id)) return [];
    const position = geometry.getAttribute('position');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let vertex = 0; vertex < geometry.drawRange.count; vertex++) {
      const x = (position.getX(vertex) * mesh.scale.x + mesh.position.x) * canvas.clientHeight;
      const y = (1 - position.getY(vertex) * mesh.scale.y - mesh.position.y) * canvas.clientHeight;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    const bounds: Bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    return [{ id, bounds }];
  }).sort((a, b) => fish[a.id].mesh.position.z - fish[b.id].mesh.position.z);
  resize();
  editor = new PondEditor(canvas, {
    nodes,
    add(points) {
      const footprint = sketchFootprint(points);
      if (!footprint) return -1;
      const h = canvas.clientHeight;
      const length = FISH_LENGTH * fishScale();
      const scale = Math.max(0.25, Math.min(4, footprint.length / h / length));
      const angle = -footprint.angle;
      const id = school.addFish(footprint.center.x / h + Math.cos(angle) * length * scale * 0.42,
        1 - footprint.center.y / h + Math.sin(angle) * length * scale * 0.42, angle, scale);
      document.querySelector<HTMLElement>('.editor-status')!.textContent = id < 0 ? '물고기는 최대 64마리까지 만들 수 있어요' : '';
      return id;
    },
    translate(id, dx, dy) { school.transform(id, [0, 0], 1, dx / canvas.clientHeight, -dy / canvas.clientHeight); },
    stretch(id, pivot, axis, ratio) {
      const h = canvas.clientHeight;
      return school.resizeAxis(id, [pivot.x / h, 1 - pivot.y / h], axis, ratio);
    },
    remove(id) { school.removeFish(id); },
    splash(point) {
      if (motion.matches) return;
      const h = canvas.clientHeight;
      pointer.target = [point.x / canvas.clientWidth, 1 - point.y / h];
      ripples.splash(point.x / h, 1 - point.y / h, time);
    },
    capture: () => school.capture(),
    restore(saved, id) { school.restoreFish(id, saved); },
    changed: refresh,
  });
  let syncGui: (() => void) | undefined;
  const stepper = createStepper({
    steps: PROCESS_STEPS, initialStep: stage, keyboard: false, urlParameter: 'stage',
    ariaLabel: '제작 과정 단계',
    onChange(id) {
      stage = id;
      syncGui?.(); draw();
    },
  });
  stepper.element.hidden = !settings.process;
  const gui = new GUI({ title: 'ASCII Pond', width: 232 });
  const modeController = gui.add(settings, 'mode', { ASCII: 'ascii', 'Low poly': 'low-poly', '척추 디버그': 'spine' }).name('표현').onChange(() => {
    syncGui?.();
    const url = new URL(location.href);
    url.searchParams.set('view', settings.mode);
    history.replaceState(null, '', url);
    draw();
  });
  const styleController = gui.add(settings, 'asciiStyle', { '클래식': 'classic', '도트': 'dots', '라인': 'lines', '코드': 'code', '블록': 'blocks' }).name('ASCII 스타일').onChange(() => {
    ascii.setStyle(settings.asciiStyle);
    const url = new URL(location.href);
    url.searchParams.set('style', settings.asciiStyle);
    history.replaceState(null, '', url);
    draw();
  });
  const bodyController = gui.add(settings, 'body').name('몸체 겹쳐 보기').onChange(() => draw());
  styleController.show(settings.mode === 'ascii');
  bodyController.show(settings.mode === 'spine');
  const depthController = gui.add(settings, 'depth').name('수심 효과').onChange(() => draw());
  const pauseController = gui.add(settings, 'paused').name('일시정지').onChange(() => { last = 0; accumulator = 0; draw(); });
  gui.add(settings, 'process').name('제작 과정').onChange(() => {
    stepper.element.hidden = !settings.process;
    const url = new URL(location.href);
    if (settings.process) { url.searchParams.set('process', '1'); url.searchParams.set('stage', stage); }
    else { url.searchParams.delete('process'); url.searchParams.delete('stage'); settings.paused = false; pauseController.updateDisplay(); }
    history.replaceState(null, '', url);
    last = 0; accumulator = 0;
    syncGui?.(); draw();
  });
  syncGui = () => {
    modeController.show(!settings.process);
    depthController.show(!settings.process);
    bodyController.show(!settings.process && settings.mode === 'spine');
    styleController.show(settings.process ? stage === 'ascii' || stage === 'depth' : settings.mode === 'ascii');
    pauseController.show(settings.process);
  };
  syncGui();
  if (innerWidth < 600) gui.close();
  renderer.setAnimationLoop(frame);
  if (import.meta.hot) import.meta.hot.dispose(() => {
    renderer.setAnimationLoop(null);
    events.abort();
    editor?.dispose();
    fish.forEach(({ geometry, debug, path }) => { geometry.dispose(); debug.dispose(); path.dispose(); });
    stepper.destroy();
    gui.destroy();
    eyeGeometry.dispose();
    eyesMaterial.dispose();
    material.dispose();
    ghostMaterial.dispose();
    finMaterial.dispose();
    ascii.dispose();
    depthPass.dispose();
    ripples.dispose();
    renderer.dispose();
  });
}
try { start(); } catch (error) {
  document.querySelector<HTMLElement>('.error')!.hidden = false;
  console.error(error);
}
