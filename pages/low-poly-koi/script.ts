import * as THREE from 'three';
import { createSchool, MAX_FISH, type PointerState } from './school';
import { FishGeometry, FISH_LENGTH } from './geometry';

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
  const school = createSchool({ canvas, options: () => ({ size: 1.15, interactive: !motion.matches }),
    uniform: (name, value) => { if (name === 'uSpine') spine = value; else states = value; },
  }, pointer);
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
    draw();
  };
  let time = 20;
  function draw() {
    school.frame(time);
    fish.forEach(({ geometry, eyes }, i) => {
      geometry.update(spine, states[i * 4], states[i * 4 + 1]);
      const base = i * 20;
      const dx = spine[base] - spine[base + 2], dy = spine[base + 1] - spine[base + 3];
      const len = Math.hypot(dx, dy) || 1;
      eyes.forEach((eye, j) => {
        const side = j === 0 ? -1 : 1;
        eye.position.set(spine[base] - dx / len * 0.007 - dy / len * side * 0.01,
          spine[base + 1] - dy / len * 0.007 + dx / len * side * 0.01, 0.009);
      });
    });
    renderer.render(scene, camera);
  }
  let last = 0;
  function frame(now: number) {
    if (document.hidden || motion.matches) { last = 0; return; }
    if (last) time += Math.min((now - last) / 1000, 0.05);
    last = now;
    draw();
  }
  window.addEventListener('resize', resize, { signal });
  document.addEventListener('visibilitychange', () => { last = 0; pointer.over = false; }, { signal });
  motion.addEventListener('change', () => { last = 0; draw(); }, { signal });
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
