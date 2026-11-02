/**
 * Swimming simulation adapted from Blake Cyze's MIT-licensed ittybitty/koi.
 * https://gist.github.com/blakecyze/fb5a6ce12207d06c82ea0b3a488244d4
 * See LICENSE and SOURCE.md in this directory.
 */
export const MAX_FISH = 10;
export const MAX_SCENE_FISH = 64;
export const SPINE_POINTS = 10;
export interface PointerState { target: [number, number]; over: boolean }
export interface SchoolContext {
  canvas: { clientWidth: number; clientHeight: number; width: number; height: number };
  options(): { size: number; interactive: boolean };
  isPaused?(index: number): boolean;
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
  let activeCount = MAX_FISH;
  const enabled = new Uint8Array(MAX_SCENE_FISH);
  const stretchX = new Float32Array(MAX_SCENE_FISH).fill(1);
  const stretchY = new Float32Array(MAX_SCENE_FISH).fill(1);
  const scales = new Float32Array(MAX_SCENE_FISH).fill(1);
  enabled.fill(1, 0, activeCount);
  const POINTS = 10;
  const TRAIL = 72;
  const STEP = 0.008;                                     // trail spacing, pond units
  const spineOut = new Float32Array(MAX_SCENE_FISH * POINTS * 2);
  const fishOut = new Float32Array(MAX_SCENE_FISH * 4);
  const trail = new Float32Array(MAX_SCENE_FISH * TRAIL * 2);
  const head = new Float32Array(MAX_SCENE_FISH * 2);
  const state = new Float32Array(MAX_SCENE_FISH * 4);           // heading, speed, beat, thrust
  const count = new Int32Array(MAX_SCENE_FISH);
  const start = new Int32Array(MAX_SCENE_FISH);
  let simTime = 0;
  let aspect = 1.6;

  // The pond's width in units of its height, from the canvas as laid out.
  const measure = () => {
    const c = ctx.canvas;
    const w = c.clientWidth || c.width;
    const h = c.clientHeight || c.height;
    return w > 0 && h > 0 ? w / h : 1.6;
  };

  // Reposition fish when the viewport changes without compressing their
  // local trajectories into hairpin turns on portrait screens.
  const fit = () => {
    const next = measure();
    if (Math.abs(next - aspect) < 1e-4) return;
    const k = next / aspect;
    for (let i = 0; i < activeCount; i++) {
      const shift = head[i * 2] * (k - 1);
      head[i * 2] += shift;
      for (let n = 0; n < TRAIL; n++) trail[(i * TRAIL + n) * 2] += shift;
    }
    aspect = next;
  };

