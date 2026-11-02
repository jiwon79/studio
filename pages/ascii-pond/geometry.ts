import * as THREE from 'three';

export type Point = [number, number, number];
export const FISH_LENGTH = 0.17 * 1.15;
const HALF_WIDTH = FISH_LENGTH * 0.13;
const LANES = [-1, -0.8, -0.45, 0, 0.45, 0.8, 1];
const RINGS = [-0.065, -0.045, -0.02, 0.025, 0.07, 0.13, 0.21, 0.3, 0.4, 0.5, 0.6, 0.69, 0.76, 0.82];
const SMOOTH = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

export function bodyHalfWidth(u: number, scale = 1) {
  const width = HALF_WIDTH * scale;
  if (u < 0) return width * 0.55 * Math.sqrt(Math.max(0, 1 - (u / 0.0715) ** 2));
  const x = Math.min(u / 0.8, 1);
  return width * (0.55 + 0.45 * SMOOTH(x / 0.3))
    * (1 - 0.82 * Math.pow(SMOOTH((x - 0.3) / 0.7), 0.8));
}

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

  private face(a: Point, b: Point, c: Point, _u: number, side: number, part: 'skin' | 'fin' = 'skin') {
    const id = this.triangle++;
    const offset = id * 9;
    this.positions.set([...a, ...b, ...c], offset);
    // A restrained blue/white translation of the source's tonal patches.
    // Keep markings coherent across neighbouring triangles, rather than
    // painting random contrasting panels or introducing gold/brown varieties.
    this.color.set(part === 'fin' ? '#dceaff' : '#edf4ff');
    // Let geometry and neutral light describe the facets. Avoid rectangular
    // colour islands that make the body resemble a painted toy.
    if (part === 'skin') this.color.multiplyScalar(0.95 + Math.sqrt(Math.max(0, 1 - side * side)) * 0.05);
    for (let j = 0; j < 3; j++) this.color.toArray(this.colors, offset + j * 3);
  }

  update(spine: Float32Array, beat: number, sprint: number, scale = 1, pitch = 0) {
    const halfWidth = HALF_WIDTH * scale;
    this.triangle = 0;
    const frame = (u: number) => {
      const p = sampleSpine(spine, this.fish, u);
      const a = sampleSpine(spine, this.fish, u - 0.008), b = sampleSpine(spine, this.fish, u + 0.008);
      const length = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      return { p, dx: (a[0] - b[0]) / length, dy: (a[1] - b[1]) / length };
    };
    const surface = (u: number, lane: number, lift = 0): Point => {
      const { p, dx, dy } = frame(u);
      const width = bodyHalfWidth(u, scale);
      return [p[0] - dy * lane * width, p[1] + dx * lane * width,
        width * 0.38 * Math.sqrt(Math.max(0, 1 - lane * lane)) + lift];
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
    const nose = surface(-0.0715, 0);
    for (let j = 0; j < LANES.length - 1; j++) this.face(nose, rings[0][j + 1], rings[0][j], 0, LANES[j]);
    this.eyes[0] = surface(0.07, -0.62, 0.0012);
    this.eyes[1] = surface(0.07, 0.62, 0.0012);

    const skinVertices = this.triangle * 3;

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
      const innerA = tailPoint(0.76, a * 0.17), innerB = tailPoint(0.76, b * 0.17);
      const middleA = tailPoint(0.85, a * 0.82), middleB = tailPoint(0.85, b * 0.82);
      const tipA = tailPoint(0.72 + 0.28 * (0.7 + 0.45 * Math.abs(a) - 0.3 * a * a), a * 1.18);
      const tipB = tailPoint(0.72 + 0.28 * (0.7 + 0.45 * Math.abs(b) - 0.3 * b * b), b * 1.18);
      this.face(innerA, innerB, middleB, 0.9, a, 'fin');
      this.face(innerA, middleB, middleA, 0.9, b, 'fin');
      this.face(middleA, middleB, tipB, 1, a, 'fin');
      this.face(middleA, tipB, tipA, 1, b, 'fin');
    }

    // Match the source's small oval pectoral fans instead of broad wings.
    for (const side of [-1, 1]) {
      const u = 0.24;
      const { p, dx, dy } = frame(u);
      const flap = 0.25 * Math.sin(beat * 0.5 + this.fish * 3) * (1 - sprint) - 0.35 * sprint;
      const back = 0.9 - flap, out = 0.8 + flap, magnitude = Math.hypot(back, out);
      const fx = (-dx * back - dy * side * out) / magnitude;
      const fy = (-dy * back + dx * side * out) / magnitude;
      const root: Point = [p[0] - dy * side * halfWidth * 0.75,
        p[1] + dx * side * halfWidth * 0.75, 0.0006];
      const radius = halfWidth;
      const center: Point = [root[0] + fx * radius * 0.6, root[1] + fy * radius * 0.6, 0.0008];
      const rim = Array.from({length: 9}, (_, j): Point => {
        const angle = j / 8 * Math.PI * 2;
        return [center[0] + fx * Math.cos(angle) * radius * 0.75 - fy * Math.sin(angle) * radius * 0.4,
          center[1] + fy * Math.cos(angle) * radius * 0.75 + fx * Math.sin(angle) * radius * 0.4, 0.0008];
      });
      for (let j = 0; j < rim.length - 1; j++) this.face(root, rim[j], rim[j + 1], u, j, 'fin');
    }
    if (pitch) {
      const base = this.fish * 20;
      const hx = spine[base], hy = spine[base + 1];
      const dx = hx - spine[base + 2], dy = hy - spine[base + 3];
      const length = Math.hypot(dx, dy) || 1;
      const slope = (x: number, y: number) => -((x - hx) * dx + (y - hy) * dy) / length * pitch;
      for (let k = 0; k < this.triangle * 9; k += 3) this.positions[k + 2] += slope(this.positions[k], this.positions[k + 1]);
      this.eyes.forEach(eye => { eye[2] += slope(eye[0], eye[1]); });
    }
    this.clearGroups();
    this.addGroup(0, skinVertices, 0);
    this.addGroup(skinVertices, this.triangle * 3 - skinVertices, 1);
    this.setDrawRange(0, this.triangle * 3);
    this.getAttribute('position').needsUpdate = true;
    this.getAttribute('color').needsUpdate = true;
    this.computeVertexNormals();
  }
}
