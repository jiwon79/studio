import * as THREE from 'three';
import { DeformationRig, controlDefinitions } from '../../../pages/soft-forms/deformation-rig';
import { bindSurface, skinBoundPoint } from '../../../pages/soft-forms/surface-binding';
import { TouchReaction } from '../../../pages/soft-forms/touch-reaction';
import { demoBaseline } from './body-demo';

export function createBindingDemo() {
  const element = document.createElement('section'); element.id = 'binding-demo'; element.className = 'interactive-demo soft-demo';
  element.setAttribute('aria-labelledby', 'binding-demo-title');
  element.innerHTML = `<div class="demo-heading"><h3 id="binding-demo-title">몸체·뿌리·끝의 접촉 반응</h3><p>누르기와 해제에 따른 이동량·반동을 표시한다.</p></div>
    <canvas role="img" aria-label="몸체의 측면 단면. 파란 점은 털 뿌리, 붉은 점은 털끝이다. 누르면 뿌리는 표면을 따라 이동하고 끝은 더 적게 이동한다."></canvas>
    <p class="soft-key">몸체 단면을 확대 · 파란 점: 뿌리 · 붉은 점: 끝</p>
    <button type="button" class="soft-action">누르기</button><output class="soft-readout" aria-live="polite">몸체와 털은 같은 접촉 위치·법선을 사용한다.</output>
    <div class="binding-values"><span>뿌리 이동 <output data-root>0.0</output></span><span>끝 이동 <output data-tip>0.0</output></span></div>`;
  const canvas = element.querySelector('canvas')!, ctx = canvas.getContext('2d')!, button = element.querySelector('button')!;
  const rig = new DeformationRig('star'), directions = Float32Array.from(Array.from({ length: 41 }, (_, i) => { const x = (i - 20) / 20; return [x, 0, Math.sqrt(Math.max(0, 1 - x * x))]; }).flat());
  const body = bindSurface(rig, directions, demoBaseline), roots = bindSurface(rig, directions, demoBaseline, 3, 1.5);
  const restBody = new Float32Array(directions.length), restRoots = new Float32Array(directions.length), restTips = new Float32Array(directions.length);
  for (let i = 0; i < 41; i++) {
    skinBoundPoint(rig, body, i, 0, restBody, i * 3); skinBoundPoint(rig, roots, i, 0, restRoots, i * 3);
    rig.skinPoint(roots.restPositions[i * 3] + directions[i * 3] * 25, 0, roots.restPositions[i * 3 + 2] + directions[i * 3 + 2] * 25,
      roots.controlWeights, restTips, i * 3, i * controlDefinitions.length);
  }
  const center = 20 * 3, contact = new THREE.Vector3(restBody[center], 0, restBody[center + 2]), normal = new THREE.Vector3(0, 0, 1);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let reaction = new TouchReaction(), held = false, frame = 0, previous = 0, elapsed = 0;
  const draw = () => {
    const ratio = Math.min(devicePixelRatio, 2); canvas.width = Math.round(canvas.clientWidth * ratio); canvas.height = Math.round(canvas.clientHeight * ratio); ctx.scale(ratio, ratio);
    const scale = Math.min(canvas.clientWidth / 420, canvas.clientHeight / 230), screen = (x: number, z: number) => ({ x: canvas.clientWidth / 2 + x * scale, y: canvas.clientHeight * .78 - z * scale });
    const displaced = (values: Float32Array, i: number, amount = 1) => {
      const at = i * 3, push = reaction.displacement(restRoots[at], restRoots[at + 1], restRoots[at + 2]) * amount;
      return screen(values[at], values[at + 2] + push);
    };
    ctx.beginPath();
    for (let i = 0; i < 41; i++) {
      const at = i * 3, push = reaction.displacement(restBody[at], 0, restBody[at + 2]);
      const p = screen(restBody[at], restBody[at + 2] + push); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    ctx.lineTo(screen(restBody[120], -25).x, canvas.clientHeight); ctx.lineTo(screen(restBody[0], -25).x, canvas.clientHeight); ctx.closePath();
    ctx.fillStyle = '#b6b1e530'; ctx.fill(); ctx.strokeStyle = '#235c9a'; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 4; i <= 36; i += 4) {
      const root = displaced(restRoots, i), tip = displaced(restTips, i, .72);
      ctx.beginPath(); ctx.moveTo(root.x, root.y); ctx.lineTo(tip.x, tip.y); ctx.strokeStyle = '#827b70'; ctx.lineWidth = 1.5; ctx.stroke();
      for (const [p, color] of [[root, '#235c9a'], [tip, '#b64e3c']] as const) { ctx.beginPath(); ctx.arc(p.x, p.y, i === 20 ? 4 : 2.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
    }
    const push = reaction.displacement(restRoots[center], 0, restRoots[center + 2]);
    element.querySelector('[data-root]')!.textContent = Math.abs(push).toFixed(1); element.querySelector('[data-tip]')!.textContent = Math.abs(push * .72).toFixed(1);
    canvas.dataset.phase = held ? 'pressing' : reaction.active ? 'rebounding' : 'rest';
  };
  const animate = (now: number) => {
    frame = 0; const dt = Math.min(.04, (now - previous) / 1000 || 1 / 60); previous = now; elapsed += dt; reaction.advance(dt); draw();
    if (held ? elapsed < 1.2 : reaction.active) frame = requestAnimationFrame(animate);
  };
  button.addEventListener('click', () => {
    cancelAnimationFrame(frame); frame = 0; elapsed = 0; previous = performance.now(); held = !held;
    if (held) { reaction = new TouchReaction(); reaction.begin(contact, normal); }
    else reaction.end(performance.now());
    button.textContent = held ? '손 놓기' : '다시 누르기';
    element.querySelector('.soft-readout')!.textContent = held ? '뿌리는 표면을 따라 이동하고, 끝에는 그 이동량의 72%를 적용한다.' : '접촉 해제 후 눌림이 감소하고 반동이 주변으로 전파된다.';
    if (reduced.matches) { for (let i = 0; i < (held ? 72 : 120); i++) reaction.advance(1 / 60); draw(); }
    else frame = requestAnimationFrame(animate);
  });
  new IntersectionObserver(entries => { if (!entries[0].isIntersecting) { cancelAnimationFrame(frame); frame = 0; if (held) for (let i = 0; i < 72; i++) reaction.advance(1 / 60); else for (let i = 0; i < 120; i++) reaction.advance(1 / 60); draw(); } }).observe(element);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } });
  new ResizeObserver(draw).observe(canvas); return element;
}
