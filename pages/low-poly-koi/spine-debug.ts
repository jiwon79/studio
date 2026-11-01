import * as THREE from 'three';
import { bodyHalfWidth } from './geometry';
import { SPINE_POINTS } from './school';

/** Shows the actual posed simulation bones, rather than a separate animation. */
export class SpineDebug {
  readonly group = new THREE.Group();
  private readonly spine = new THREE.BufferGeometry();
  private readonly ribs = new THREE.BufferGeometry();
  private readonly arrow = new THREE.BufferGeometry();
  private readonly positions = new Float32Array(SPINE_POINTS * 3);
  private readonly ribPositions = new Float32Array(8 * 6);
  private readonly arrowPositions = new Float32Array(18);
  private readonly boneMaterial = new THREE.LineBasicMaterial({ color: '#ffffff', depthTest: false, toneMapped: false });
  private readonly ribMaterial = new THREE.LineBasicMaterial({ color: '#b9d5ff', transparent: true, opacity: 0.65, depthTest: false, toneMapped: false });
  private readonly jointMaterial = new THREE.PointsMaterial({ color: '#f3f7ff', size: 5, sizeAttenuation: false, depthTest: false, toneMapped: false });

  constructor() {
    this.spine.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.ribs.setAttribute('position', new THREE.BufferAttribute(this.ribPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.arrow.setAttribute('position', new THREE.BufferAttribute(this.arrowPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.group.add(new THREE.Line(this.spine, this.boneMaterial), new THREE.Points(this.spine, this.jointMaterial),
      new THREE.LineSegments(this.ribs, this.ribMaterial), new THREE.LineSegments(this.arrow, this.boneMaterial));
    this.group.children.forEach(child => { child.frustumCulled = false; child.renderOrder = 5; });
  }

  update(data: Float32Array, fish: number, scale: number) {
    const base = fish * SPINE_POINTS * 2;
    for (let k = 0; k < SPINE_POINTS; k++) {
      const x = data[base + k * 2], y = data[base + k * 2 + 1];
      this.positions.set([x, y, 0.04], k * 3);
      if (k >= 8) continue;
      const a = base + Math.max(0, k - 1) * 2, b = base + Math.min(9, k + 1) * 2;
      const dx = data[a] - data[b], dy = data[a + 1] - data[b + 1];
      const length = Math.hypot(dx, dy) || 1, width = bodyHalfWidth(k / 9, scale);
      this.ribPositions.set([x - dy / length * width, y + dx / length * width, 0.04,
        x + dy / length * width, y - dx / length * width, 0.04], k * 6);
    }
    const dx = data[base] - data[base + 2], dy = data[base + 1] - data[base + 3];
    const length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length;
    const x = data[base], y = data[base + 1], size = 0.025 * scale;
    const tx = x + ux * size, ty = y + uy * size;
    this.arrowPositions.set([x, y, 0.04, tx, ty, 0.04,
      tx, ty, 0.04, tx - ux * size * 0.3 - uy * size * 0.2, ty - uy * size * 0.3 + ux * size * 0.2, 0.04,
      tx, ty, 0.04, tx - ux * size * 0.3 + uy * size * 0.2, ty - uy * size * 0.3 - ux * size * 0.2, 0.04]);
    for (const geometry of [this.spine, this.ribs, this.arrow]) geometry.getAttribute('position').needsUpdate = true;
  }

  dispose() {
    this.spine.dispose(); this.ribs.dispose(); this.arrow.dispose();
    this.boneMaterial.dispose(); this.ribMaterial.dispose(); this.jointMaterial.dispose();
  }
}