  const reset = () => {
    aspect = measure();
    for (let i = 0; i < activeCount; i++) {
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
    const baseLength = 0.17 * (o.size ?? 1);
    const flee = live && pointerState.over && o.interactive !== false;
    const hx = pointerState.target[0] * aspect;
    const hy = pointerState.target[1];
    const t = simTime;
    for (let i = 0; i < activeCount; i++) {
      if (!enabled[i] || ctx.isPaused?.(i)) continue;
      const len = baseLength * scales[i];
      const base = len * 0.45;
      const x = head[i * 2];
      const y = head[i * 2 + 1];
      let a = state[i * 4];
      let v = state[i * 4 + 1];
      // Where it would like to go: straight on, bent by a slow wander.
      let dx = Math.cos(a);
      let dy = Math.sin(a);
      const wander = Math.sin(t * (0.21 + 0.2 * rnd(i * 2.1)) + i * 1.7) * 0.8 + Math.sin(t * (0.57 + 0.3 * rnd(i * 4.4)) + i * 4.1) * 0.45;
      // Keep to the pond: turn back from the edges.
      // Look ahead by one turning radius, including the rendered axis stretch.
      // Start a continuous turn before fins reach the edge; never reflect velocity.
      const lookAhead = 0.4;
      const pressure = (p: number, extent: number, margin: number) => {
        const smooth = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
        return smooth(1 - p / margin) - smooth(1 - (extent - p) / margin);
      };
      const marginX = Math.min(aspect * 0.48, 0.025 + len * 1.6 * stretchX[i]);
      const marginY = Math.min(0.48, 0.025 + len * 1.6 * stretchY[i]);
      const ex = pressure(x + dx * v * lookAhead, aspect, marginX);
      const ey = pressure(y + dy * v * lookAhead, 1, marginY);
      const edge = Math.min(1, Math.hypot(ex, ey));
      const approaching = Math.max(0, -(dx * ex + dy * ey));
      dx += ex * 5;
      dy += ey * 5;
      // Give the others room.
      for (let j = 0; j < activeCount; j++) {
        if (j === i || !enabled[j]) continue;
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
        const reach = 0.42 + len * 0.9;
        if (d < reach) {
          const proximity = 1 - d / reach;
          fright = proximity * (0.6 + 0.4 * proximity);
          dx += (fx / (d + 1e-6)) * fright * 12 * (1 - edge);
          dy += (fy / (d + 1e-6)) * fright * 12 * (1 - edge);
        }
      }
      // Turn towards where it wants to go, no faster than a fish can.
      const want = Math.atan2(dy, dx);
      let diff = want - a;
      diff -= Math.round(diff / (Math.PI * 2)) * Math.PI * 2;
      // A slow fish needs a wide turn: the previous fixed angular limit let
      // its head turn back into its own body before the tail could follow.
      const maxTurn = Math.min(1.4 + fright * 3, Math.max(0.35 + fright * 1.2, v / (len * 0.85)));
      const steering = diff * 2.5 + wander * 0.4 * (1 - fright) * (1 - edge);
      const turn = Math.max(-maxTurn, Math.min(maxTurn, steering));
      a += turn * dt;
      // Burst and glide: a few strong beats, then coasting.
      const cycle = (t * (0.16 + 0.08 * rnd(i * 9.1)) + rnd(i * 6.6)) % 1;
      const thrust = Math.max(cycle < 0.35 ? 1 : 0, fright);
      const target = base * (0.45 + 0.8 * thrust + 5.5 * fright * (1 - edge)) * (1 - 0.8 * approaching);
      v += (target - v) * (1 - Math.exp(-dt * (fright > 0 ? 10 : approaching > 0.1 ? 6 : 1.2)));
      const nx = x + Math.cos(a) * v * dt;
      const ny = y + Math.sin(a) * v * dt;
      head[i * 2] = nx;
      head[i * 2 + 1] = ny;
      state[i * 4] = a;
      state[i * 4 + 1] = v;
      // The tail beats faster the harder it swims, and barely at all in a glide.
      state[i * 4 + 2] += dt * Math.PI * 2 * (0.45 + 1.55 * (v / base) * (0.35 + 0.65 * thrust));
      state[i * 4 + 3] += (thrust + Math.abs(turn) * 0.15 - state[i * 4 + 3]) * (1 - Math.exp(-dt * 3));
      // Lay down the trail the body will follow.
      const last = ((start[i] + count[i] - 1) % TRAIL) * 2 + i * TRAIL * 2;
      if (Math.hypot(nx - trail[last], ny - trail[last + 1]) >= STEP * scales[i]) {
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
    const baseLength = 0.17 * (o.size ?? 1);
    for (let i = 0; i < activeCount; i++) {
      const len = baseLength * scales[i];
      const base = len * 0.45;
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
      // Read tangents from the unwarped path. Reading points already moved
      // by the wave makes the result depend on which end is visited first.
      const path = spineOut.slice(out, out + POINTS * 2);
      for (k = POINTS - 1; k >= 0; k--) {
        const u = k / (POINTS - 1);
        const a = Math.max(k - 1, 0) * 2;
        const b = Math.min(k + 1, POINTS - 1) * 2;
        let tx = path[a] - path[b];
        let ty = path[a + 1] - path[b + 1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        // Keep the head still; concentrate the travelling wave behind the
        // shoulders and through the tail rather than wiggling the whole fish.
        const sway = len * 0.075 * u * u * u * effort * Math.sin(beat - u * 5.5);
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
    get count() { return activeCount; },
    enabled(index: number) { return !!enabled[index]; },
    scale(index: number) { return scales[index]; },
    stretch(index: number) { return [stretchX[index], stretchY[index]] as const; },
    resizeUniform(index: number, pivot: readonly number[], ratio: number) {
      const before = scales[index];
      const applied = Math.max(Math.min(0.25, before), Math.min(4, before * ratio)) / before;
      this.transform(index, pivot, applied);
      return scales[index] / before;
    },
    resizeAxis(index: number, pivot: readonly number[], axis: 'x' | 'y', ratio: number) {
      const values = axis === 'x' ? stretchX : stretchY;
      const coordinate = axis === 'x' ? 0 : 1;
      const applied = Math.max(0.25, Math.min(4, values[index] * ratio)) / values[index];
      const delta = (head[index * 2 + coordinate] - pivot[coordinate]) * (applied - 1);
      values[index] *= applied;
      this.transform(index, [0, 0], 1, axis === 'x' ? delta : 0, axis === 'y' ? delta : 0);
      return applied;
    },
    addFish(x: number, y: number, angle: number, scale: number) {
      let index = enabled.findIndex((value, i) => i < activeCount && !value);
      if (index < 0) {
        if (activeCount >= MAX_SCENE_FISH) return -1;
        index = activeCount++;
      }
      enabled[index] = 1;
      scales[index] = scale;
      stretchX[index] = 1; stretchY[index] = 1;
      head[index * 2] = x;
      head[index * 2 + 1] = y;
      const base = 0.17 * ctx.options().size * scale * 0.45;
      state.set([angle, base, 0, 0], index * 4);
      for (let k = 0; k < TRAIL; k++) {
        const j = (index * TRAIL + k) * 2;
        trail[j] = x - Math.cos(angle) * STEP * scale * (TRAIL - 1 - k);
        trail[j + 1] = y - Math.sin(angle) * STEP * scale * (TRAIL - 1 - k);
      }
      count[index] = TRAIL;
      start[index] = 0;
      write();
      return index;
    },
    removeFish(index: number) { enabled[index] = 0; },
    transform(index: number, pivot: readonly number[], scale: number, dx = 0, dy = 0) {
      head[index * 2] = pivot[0] + (head[index * 2] - pivot[0]) * scale + dx;
      head[index * 2 + 1] = pivot[1] + (head[index * 2 + 1] - pivot[1]) * scale + dy;
      for (let k = 0; k < TRAIL; k++) {
        const j = (index * TRAIL + k) * 2;
        trail[j] = pivot[0] + (trail[j] - pivot[0]) * scale + dx;
        trail[j + 1] = pivot[1] + (trail[j + 1] - pivot[1]) * scale + dy;
      }
      scales[index] *= scale;
      state[index * 4 + 1] *= scale;
      write();
    },
    capture() {
      return { activeCount, enabled: enabled.slice(), scales: scales.slice(), stretchX: stretchX.slice(), stretchY: stretchY.slice(), head: head.slice(),
        state: state.slice(), trail: trail.slice(), count: count.slice(), start: start.slice(), simTime, aspect };
    },
    restoreFish(index: number, saved: { activeCount: number; enabled: Uint8Array; scales: Float32Array; stretchX: Float32Array; stretchY: Float32Array; head: Float32Array;
      state: Float32Array; trail: Float32Array; count: Int32Array; start: Int32Array }) {
      if (index >= saved.activeCount || !saved.enabled[index]) { enabled[index] = 0; return; }
      activeCount = Math.max(activeCount, index + 1);
      enabled[index] = 1; scales[index] = saved.scales[index];
      stretchX[index] = saved.stretchX[index]; stretchY[index] = saved.stretchY[index];
      head.set(saved.head.subarray(index * 2, index * 2 + 2), index * 2);
      state.set(saved.state.subarray(index * 4, index * 4 + 4), index * 4);
      trail.set(saved.trail.subarray(index * TRAIL * 2, (index + 1) * TRAIL * 2), index * TRAIL * 2);
      count[index] = saved.count[index]; start[index] = saved.start[index];
      write();
    },
    restore(saved: { activeCount: number; enabled: Uint8Array; scales: Float32Array; stretchX: Float32Array; stretchY: Float32Array; head: Float32Array;
      state: Float32Array; trail: Float32Array; count: Int32Array; start: Int32Array; simTime: number; aspect: number }) {
      activeCount = saved.activeCount;
      enabled.set(saved.enabled); scales.set(saved.scales);
      stretchX.set(saved.stretchX); stretchY.set(saved.stretchY); head.set(saved.head);
      state.set(saved.state); trail.set(saved.trail); count.set(saved.count); start.set(saved.start);
      simTime = saved.simTime; aspect = saved.aspect;
      fit(); write();
    },
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
