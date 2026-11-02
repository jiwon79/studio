import * as THREE from 'three';

/** Short, local disturbances; moving the cursor never creates one. */
export class WaterRipples {
  private readonly geometry = new THREE.RingGeometry(1, 1.025, 96);
  private readonly waves: { mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; start: number }[] = [];
  private impulseUntil = -Infinity;
  constructor(private readonly scene: THREE.Scene) {}

  splash(x: number, y: number, time: number) {
    this.impulseUntil = time + 1.5;
    for (let i = 0; i < 3; i++) {
      const material = new THREE.MeshBasicMaterial({ color: '#e7efff', transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.position.set(x, y, -0.01);
      this.scene.add(mesh);
      this.waves.push({ mesh, start: time + i * 0.2 });
    }
    while (this.waves.length > 18) this.remove(0);
    this.update(time);
  }

  active(time: number) { return time < this.impulseUntil; }

  update(time: number) {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wave = this.waves[i], age = time - wave.start;
      if (age >= 2.4) { this.remove(i); continue; }
      wave.mesh.visible = age >= 0;
      wave.mesh.scale.setScalar(0.02 + Math.max(0, age) * 0.34);
      wave.mesh.material.opacity = Math.pow(1 - Math.max(0, age) / 2.4, 2) * 0.45;
    }
  }

  private remove(index: number) {
    const [wave] = this.waves.splice(index, 1);
    this.scene.remove(wave.mesh); wave.mesh.material.dispose();
  }
  dispose() { while (this.waves.length) this.remove(0); this.geometry.dispose(); }
}
