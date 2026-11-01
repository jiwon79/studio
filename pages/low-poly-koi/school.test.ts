import { test, expect } from 'vitest';
import { createSchool, MAX_FISH, type PointerState } from './school';
import { FishGeometry, FISH_LENGTH, sampleSpine } from './geometry';

function pond(width = 1440, height = 900) {
  const canvas = { clientWidth: width, clientHeight: height, width, height };
  const pointer: PointerState = { target: [0.5, 0.5], over: false };
  const output: Record<string, Float32Array> = {};
  const school = createSchool({ canvas, options: () => ({ size: 1.15, interactive: true }),
    uniform: (name, value) => { output[name] = value; },
  }, pointer);
  return { canvas, pointer, output, school };
}

test('the same elapsed time and inputs reproduce the swimming trajectory', () => {
  const a = pond(), b = pond();
  for (let step = 0; step <= 300; step++) {
    a.school.frame(step / 60);
    b.school.frame(step / 60);
  }
  expect(a.output.uSpine).toEqual(b.output.uSpine);
  expect(a.output.uFish).toEqual(b.output.uFish);
});

test('a nearby pointer makes a fish sprint compared with undisturbed swimming', () => {
  const normal = pond(), disturbed = pond();
  normal.school.frame(0);
  disturbed.school.frame(0);
  for (let step = 1; step <= 30; step++) {
    const spine = disturbed.output.uSpine;
    disturbed.pointer.target = [(spine[0] + 0.03) / 1.6, spine[1]];
    disturbed.pointer.over = true;
    normal.school.frame(step / 60);
    disturbed.school.frame(step / 60);
  }
  expect(disturbed.output.uFish[1]).toBeGreaterThan(normal.output.uFish[1] + 0.2);
  expect(disturbed.output.uSpine).not.toEqual(normal.output.uSpine);
});

test('cruising turns do not fold the shoulders back towards the head', () => {
  const p = pond();
  let largest = 0;
  for (let step = 0; step <= 1800; step++) {
    p.school.frame(step / 60);
    const spine = p.output.uSpine;
    for (let fish = 0; fish < MAX_FISH; fish++) {
      const base = fish * 20;
      const ax = spine[base] - spine[base + 2], ay = spine[base + 1] - spine[base + 3];
      const bx = spine[base] - spine[base + 8], by = spine[base + 1] - spine[base + 9];
      const cosine = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
      largest = Math.max(largest, Math.acos(Math.max(-1, Math.min(1, cosine))));
    }
  }
  expect(largest).toBeLessThan(0.8);
});

test('refined centreline is continuous across the simulation bones', () => {
  const p = pond();
  p.school.frame(10);
  for (let fish = 0; fish < MAX_FISH; fish++) {
    for (let bone = 1; bone < 9; bone++) {
      const u = bone / 9, epsilon = 1e-5;
      const left = sampleSpine(p.output.uSpine, fish, u - epsilon);
      const at = sampleSpine(p.output.uSpine, fish, u);
      const right = sampleSpine(p.output.uSpine, fish, u + epsilon);
      expect(at[0]).toBeCloseTo(p.output.uSpine[fish * 20 + bone * 2], 6);
      expect(at[1]).toBeCloseTo(p.output.uSpine[fish * 20 + bone * 2 + 1], 6);
      for (const axis of [0, 1]) expect(Math.abs((at[axis] - left[axis]) / epsilon - (right[axis] - at[axis]) / epsilon)).toBeLessThan(0.001);
    }
  }
});

test('portrait resize preserves the local path shape instead of squeezing a fish sideways', () => {
  const p = pond();
  p.school.frame(5);
  const before = p.output.uSpine.slice();
  p.canvas.clientWidth = 390;
  p.canvas.clientHeight = 844;
  p.school.frame(5);
  for (let fish = 0; fish < MAX_FISH; fish++) {
    const base = fish * 20;
    for (let bone = 1; bone < 10; bone++) {
      for (const axis of [0, 1]) {
        const at = base + bone * 2 + axis;
        expect(p.output.uSpine[at] - p.output.uSpine[base + axis]).toBeCloseTo(before[at] - before[base + axis], 5);
      }
    }
  }
});

