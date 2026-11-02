import * as THREE from 'three';
import GUI from 'lil-gui';
import { SpineDebug } from './spine-debug';
import { createSchool, MAX_FISH, MAX_SCENE_FISH, type PointerState } from './school';
import { FishGeometry, FISH_LENGTH } from './geometry';
import { AsciiPass, isAsciiSize, type AsciiSize } from './ascii';
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
  const ascii = new AsciiPass();
  type ViewMode = 'ascii' | 'low-poly' | 'spine';
  const url = new URL(location.href);
  const requestedSize = url.searchParams.get('ascii');
  const requestedMode = url.searchParams.get('view');
  const settings: { mode: ViewMode; size: AsciiSize; body: boolean } = {
    mode: requestedMode === 'low-poly' || requestedMode === 'spine' ? requestedMode : 'ascii',
    size: isAsciiSize(requestedSize) ? requestedSize : 'small',
    body: true,
  };
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 10);
  camera.position.z = 4;
  scene.add(new THREE.AmbientLight('#ffffff', 0.95));
  const light = new THREE.DirectionalLight('#ffffff', 2);
  light.position.set(-3, 4, 3);
  scene.add(light);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true, side: THREE.DoubleSide });
  const finMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true,
    side: THREE.DoubleSide, transparent: true, opacity: 0.43, depthWrite: false });
  const ghostMaterial = new THREE.MeshBasicMaterial({ color: '#d9e8ff', wireframe: true,
    transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false });
  const eyesMaterial = new THREE.MeshBasicMaterial({ color: '#183d93' });
  const eyeGeometry = new THREE.OctahedronGeometry(FISH_LENGTH * 0.008);
  const makeFish = (i: number) => {
    const geometry = new FishGeometry(i);
    const mesh = new THREE.Mesh<FishGeometry, THREE.Material[]>(geometry, [material, finMaterial]);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const debug = new SpineDebug();
    scene.add(debug.group);
    const eyes = [-1, 1].map(() => {
      const eye = new THREE.Mesh(eyeGeometry, eyesMaterial);
      scene.add(eye);
      return eye;
    });
    return { geometry, mesh, eyes, debug };
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
    ascii.resize(canvas.clientWidth, canvas.clientHeight, settings.size);
    camera.right = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    school.frame(time);
    previousSpine.set(spine);
    previousStates.set(states);
    draw();
  };
  let time = 20;
  function draw(alpha = 1) {
    // Interpolate whole poses between fixed physics steps. 90/120/144 Hz
    // displays no longer repeat the same pose then jump to the next one.
    for (let j = 0; j < spine.length; j++) renderedSpine[j] = previousSpine[j] + (spine[j] - previousSpine[j]) * alpha;
    for (let j = 0; j < states.length; j++) renderedStates[j] = previousStates[j] + (states[j] - previousStates[j]) * alpha;
    while (fish.length < school.count) fish.push(makeFish(fish.length));
    fish.forEach(({ geometry, mesh, eyes, debug }, i) => {
      const visible = i < school.count && school.enabled(i);
      mesh.visible = visible && (settings.mode !== 'spine' || settings.body);
      mesh.material = settings.mode === 'spine' ? [ghostMaterial, ghostMaterial] : [material, finMaterial];
      debug.group.visible = visible && settings.mode === 'spine';
      eyes.forEach(eye => { eye.visible = visible && settings.mode !== 'spine'; });
      if (!visible) return;
      const scale = fishScale() * school.scale(i);
      geometry.update(renderedSpine, renderedStates[i * 4], renderedStates[i * 4 + 1], scale);
      if (debug.group.visible) debug.update(renderedSpine, i, scale);
      const [sx, sy] = school.stretch(i);
      const hx = renderedSpine[i * 20], hy = renderedSpine[i * 20 + 1];
      for (const object of [mesh, debug.group]) {
        object.scale.set(sx, sy, 1);
        object.position.set(hx * (1 - sx), hy * (1 - sy), 0);
      }
      eyes.forEach((eye, j) => {
        const [x, y, z] = geometry.eyes[j];
        eye.position.set(hx + (x - hx) * sx, hy + (y - hy) * sy, z);
        eye.scale.setScalar(scale);
      });
    });
    const count = fish.filter((_, i) => i < school.count && school.enabled(i)).length;
    const description = `더블클릭한 곳을 피해 헤엄치는 ${{ ascii: '아스키아트', 'low-poly': '로우폴리', spine: '척추 디버그' }[settings.mode]} 잉어 ${count}마리`;
    if (canvas.getAttribute('aria-label') !== description) canvas.setAttribute('aria-label', description);
    ripples.update(time);
    if (settings.mode === 'ascii') ascii.render(renderer, scene, camera);
    else renderer.render(scene, camera);
    editor?.refresh();
  }
  let last = 0;
  function frame(now: number) {
    if (document.hidden || motion.matches) { last = 0; accumulator = 0; return; }
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
  });
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
    scale(id, pivot, ratio) {
      const h = canvas.clientHeight;
      return school.resizeUniform(id, [pivot.x / h, 1 - pivot.y / h], ratio);
    },
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
  const gui = new GUI({ title: 'ASCII Pond', width: 232 });
  gui.add(settings, 'mode', { ASCII: 'ascii', 'Low poly': 'low-poly', '척추 디버그': 'spine' }).name('표현').onChange(() => {
    sizeController.show(settings.mode === 'ascii');
    bodyController.show(settings.mode === 'spine');
    const url = new URL(location.href);
    url.searchParams.set('view', settings.mode);
    history.replaceState(null, '', url);
    draw();
  });
  const sizeController = gui.add(settings, 'size', { '기존': 'original', '중간': 'medium', '조금 작게': 'compact', '작게': 'small' }).name('글자 크기').onChange(() => {
    ascii.resize(canvas.clientWidth, canvas.clientHeight, settings.size);
    const url = new URL(location.href);
    url.searchParams.set('ascii', settings.size);
    history.replaceState(null, '', url);
    draw();
  });
  const bodyController = gui.add(settings, 'body').name('몸체 겹쳐 보기').onChange(() => draw());
  sizeController.show(settings.mode === 'ascii');
  bodyController.show(settings.mode === 'spine');
  if (innerWidth < 600) gui.close();
  renderer.setAnimationLoop(frame);
  if (import.meta.hot) import.meta.hot.dispose(() => {
    renderer.setAnimationLoop(null);
    events.abort();
    editor?.dispose();
    fish.forEach(({ geometry, debug }) => { geometry.dispose(); debug.dispose(); });
    gui.destroy();
    eyeGeometry.dispose();
    eyesMaterial.dispose();
    material.dispose();
    ghostMaterial.dispose();
    finMaterial.dispose();
    ascii.dispose();
    ripples.dispose();
    renderer.dispose();
  });
}
try { start(); } catch (error) {
  document.querySelector<HTMLElement>('.error')!.hidden = false;
  console.error(error);
}
