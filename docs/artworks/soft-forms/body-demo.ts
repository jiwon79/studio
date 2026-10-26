import { DeformationRig, neutralControlPose } from '../../../pages/soft-forms/deformation-rig';
import { restSurface } from '../../../pages/soft-forms/rest-surface';
import { motionFrames } from '../../../pages/soft-forms/motion-data';

export const demoBaseline = Float32Array.from(motionFrames[0].radii, (_, i) =>
  motionFrames.reduce((sum, frame) => sum + frame.radii[i], 0) / motionFrames.length);

export function createBodyDemo() {
  const element = document.createElement('section'); element.id = 'body-demo'; element.className = 'interactive-demo soft-demo';
  element.setAttribute('aria-labelledby', 'body-demo-title');
  element.innerHTML = `<div class="demo-heading"><h3 id="body-demo-title">기준점 이동과 표면 변형</h3><p>기준점을 드래그하면 주변 표면의 변형이 표시된다.</p></div>
    <canvas tabindex="0" role="img" aria-label="몸체의 중심과 둘레에 놓인 13개 기준점. 드래그 또는 방향키로 선택한 기준점을 이동한다."></canvas>
    <p class="soft-key">점선: 원래 외곽 · 파란 선: 움직인 외곽 · 붉은 점: 선택한 기준점</p>
    <button class="reset-button" type="button">원래 모양으로</button><output class="soft-readout" aria-live="polite"></output>`;
  const canvas = element.querySelector('canvas')!, ctx = canvas.getContext('2d')!, rig = new DeformationRig('star');
  const poses = neutralControlPose(), original = new Float32Array(3), moved = new Float32Array(3);
  const outline = Array.from({ length: 181 }, (_, i) => {
    const a = i / 180 * 2 * Math.PI; restSurface('star', Math.cos(a), Math.sin(a), 0, demoBaseline, original);
    return { x: original[0], y: original[1], weights: rig.weightsFor(original[0], original[1]) };
  });
  let selected = 1;
  const scale = () => Math.min(canvas.clientWidth / 480, canvas.clientHeight / 420);
  const screen = (x: number, y: number) => ({ x: canvas.clientWidth / 2 + x * scale(), y: canvas.clientHeight / 2 - y * scale() });
  const point = (x: number, y: number, color: string, radius: number) => {
    const p = screen(x, y); ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#faf8f3'; ctx.lineWidth = 1.5; ctx.stroke();
  };
  const draw = () => {
    const ratio = Math.min(devicePixelRatio, 2); canvas.width = Math.round(canvas.clientWidth * ratio); canvas.height = Math.round(canvas.clientHeight * ratio); ctx.scale(ratio, ratio);
    rig.setPose(poses);
    for (const warped of [false, true]) {
      ctx.beginPath();
      outline.forEach((p, i) => {
        if (warped) rig.skinPoint(p.x, p.y, 0, p.weights, moved, 0);
        const q = screen(warped ? moved[0] : p.x, warped ? moved[1] : p.y);
        if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
      });
      ctx.closePath(); ctx.setLineDash(warped ? [] : [4, 4]); ctx.strokeStyle = warped ? '#235c9a' : '#a49b8c'; ctx.lineWidth = warped ? 2 : 1;
      if (warped) { ctx.fillStyle = '#b6b1e530'; ctx.fill(); } ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const p of outline.filter((_, i) => i % 10 === 0)) {
      rig.skinPoint(p.x, p.y, 0, p.weights, moved, 0);
      const a = screen(p.x, p.y), b = screen(moved[0], moved[1]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = '#235c9a66'; ctx.lineWidth = 1; ctx.stroke();
    }
    rig.definitions.forEach((_, i) => { const [x, y] = rig.controlPosition(i); point(x, y, i === selected ? '#b64e3c' : '#235c9a', i === selected ? 6 : 4); });
    element.querySelector('output')!.textContent = `${rig.definitions[selected].name} 기준점 선택 · 기준점에 가까울수록 표면 이동량이 크다.`;
  };
  let drag: { id: number; x: number; y: number; dx: number; dy: number } | null = null;
  const local = (event: PointerEvent) => {
    const r = canvas.getBoundingClientRect(); return { x: (event.clientX - r.left - canvas.clientLeft - canvas.clientWidth / 2) / scale(), y: -(event.clientY - r.top - canvas.clientTop - canvas.clientHeight / 2) / scale() };
  };
  canvas.addEventListener('pointerdown', event => {
    if (drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const p = local(event); let nearest = -1, distance = 22 / scale();
    rig.definitions.forEach((_, i) => { const [x, y] = rig.controlPosition(i), d = Math.hypot(p.x - x, p.y - y); if (d < distance) { distance = d; nearest = i; } });
    if (nearest < 0) return;
    selected = nearest; drag = { id: event.pointerId, x: p.x, y: p.y, dx: poses[selected].dx, dy: poses[selected].dy }; canvas.setPointerCapture(event.pointerId); draw();
  });
  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return; const p = local(event);
    poses[selected].dx = Math.max(-80, Math.min(80, drag.dx + p.x - drag.x)); poses[selected].dy = Math.max(-80, Math.min(80, drag.dy + p.y - drag.y)); draw();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => {
    const id = (event as PointerEvent).pointerId; if (drag?.id !== id) return; drag = null; if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  });
  canvas.addEventListener('keydown', event => {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] };
    const d = directions[event.key]; if (!d) return; event.preventDefault();
    poses[selected].dx = Math.max(-80, Math.min(80, poses[selected].dx + d[0])); poses[selected].dy = Math.max(-80, Math.min(80, poses[selected].dy + d[1])); draw();
  });
  element.querySelector('button')!.addEventListener('click', () => { poses.forEach(p => { p.dx = 0; p.dy = 0; p.angle = 0; }); draw(); });
  new ResizeObserver(draw).observe(canvas); return element;
}
