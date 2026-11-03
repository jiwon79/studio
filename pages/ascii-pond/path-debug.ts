import * as THREE from 'three';
import { TRAIL_POINTS } from './school';

export class PathDebug {
  readonly group = new THREE.Group();
  readonly positions = new Float32Array((TRAIL_POINTS + 1) * 3);
  private readonly lineGeometry = new THREE.BufferGeometry();
  private readonly headGeometry = new THREE.BufferGeometry();
  private readonly head = new Float32Array(3);
  private readonly lineMaterial = new THREE.LineBasicMaterial({ color: '#c9dcff', transparent: true, opacity: 0.5, depthTest: false, toneMapped: false });
  private readonly headMaterial = new THREE.PointsMaterial({ color: '#ffffff', size: 6, sizeAttenuation: false, depthTest: false, toneMapped: false });
  constructor() {
    this.lineGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.headGeometry.setAttribute('position', new THREE.BufferAttribute(this.head, 3).setUsage(THREE.DynamicDrawUsage));
    this.group.add(new THREE.Line(this.lineGeometry, this.lineMaterial), new THREE.Points(this.headGeometry, this.headMaterial));
    this.group.children.forEach(child => { child.frustumCulled = false; });
  }
  update(count: number, x: number, y: number) {
    this.head.set([x, y, 0.04]);
    this.lineGeometry.setDrawRange(0, count);
    this.lineGeometry.getAttribute('position').needsUpdate = true;
    this.headGeometry.getAttribute('position').needsUpdate = true;
  }
  dispose() {
    this.lineGeometry.dispose(); this.headGeometry.dispose();
    this.lineMaterial.dispose(); this.headMaterial.dispose();
  }
}
