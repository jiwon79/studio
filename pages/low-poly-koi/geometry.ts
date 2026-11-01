import * as THREE from 'three';

export type Point = [number, number, number];
export const FISH_LENGTH = 0.17 * 1.15;
const HALF_WIDTH = FISH_LENGTH * 0.13;
const LANES = [-1, -0.5, 0, 0.5, 1];
const SMOOTH = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const random = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Fixed topology, attached to the same ten moving spine points as the source.
// Every triangle has independent vertices so normals stay flat at its edges.
export class FishGeometry extends THREE.BufferGeometry {
  private readonly positions = new Float32Array(100 * 9);
  private readonly colors = new Float32Array(100 * 9);
  private triangle = 0;
  private readonly color = new THREE.Color();
  constructor(private readonly fish: number) {
    super();
    this.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
  }

  private face(a: Point, b: Point, c: Point, u: number, side: number, fin = false) {
    const id = this.triangle++;
    const offset = id * 9;
    this.positions.set([...a, ...b, ...c], offset);
    const kind = this.fish % 5;
    const patch = Math.sin(u * 13 + this.fish * 3.2) + Math.cos(side * 3.4 + u * 19 + this.fish);
    let hex = '#ece6d7';
    if (kind === 3) hex = '#d9a64c';
    else if (kind === 4) hex = '#b87731';
    else if (kind === 1 && u < 0.24) hex = '#ec5b2b';
    else if (kind !== 1 && patch > -0.05) hex = '#f17432';
    if (kind === 2 && patch < -0.7 && u > 0.2) hex = '#30343b';
    if (fin) hex = kind >= 3 ? '#c6ad78' : '#c9cecc';
    this.color.set(hex).multiplyScalar(0.86 + random(this.fish * 123 + id) * 0.28);
    for (let j = 0; j < 3; j++) this.color.toArray(this.colors, offset + j * 3);
  }

  update(spine: Float32Array, beat: number, sprint: number) {
    this.triangle = 0;
    const base = this.fish * 20;
    const center = (k: number): Point => [spine[base + k * 2], spine[base + k * 2 + 1], 0];
    const direction = (k: number) => {
      const a = center(Math.max(0, k - 1)), b = center(Math.min(9, k + 1));
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      return [(a[0] - b[0]) / d, (a[1] - b[1]) / d];
    };
    const rings: Point[][] = [];
    for (let k = 0; k <= 7; k++) {
      const u = k / 9;
      const x = Math.min(u / 0.8, 1);
      const width = HALF_WIDTH * (0.55 + 0.45 * SMOOTH(x / 0.3))
        * (1 - 0.82 * Math.pow(SMOOTH((x - 0.3) / 0.7), 0.8));
      const p = center(k), d = direction(k);
      rings.push(LANES.map(l => [p[0] - d[1] * l * width, p[1] + d[0] * l * width,
        HALF_WIDTH * 0.52 * Math.sqrt(Math.max(0, 1 - l * l)) * Math.sin(Math.PI * (0.12 + u * 0.85))]));
    }
    for (let k = 0; k < 7; k++) {
      for (let j = 0; j < 4; j++) {
        const a = rings[k][j], b = rings[k][j + 1], c = rings[k + 1][j], d = rings[k + 1][j + 1];
        const u = (k + 0.5) / 9, side = (LANES[j] + LANES[j + 1]) * 0.5;
        if ((k + j) % 2) { this.face(a, b, c, u, side); this.face(b, d, c, u, side); }
        else { this.face(a, b, d, u, side); this.face(a, d, c, u, side); }
      }
    }
    const head = center(0), forward = direction(0);
    const nose: Point = [head[0] + forward[0] * HALF_WIDTH * 0.5, head[1] + forward[1] * HALF_WIDTH * 0.5, HALF_WIDTH * 0.1];
    for (let j = 0; j < 4; j++) this.face(nose, rings[0][j + 1], rings[0][j], 0, LANES[j]);

    // Broad forked tail: six angular panels follow the final spine segments.
    const root = center(6), tip = center(9), td = direction(8);
    const tailPoint = (along: number, across: number): Point => [
      root[0] + (tip[0] - root[0]) * along - td[1] * across * HALF_WIDTH,
      root[1] + (tip[1] - root[1]) * along + td[0] * across * HALF_WIDTH, 0.001,
    ];
    const fan = [tailPoint(0, 0), tailPoint(0.58, -0.9), tailPoint(1.05, -1.35), tailPoint(0.76, 0), tailPoint(1.05, 1.35), tailPoint(0.58, 0.9)];
    for (let j = 1; j < fan.length - 1; j++) this.face(fan[0], fan[j], fan[j + 1], 0.9, j, true);

    // Pectoral fins fold towards the body when the fish accelerates.
    const flap = Math.sin(beat * 0.5 + this.fish * 3) * 0.2 * (1 - sprint);
    const p = center(2), d = direction(2);
    for (const side of [-1, 1]) {
      const local = (back: number, across: number): Point => [
        p[0] - d[0] * back * HALF_WIDTH - d[1] * across * side * HALF_WIDTH,
        p[1] - d[1] * back * HALF_WIDTH + d[0] * across * side * HALF_WIDTH, 0.0005,
      ];
      const root = local(0, 0.65), middle = local(0.8, 1.25);
      const outer = local(1.2, 1.85 + flap - sprint * 0.45), end = local(1.75, 0.9);
      this.face(root, middle, outer, 0.24, side, true);
      this.face(root, outer, end, 0.24, side, true);
    }
    this.setDrawRange(0, this.triangle * 3);
    this.getAttribute('position').needsUpdate = true;
    this.getAttribute('color').needsUpdate = true;
    this.computeVertexNormals();
  }
}
