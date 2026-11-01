/**
 * Swimming simulation adapted from Blake Cyze's MIT-licensed ittybitty/koi.
 * https://gist.github.com/blakecyze/fb5a6ce12207d06c82ea0b3a488244d4
 * See LICENSE and SOURCE.md in this directory.
 */
export const MAX_FISH = 10;
export const SPINE_POINTS = 10;
export interface PointerState { target: [number, number]; over: boolean }
export interface SchoolContext {
  canvas: { clientWidth: number; clientHeight: number; width: number; height: number };
  options(): { size: number; interactive: boolean };
  uniform(name: 'uSpine' | 'uFish', value: Float32Array): void;
}

/** Deterministic 0..1 noise from a number, for the school's starting state. */
const rnd = (/** @type {number} */ n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * The school, simulated on the CPU: each fish wanders in slow loops, keeps
 * to the pond and out of the others' way, swims in bursts and glides, and
 * turns and sprints away from the pointer. Its body follows the path its
 * head has actually swum, with a wave running down it that beats faster the
 * harder it swims. Deterministic in effect time, so seeking replays it.
 *
 * @param ctx Simulation inputs and uniform outputs.
 * @param {{ target: number[], over: boolean }} pointerState
 */
export function createSchool(ctx: SchoolContext, pointerState: PointerState) {
  const POINTS = 10;
  const TRAIL = 72;
  const STEP = 0.008;                                     // trail spacing, pond units
  const spineOut = new Float32Array(MAX_FISH * POINTS * 2);
  const fishOut = new Float32Array(MAX_FISH * 4);
  const trail = new Float32Array(MAX_FISH * TRAIL * 2);
  const head = new Float32Array(MAX_FISH * 2);
  const state = new Float32Array(MAX_FISH * 4);           // heading, speed, beat, thrust
  const count = new Int32Array(MAX_FISH);
  const start = new Int32Array(MAX_FISH);
  let simTime = 0;
  let aspect = 1.6;

  // The pond's width in units of its height, from the canvas as laid out.
  const measure = () => {
    const c = ctx.canvas;
    const w = c.clientWidth || c.width;
    const h = c.clientHeight || c.height;
    return w > 0 && h > 0 ? w / h : 1.6;
  };

  // When the canvas changes shape, stretch the school with it.
  const fit = () => {
    const next = measure();
    if (Math.abs(next - aspect) < 1e-4) return;
    const k = next / aspect;
    for (let i = 0; i < MAX_FISH; i++) head[i * 2] *= k;
    for (let j = 0; j < trail.length; j += 2) trail[j] *= k;
    aspect = next;
  };

  const reset = () => {
    aspect = measure();
    for (let i = 0; i < MAX_FISH; i++) {
      const x = aspect * (0.15 + 0.7 * rnd(i * 3.1));
      const y = 0.15 + 0.7 * rnd(i * 7.7);
      const a = rnd(i * 5.3) * Math.PI * 2;
      head[i * 2] = x;
      head[i * 2 + 1] = y;
      state[i * 4] = a;
      state[i * 4 + 1] = 0.05;
      state[i * 4 + 2] = rnd(i * 1.3) * 6;
      state[i * 4 + 3] = 0;
      // A straight trail behind it to start from.
      for (let k = 0; k < TRAIL; k++) {
        const j = (i * TRAIL + k) * 2;
        trail[j] = x - Math.cos(a) * STEP * (TRAIL - k);
        trail[j + 1] = y - Math.sin(a) * STEP * (TRAIL - k);
      }
      count[i] = TRAIL;
      start[i] = 0;
    }
    simTime = 0;
  };

  /** @param {number} dt @param {boolean} live */
  const step = (dt: number, live: boolean) => {
    const o = ctx.options();
    const len = 0.17 * (o.size ?? 1);
    const base = len * 0.45;
    const flee = live && pointerState.over && o.interactive !== false;
    const hx = pointerState.target[0] * aspect;
    const hy = pointerState.target[1];
    const t = simTime;
    for (let i = 0; i < MAX_FISH; i++) {
      const x = head[i * 2];
      const y = head[i * 2 + 1];
      let a = state[i * 4];
      let v = state[i * 4 + 1];
      // Where it would like to go: straight on, bent by a slow wander.
      let dx = Math.cos(a);
      let dy = Math.sin(a);
      const wander = Math.sin(t * (0.21 + 0.2 * rnd(i * 2.1)) + i * 1.7) * 0.8 + Math.sin(t * (0.57 + 0.3 * rnd(i * 4.4)) + i * 4.1) * 0.45;
      // Keep to the pond: turn back from the edges.
      const margin = 0.12 + len * 0.5;
      const ex = x < margin ? (margin - x) / margin : x > aspect - margin ? -(x - aspect + margin) / margin : 0;
      const ey = y < margin ? (margin - y) / margin : y > 1 - margin ? -(y - 1 + margin) / margin : 0;
      dx += ex * 3;
      dy += ey * 3;
      // Give the others room.
      for (let j = 0; j < MAX_FISH; j++) {
        if (j === i) continue;
        const ox = x - head[j * 2];
        const oy = y - head[j * 2 + 1];
        const d2 = ox * ox + oy * oy;
        const r = len * 0.9;
        if (d2 < r * r && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          dx += (ox / d) * (1 - d / r) * 1.5;
          dy += (oy / d) * (1 - d / r) * 1.5;
        }
      }
      // Flee the pointer: turn away and sprint.
      let fright = 0;
      if (flee) {
        const fx = x - hx;
        const fy = y - hy;
        const d = Math.hypot(fx, fy);
        const reach = 0.16 + len * 0.6;
        if (d < reach) {
          fright = (1 - d / reach) ** 2;
          dx += (fx / (d + 1e-6)) * fright * 8;
          dy += (fy / (d + 1e-6)) * fright * 8;
        }
      }
      // Turn towards where it wants to go, no faster than a fish can.
      const want = Math.atan2(dy, dx);
      let diff = want - a;
      diff -= Math.round(diff / (Math.PI * 2)) * Math.PI * 2;
      const maxTurn = 1.4 + fright * 6;
      const turn = Math.max(-maxTurn, Math.min(maxTurn, diff * 2.5)) + wander * 0.5 * (1 - fright);
      a += turn * dt;
      // Burst and glide: a few strong beats, then coasting.
      const cycle = (t * (0.16 + 0.08 * rnd(i * 9.1)) + rnd(i * 6.6)) % 1;
      const thrust = Math.max(cycle < 0.35 ? 1 : 0, fright);
      const target = base * (0.45 + 0.8 * thrust + 3.2 * fright);
      v += (target - v) * (1 - Math.exp(-dt * (fright > 0 ? 6 : 1.2)));
      const nx = x + Math.cos(a) * v * dt;
      const ny = y + Math.sin(a) * v * dt;
      head[i * 2] = nx;
      head[i * 2 + 1] = ny;
      state[i * 4] = a;
      state[i * 4 + 1] = v;
      // The tail beats faster the harder it swims, and barely at all in a glide.
      state[i * 4 + 2] += dt * Math.PI * 2 * (0.6 + 2.6 * (v / base) * (0.35 + 0.65 * thrust));
      state[i * 4 + 3] += (thrust + Math.abs(turn) * 0.15 - state[i * 4 + 3]) * (1 - Math.exp(-dt * 3));
      // Lay down the trail the body will follow.
      const last = ((start[i] + count[i] - 1) % TRAIL) * 2 + i * TRAIL * 2;
      if (Math.hypot(nx - trail[last], ny - trail[last + 1]) >= STEP) {
        const next = ((start[i] + count[i]) % TRAIL) * 2 + i * TRAIL * 2;
        trail[next] = nx;
        trail[next + 1] = ny;
        if (count[i] < TRAIL) count[i]++;
        else start[i] = (start[i] + 1) % TRAIL;
      }
    }
  };

  // The spine: walk back from the head along the trail, sampling points
  // evenly by length, then add the swimming wave across it.
  const write = () => {
    const o = ctx.options();
    const len = 0.17 * (o.size ?? 1);
    const base = len * 0.45;
    for (let i = 0; i < MAX_FISH; i++) {
      let px = head[i * 2];
      let py = head[i * 2 + 1];
      let k = 0;
      let walked = 0;
      let want = 0;
      const out = i * POINTS * 2;
      spineOut[out] = px;
      spineOut[out + 1] = py;
      k = 1;
      want = len / (POINTS - 1);
      for (let n = count[i] - 1; n >= 0 && k < POINTS; n--) {
        const j = ((start[i] + n) % TRAIL) * 2 + i * TRAIL * 2;
        const qx = trail[j];
        const qy = trail[j + 1];
        let seg = Math.hypot(qx - px, qy - py);
        while (k < POINTS && walked + seg >= want) {
          const f = (want - walked) / Math.max(seg, 1e-9);
          px += (qx - px) * f;
          py += (qy - py) * f;
          seg -= want - walked;
          walked = want;
          spineOut[out + k * 2] = px;
          spineOut[out + k * 2 + 1] = py;
          k++;
          want = (len * k) / (POINTS - 1);
        }
        walked += seg;
        px = qx;
        py = qy;
      }
      for (; k < POINTS; k++) {
        spineOut[out + k * 2] = px;
        spineOut[out + k * 2 + 1] = py;
      }
      // The wave: small at the head, sweeping wide at the tail.
      const beat = state[i * 4 + 2];
      const effort = 0.35 + 0.65 * state[i * 4 + 3];
      for (k = POINTS - 1; k >= 0; k--) {
        const u = k / (POINTS - 1);
        const a = out + Math.max(k - 1, 0) * 2;
        const b = out + Math.min(k + 1, POINTS - 1) * 2;
        let tx = spineOut[a] - spineOut[b];
        let ty = spineOut[a + 1] - spineOut[b + 1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const sway = len * (0.012 + 0.1 * u * u) * effort * Math.sin(beat - u * 5.5);
        spineOut[out + k * 2] += -ty * sway;
        spineOut[out + k * 2 + 1] += tx * sway;
      }
      fishOut[i * 4] = beat;
      fishOut[i * 4 + 1] = Math.min(1, Math.max(0, (state[i * 4 + 1] - base) / (base * 2.5)));
    }
    ctx.uniform('uSpine', spineOut);
    ctx.uniform('uFish', fishOut);
  };

  reset();
  return {
    /** @param {number} time Effect time. */
    frame(time: number) {
      fit();
      // Seeking back, or far ahead: replay from the start, a little coarser.
      if (time < simTime - 1e-6 || time - simTime > 30) {
        reset();
        while (simTime + 1 / 30 <= time) {
          step(1 / 30, false);
          simTime += 1 / 30;
        }
      }
      while (simTime + 1 / 60 <= time) {
        step(1 / 60, true);
        simTime += 1 / 60;
      }
      write();
    },
  };
}
