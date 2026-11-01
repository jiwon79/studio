import { test, expect } from 'vitest';
import { createSchool, MAX_FISH, type PointerState } from './school';
import { FishGeometry, FISH_LENGTH } from './geometry';

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
