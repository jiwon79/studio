import * as THREE from 'three';

export type Point = [number, number, number];
export const FISH_LENGTH = 0.17 * 1.15;
const HALF_WIDTH = FISH_LENGTH * 0.13;
const LANES = [-1, -0.8, -0.45, 0, 0.45, 0.8, 1];
const RINGS = [-0.035, 0, 0.045, 0.1, 0.17, 0.25, 0.34, 0.43, 0.52, 0.61, 0.69, 0.75, 0.8, 0.83];
const SMOOTH = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const random = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Sample a smooth centreline without increasing the simulation's ten bones.
// Endpoints are extrapolated, so the nose and tail keep a nonzero tangent.
export function sampleSpine(spine: Float32Array, fish: number, u: number): Point {
  const base = fish * 20;
  const component = (k: number, axis: number): number => {
    if (k < 0) return 2 * spine[base + axis] - spine[base + 2 + axis];
    if (k > 9) return 2 * spine[base + 18 + axis] - spine[base + 16 + axis];
    return spine[base + k * 2 + axis];
  };
  if (u < 0 || u > 1) {
    const k = u < 0 ? 0 : 9, neighbour = u < 0 ? 1 : 8;
    const delta = u < 0 ? -u * 9 : (u - 1) * 9;
    return [0, 1].map(axis => component(k, axis) + (component(k, axis) - component(neighbour, axis)) * delta).concat(0) as Point;
  }
  const k = Math.min(8, Math.floor(u * 9)), t = u * 9 - k;
  const xy = [0, 1].map(axis => {
    const a = component(k - 1, axis), b = component(k, axis), c = component(k + 1, axis), d = component(k + 2, axis);
    return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  });
  return [xy[0], xy[1], 0];
}

// Independent triangle vertices keep the facets crisp while the centreline bends.
export class FishGeometry extends THREE.BufferGeometry {
  private readonly positions = new Float32Array(320 * 9);
  private readonly colors = new Float32Array(320 * 9);
  private triangle = 0;
  private readonly color = new THREE.Color();
  readonly eyes: [Point, Point] = [[0, 0, 0], [0, 0, 0]];
  constructor(private readonly fish: number) {
    super();
    this.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
  }

  private face(a: Point, b: Point, c: Point, u: number, side: number, part: 'skin' | 'fin' | 'gill' = 'skin') {
    const id = this.triangle++;
    const offset = id * 9;
    this.positions.set([...a, ...b, ...c], offset);
    const kind = this.fish % 5;
    const patch = Math.sin(u * 13 + this.fish * 3.2) + Math.cos(side * 3.4 + u * 19 + this.fish);
    let hex = '#ece6d7';
    if (kind === 3) hex = '#d9a64c';
    else if (kind === 4) hex = '#b87731';
    else if (kind === 1 && u < 0.2) hex = '#ec5b2b';
    else if (kind !== 1 && patch > -0.05) hex = '#f17432';
    if (kind === 2 && patch < -0.7 && u > 0.2) hex = '#30343b';
    if (part === 'fin') hex = kind >= 3 ? '#c6ad78' : '#c9cecc';
    if (part === 'gill') hex = kind >= 3 ? '#86613c' : '#a39b8a';
    const shade = part === 'fin' ? 0.85 + (id % 3) * 0.08 : 0.95 + random(this.fish * 123 + id) * 0.1;
    this.color.set(hex).multiplyScalar(shade);
    for (let j = 0; j < 3; j++) this.color.toArray(this.colors, offset + j * 3);
  }