test('angular geometry remains finite and attached to its fish after mobile resizing', () => {
  const p = pond();
  p.school.frame(5);
  p.canvas.clientWidth = 390;
  p.canvas.clientHeight = 844;
  for (let step = 301; step <= 900; step++) p.school.frame(step / 60);
  for (let i = 0; i < MAX_FISH; i++) {
    const geometry = new FishGeometry(i);
    geometry.update(p.output.uSpine, p.output.uFish[i * 4], p.output.uFish[i * 4 + 1]);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    expect(geometry.drawRange.count).toBeGreaterThan(0);
    const x = p.output.uSpine[i * 20], y = p.output.uSpine[i * 20 + 1];
    for (let vertex = 0; vertex < geometry.drawRange.count; vertex++) {
      expect(Number.isFinite(normal.getX(vertex) + normal.getY(vertex) + normal.getZ(vertex))).toBe(true);
      expect(Math.hypot(position.getX(vertex) - x, position.getY(vertex) - y)).toBeLessThan(FISH_LENGTH * 1.5);
    }
    geometry.dispose();
  }
});

test('offscreen edits retain their position and size without automatic containment', () => {
  const p = pond();
  const id = p.school.addFish(2, -0.2, 0, 4);
  expect(p.school.scale(id)).toBe(4);
  expect(p.output.uSpine[id * 20]).toBeCloseTo(2);
  expect(p.output.uSpine[id * 20 + 1]).toBeCloseTo(-0.2);
  p.school.resizeAxis(id, [2, -0.2], 'x', 4);
  expect(p.school.scale(id)).toBe(4);
  expect(p.school.stretch(id)).toEqual([4, 1]);
  expect(p.output.uSpine[id * 20]).toBeCloseTo(2);
  expect(p.output.uSpine[id * 20 + 1]).toBeCloseTo(-0.2);
  p.school.frame(0);
  expect(p.output.uSpine[id * 20]).toBeCloseTo(2);
  expect(p.school.scale(id)).toBe(4);
});

test('an outward fish turns continuously instead of reflecting its heading at the wall', () => {
  const p = pond();
  const id = p.school.addFish(1.55, 0.5, 0, 1.5);
  let previous = p.school.capture().state[id * 4];
  let largestTurn = 0, turned = false;
  for (let step = 1; step <= 1200; step++) {
    p.school.frame(step / 60);
    const angle = p.school.capture().state[id * 4];
    const difference = Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous));
    largestTurn = Math.max(largestTurn, Math.abs(difference));
    if (Math.cos(angle) < -0.5) turned = true;
    previous = angle;
  }
  expect(turned).toBe(true);
  expect(largestTurn).toBeLessThan(0.03);
});


test('free swimming uses the outer pond without lingering only in the centre', () => {
  const p = pond();
  let samples = 0, nearEdge = 0;
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (let step = 0; step <= 7200; step++) {
    p.school.frame(step / 60);
    if (step <= 600) continue;
    for (let i = 0; i < MAX_FISH; i++) {
      const x = p.output.uSpine[i * 20] / 1.6, y = p.output.uSpine[i * 20 + 1];
      samples++;
      if (Math.min(x, 1 - x, y, 1 - y) < 0.2) nearEdge++;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  expect(nearEdge / samples).toBeGreaterThan(0.2);
  expect(nearEdge / samples).toBeLessThan(0.5);
  expect(minX).toBeLessThan(0.13);
  expect(maxX).toBeGreaterThan(0.87);
  expect(minY).toBeLessThan(0.16);
  expect(maxY).toBeGreaterThan(0.86);
});
