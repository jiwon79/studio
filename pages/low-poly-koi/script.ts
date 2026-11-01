import * as THREE from 'three';
import { createSchool, MAX_FISH, type PointerState } from './school';
import { FishGeometry, FISH_LENGTH } from './geometry';
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
  renderer.setClearColor('#0b0f1e', 1);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 10);
  camera.position.z = 4;
  scene.add(new THREE.AmbientLight('#c8d6f6', 1.7));
  const light = new THREE.DirectionalLight('#fff4d9', 2.6);
  light.position.set(-1, 2, 4);
  scene.add(light);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true, side: THREE.DoubleSide });
  const eyesMaterial = new THREE.MeshBasicMaterial({ color: '#151a24' });
  const eyeGeometry = new THREE.OctahedronGeometry(FISH_LENGTH * 0.008);
  const fish = Array.from({ length: MAX_FISH }, (_, i) => {
    const geometry = new FishGeometry(i);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const eyes = [-1, 1].map(() => {
      const eye = new THREE.Mesh(eyeGeometry, eyesMaterial);
      scene.add(eye);
      return eye;
    });
    return { geometry, eyes };
  });
  const pointer: PointerState = { target: [0.5, 0.5], over: false };
  let spine: Float32Array = new Float32Array(MAX_FISH * 20);
  let states: Float32Array = new Float32Array(MAX_FISH * 4);
  const fishScale = () => Math.min(1, canvas.clientWidth / canvas.clientHeight / 0.9);
  const school = createSchool({ canvas, options: () => ({ size: 1.15 * fishScale(), interactive: !motion.matches }),
    uniform: (name, value) => { if (name === 'uSpine') spine = value; else states = value; },
  }, pointer);
  const previousSpine = new Float32Array(MAX_FISH * 20);
  const previousStates = new Float32Array(MAX_FISH * 4);
  const renderedSpine = new Float32Array(MAX_FISH * 20);
  const renderedStates = new Float32Array(MAX_FISH * 4);
  const step = 1 / 60;
  let accumulator = 0;
  const events = new AbortController();
  const signal = events.signal;
  const move = (event: PointerEvent) => {
    pointer.target = [event.clientX / canvas.clientWidth, 1 - event.clientY / canvas.clientHeight];
    pointer.over = true;
  };
  canvas.addEventListener('pointermove', move, { signal });
  canvas.addEventListener('pointerdown', move, { signal });
  for (const name of ['pointerleave', 'pointercancel', 'pointerup'] as const) {
    canvas.addEventListener(name, () => { pointer.over = false; }, { signal });
  }
  window.addEventListener('blur', () => { pointer.over = false; }, { signal });
  const resize = () => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
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
    fish.forEach(({ geometry, eyes }, i) => {
      geometry.update(renderedSpine, renderedStates[i * 4], renderedStates[i * 4 + 1], fishScale());
      eyes.forEach((eye, j) => {
        eye.position.set(...geometry.eyes[j]);
        eye.scale.setScalar(fishScale());
      });
    });
    renderer.render(scene, camera);
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
      school.frame(time);
      accumulator -= step;
    }
    draw(accumulator / step);
  }
  window.addEventListener('resize', resize, { signal });
  document.addEventListener('visibilitychange', () => { last = 0; accumulator = 0; pointer.over = false; }, { signal });
  motion.addEventListener('change', () => { last = 0; accumulator = 0; draw(); }, { signal });
  resize();
  renderer.setAnimationLoop(frame);
  if (import.meta.hot) import.meta.hot.dispose(() => {
    renderer.setAnimationLoop(null);
    events.abort();
    fish.forEach(({ geometry }) => geometry.dispose());
    eyeGeometry.dispose();
    eyesMaterial.dispose();
    material.dispose();
    renderer.dispose();
  });
}
try { start(); } catch (error) {
  document.querySelector<HTMLElement>('.error')!.hidden = false;
  console.error(error);
}