  update(spine: Float32Array, beat: number, sprint: number, scale = 1) {
    const halfWidth = HALF_WIDTH * scale;
    this.triangle = 0;
    const frame = (u: number) => {
      const p = sampleSpine(spine, this.fish, u);
      const a = sampleSpine(spine, this.fish, u - 0.008), b = sampleSpine(spine, this.fish, u + 0.008);
      const length = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      return { p, dx: (a[0] - b[0]) / length, dy: (a[1] - b[1]) / length };
    };
    const widthAt = (u: number) => {
      if (u < 0) return halfWidth * (0.53 + u * 8);
      const x = Math.min(u / 0.83, 1);
      return halfWidth * (0.53 + 0.47 * SMOOTH(x / 0.3))
        * (1 - 0.86 * Math.pow(SMOOTH((x - 0.3) / 0.7), 0.8));
    };
    const surface = (u: number, lane: number, lift = 0): Point => {
      const { p, dx, dy } = frame(u);
      const width = widthAt(u);
      return [p[0] - dy * lane * width, p[1] + dx * lane * width,
        width * 0.62 * Math.sqrt(Math.max(0, 1 - lane * lane)) + lift];
    };
    const rings = RINGS.map(u => LANES.map(lane => surface(u, lane)));
    for (let k = 0; k < rings.length - 1; k++) {
      for (let j = 0; j < LANES.length - 1; j++) {
        const a = rings[k][j], b = rings[k][j + 1], c = rings[k + 1][j], d = rings[k + 1][j + 1];
        const u = (RINGS[k] + RINGS[k + 1]) * 0.5, side = (LANES[j] + LANES[j + 1]) * 0.5;
        if ((k + j) % 2) { this.face(a, b, c, u, side); this.face(b, d, c, u, side); }
        else { this.face(a, b, d, u, side); this.face(a, d, c, u, side); }
      }
    }
    // Short, broad snout instead of a single pointed triangle.
    const nose = surface(-0.045, 0);
    for (let j = 0; j < LANES.length - 1; j++) this.face(nose, rings[0][j + 1], rings[0][j], 0, LANES[j]);
    this.eyes[0] = surface(0.045, -0.72, 0.0018);
    this.eyes[1] = surface(0.045, 0.72, 0.0018);

    // Gill covers are fine faceted seams that move with the shoulders.
    for (const side of [-1, 1]) {
      for (const [a, b] of [[0.45, 0.7], [0.7, 0.9]]) {
        this.face(surface(0.175, a * side, 0.0003), surface(0.175, b * side, 0.0003), surface(0.186, b * side, 0.0003), 0.18, side, 'gill');
      }
    }

    // Each ray samples its own position and tangent along the tail. It flexes
    // through the peduncle instead of pivoting as one rigid arrow-shaped plate.
    const tailPoint = (u: number, across: number): Point => {
      const { p, dx, dy } = frame(u);
      return [p[0] - dy * across * halfWidth, p[1] + dx * across * halfWidth,
        0.001 + Math.abs(across) * 0.001 * Math.sin(beat - u * 5.5)];
    };
    const tailLanes = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1];
    for (let j = 0; j < tailLanes.length - 1; j++) {
      const a = tailLanes[j], b = tailLanes[j + 1];
      const innerA = tailPoint(0.8, a * 0.16), innerB = tailPoint(0.8, b * 0.16);
      const middleA = tailPoint(0.92, a * 0.87), middleB = tailPoint(0.92, b * 0.87);
      const tipA = tailPoint(0.95 + Math.abs(a) * 0.1, a * 1.15);
      const tipB = tailPoint(0.95 + Math.abs(b) * 0.1, b * 1.15);
      this.face(innerA, innerB, middleB, 0.9, a, 'fin');
      this.face(innerA, middleB, middleA, 0.9, b, 'fin');
      this.face(middleA, middleB, tipB, 1, a, 'fin');
      this.face(middleA, tipB, tipA, 1, b, 'fin');
    }

    // Ribbed pectoral and smaller pelvic fins, sculling rather than simply
    // changing their width. Their roots sit beneath the body surface.
    for (const side of [-1, 1]) {
      for (const pelvic of [false, true]) {
        const u = pelvic ? 0.54 : 0.21, scale = pelvic ? 0.55 : 1;
        const { p, dx, dy } = frame(u);
        const flap = Math.sin(beat * 0.55 + this.fish * 2 + side * 0.25) * (1 - sprint) * 0.18;
        const local = (back: number, across: number): Point => [
          p[0] - dx * back * halfWidth * scale - dy * across * side * halfWidth,
          p[1] - dy * back * halfWidth * scale + dx * across * side * halfWidth,
          0.0005 + Math.max(0, across - 0.7) * flap * 0.006,
        ];
        const root = local(0, pelvic ? 0.38 : 0.72);
        const rim = [[0.25, 1.08], [0.72, 1.55], [1.3, 1.7], [1.8, 1.45], [2, 0.9]].map(([back, across]) =>
          local(back + flap * (across - 0.7), (pelvic ? 0.35 : 0.7) + (across - 0.7) * scale * (1 - sprint * 0.22)));
        for (let j = 0; j < rim.length - 1; j++) this.face(root, rim[j], rim[j + 1], u, j, 'fin');
      }
    }
    // A low dorsal ridge with individual rays, visible as the fish bends.
    for (let k = 0; k < 4; k++) {
      const a = 0.3 + k * 0.06, b = a + 0.06;
      const ridge = surface((a + b) * 0.5, 0, halfWidth * 0.23 * Math.sin((k + 0.5) / 4 * Math.PI));
      this.face(surface(a, -0.1), ridge, surface(b, 0.1), a, k, 'fin');
    }
    this.setDrawRange(0, this.triangle * 3);
    this.getAttribute('position').needsUpdate = true;
    this.getAttribute('color').needsUpdate = true;
    this.computeVertexNormals();
  }
}
