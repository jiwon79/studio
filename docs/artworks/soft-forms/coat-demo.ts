/// <reference types="vite/client" />
import * as THREE from 'three';
import { DeformationRig } from '../../../pages/soft-forms/deformation-rig';
import { bindSurface, skinBoundPoint } from '../../../pages/soft-forms/surface-binding';
import { FurRenderer, FUR_RENDER_ORDER } from '../../../pages/soft-forms/fur-renderer';
import { TouchReaction } from '../../../pages/soft-forms/touch-reaction';
import { variants } from '../../../pages/soft-forms/variants';
import palette from '../../../pages/soft-forms/palette.glsl?raw';
import bodyFragment from '../../../pages/soft-forms/body.frag?raw';
import { demoBaseline } from './body-demo';

export function createCoatDemo() {
  const element = document.createElement('section'); element.id = 'coat-demo'; element.className = 'interactive-demo soft-demo';
  element.setAttribute('aria-labelledby', 'coat-demo-title');
  element.innerHTML = `<div class="demo-heading"><h3 id="coat-demo-title">몸체 → 두께 → 가닥 순서로 쌓기</h3><p>버튼으로 다음 표현을 더하고, 그림을 끌어 돌려 보세요.</p></div>
    <div class="coat-scene"></div><output class="coat-stage" aria-live="polite"></output><button type="button" class="soft-action"></button><p class="soft-key">작품의 실제 몸체·셸·리본 셰이더를 사용합니다.</p>`;
  const host = element.querySelector<HTMLElement>('.coat-scene')!; let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch { host.textContent = '털 데모를 보려면 WebGL을 지원하는 브라우저가 필요합니다.'; element.querySelector('button')!.remove(); return element; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement; canvas.tabIndex = 0; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '실제 솜결 몸체에 털 표현을 더하는 장면. 드래그하거나 방향키로 회전할 수 있습니다.'); host.append(canvas);
  const scene = new THREE.Scene(), character = new THREE.Group(); scene.add(character);
  const camera = new THREE.OrthographicCamera(-400, 400, 210, -210, .1, 2000); camera.position.z = 1000;
  const geometry = new THREE.SphereGeometry(1, 64, 48), directions = Float32Array.from(geometry.getAttribute('position').array);
  const rig = new DeformationRig('original'), binding = bindSurface(rig, directions, demoBaseline), positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < directions.length / 3; i++) skinBoundPoint(rig, binding, i, 0, positions.array as Float32Array, i * 3);
  positions.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const colors = variants.find(v => v.id === 'original')!.colors;
  const color = (hex: string) => { const n = parseInt(hex.slice(1), 16); return new THREE.Vector3((n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
  const uniforms: Record<string, THREE.IUniform> = { uCheek: { value: 0 }, uStarSoftness: { value: 0 } };
  for (const key of ['base', 'cool', 'blush', 'warm', 'highlight', 'bottom', 'detail', 'furTip'] as const)
    uniforms[`u${key[0].toUpperCase()}${key.slice(1)}Color`] = { value: color(colors[key]) };
  const body = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: true,
    vertexShader: 'varying vec3 vLocal; varying vec3 vNormal; void main(){ vLocal=position; vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `precision highp float;\n${palette}\n${bodyFragment}`,
  }));
  const fur = new FurRenderer(geometry, directions, uniforms, rig, demoBaseline); fur.update(rig, 0, new TouchReaction(), positions.array as Float32Array); character.add(body, fur.group);
  let stage = 0;
  const labels = ['① 몸체: 색과 기본 형태를 만듭니다.', '② 셸: 몸체 밖의 두께를 채웁니다.', '③ 리본: 외곽에 개별 가닥이 보입니다.'];
  const draw = () => renderer.render(scene, camera);
  const update = () => {
    fur.group.children.forEach(mesh => { mesh.visible = stage >= 1 && (mesh.renderOrder < FUR_RENDER_ORDER || stage >= 2); });
    element.querySelector('output')!.textContent = labels[stage]; element.querySelector('button')!.textContent = ['셸 더하기', '리본 더하기', '처음부터 보기'][stage]; draw();
  };
  element.querySelector('button')!.addEventListener('click', () => { stage = (stage + 1) % 3; update(); });
  let drag: { id: number; x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', event => { if (drag || (event.pointerType === 'mouse' && event.button !== 0)) return; drag = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', event => { if (drag?.id !== event.pointerId) return; character.rotation.y += (event.clientX - drag.x) * .012; character.rotation.x = THREE.MathUtils.clamp(character.rotation.x + (event.clientY - drag.y) * .008, -.8, .8); drag.x = event.clientX; drag.y = event.clientY; draw(); });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => { const id = (event as PointerEvent).pointerId; if (drag?.id !== id) return; drag = null; if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); });
  canvas.addEventListener('keydown', event => { if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return; event.preventDefault(); if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') character.rotation.y += event.key === 'ArrowLeft' ? -.15 : .15; else character.rotation.x = THREE.MathUtils.clamp(character.rotation.x + (event.key === 'ArrowUp' ? -.15 : .15), -.8, .8); draw(); });
  new ResizeObserver(() => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.left = -210 * w / h; camera.right = 210 * w / h; camera.updateProjectionMatrix(); update(); }).observe(host);
  update(); return element;
}
