import { test, expect } from 'vitest';
import { cornerResize, edgeResize, sketchFootprint } from './editor-model';
import { createSchool, MAX_FISH } from './school';
import { ASCII_SIZES, isAsciiSize } from './ascii';
import { Scene } from 'three';
import { WaterRipples } from './ripples';
import { FishGeometry } from './geometry';

function pond() {
  const output: Record<string, Float32Array> = {};
  const school = createSchool({
    canvas: { width: 1440, height: 900, clientWidth: 1440, clientHeight: 900 },
    options: () => ({ size: 1.15, interactive: true }),
    uniform: (name, value) => { output[name] = value; },
  }, { target: [0.5, 0.5], over: false });
  school.frame(0);
  return { school, output };
}

test('the four character sizes are evenly spaced within the requested endpoints', () => {
  const sizes = Object.values(ASCII_SIZES);
  expect(sizes).toHaveLength(4);
  expect(sizes[0]).toBe(6);
  expect(sizes[3]).toBe(4);
  for (let i = 1; i < sizes.length; i++) expect(sizes[i - 1] - sizes[i]).toBeCloseTo(2 / 3);
  expect(isAsciiSize('fine')).toBe(false);
  expect(isAsciiSize('micro')).toBe(false);
});

test('a drawn outline gives an oriented footprint, while a tap creates nothing', () => {
  expect(sketchFootprint([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 1 }])).toBeNull();
  const points = Array.from({ length: 40 }, (_, i) => {
    const t = i / 40 * Math.PI * 2, x = Math.cos(t) * 80, y = Math.sin(t) * 20;
    return { x: 200 + (x - y) / Math.sqrt(2), y: 300 + (x + y) / Math.sqrt(2) };
  });
  const footprint = sketchFootprint(points)!;
  expect(footprint.center.x).toBeCloseTo(200);
  expect(footprint.center.y).toBeCloseTo(300);
  expect(footprint.angle).toBeCloseTo(Math.PI / 4);
  expect(footprint.length).toBeCloseTo(160);
});

test('corner resizing anchors the opposite corner and does not invert the fish', () => {
  const box = { x: 100, y: 200, width: 120, height: 60 };
  expect(cornerResize(box, 'se', { x: 340, y: 320 })).toEqual({ pivot: { x: 100, y: 200 }, scale: 2 });
  expect(cornerResize(box, 'nw', { x: -20, y: 140 })).toEqual({ pivot: { x: 220, y: 260 }, scale: 2 });
  expect(cornerResize(box, 'se', { x: 50, y: 50 }).scale).toBeGreaterThan(0);
});

test('adding, moving and scaling affects the actual simulation and restores through undo', () => {
  const { school, output } = pond();
  const original = school.capture();
  const id = school.addFish(0.8, 0.5, 0, 1.2);
  expect(id).toBe(MAX_FISH);
  expect(school.enabled(id)).toBe(true);
  const before = output.uSpine.slice(id * 20, id * 20 + 20);
  school.transform(id, [0.8, 0.5], 1.5, 0.1, -0.05);
  const after = output.uSpine.slice(id * 20, id * 20 + 20);
  for (let k = 0; k < 10; k++) {
    expect(after[k * 2]).toBeCloseTo(0.8 + (before[k * 2] - 0.8) * 1.5 + 0.1, 5);
    expect(after[k * 2 + 1]).toBeCloseTo(0.5 + (before[k * 2 + 1] - 0.5) * 1.5 - 0.05, 5);
  }
  const edited = school.capture();
  school.frame(1 / 30);
  expect(output.uSpine[id * 20]).toBeGreaterThan(after[0]);
  school.restore(original);
  expect(school.count).toBe(MAX_FISH);
  school.restore(edited);
  expect(school.count).toBe(MAX_FISH + 1);
  expect(school.scale(id)).toBeCloseTo(1.8);
  school.removeFish(id);
  expect(school.enabled(id)).toBe(false);
  expect(school.addFish(0.4, 0.3, 0, 1)).toBe(id);
});

test('selection freezes one whole fish pose while its neighbours keep swimming', () => {
  let selected: number | null = 0;
  let spine: Float32Array = new Float32Array();
  const school = createSchool({
    canvas: { width: 1440, height: 900, clientWidth: 1440, clientHeight: 900 },
    options: () => ({ size: 1.15, interactive: true }),
    isPaused: id => id === selected,
    uniform: (name, value) => { if (name === 'uSpine') spine = value; },
  }, { target: [0.5, 0.5], over: false });
  school.frame(0);
  const fixed = spine.slice(0, 20), neighbour = spine.slice(20, 40);
  school.frame(1);
  expect(spine.slice(0, 20)).toEqual(fixed);
  expect(spine.slice(20, 40)).not.toEqual(neighbour);
  selected = null;
  school.frame(2);
  expect(spine.slice(0, 20)).not.toEqual(fixed);
});

test('undoing a fish transform does not rewind any other swimming fish', () => {
  const { school, output } = pond();
  const saved = school.capture();
  const originalPose = output.uSpine.slice(0, 20);
  school.transform(0, [0, 0], 1.5, 0.1, 0.1);
  school.frame(2);
  const others = output.uSpine.slice(20);
  school.restoreFish(0, saved);
  expect(output.uSpine.slice(0, 20)).toEqual(originalPose);
  expect(output.uSpine.slice(20)).toEqual(others);
  expect(school.scale(0)).toBe(1);
});

test('double-click disturbance expires and its wave geometry is removed', () => {
  const scene = new Scene(), ripples = new WaterRipples(scene);
  expect(ripples.active(0)).toBe(false);
  ripples.splash(0.5, 0.5, 10);
  expect(ripples.active(10.5)).toBe(true);
  expect(ripples.active(11)).toBe(false);
  expect(scene.children.length).toBeGreaterThan(0);
  ripples.update(13);
  expect(scene.children).toHaveLength(0);
  ripples.dispose();
});


test('edge handles stretch only their axis and anchor the opposite edge', () => {
  const box = { x: 10, y: 20, width: 100, height: 60 };
  for (const [edge, point, axis, pivot] of [
    ['e', { x: 210, y: 30 }, 'x', { x: 10, y: 50 }],
    ['w', { x: -90, y: 30 }, 'x', { x: 110, y: 50 }],
    ['n', { x: 20, y: -40 }, 'y', { x: 60, y: 80 }],
    ['s', { x: 20, y: 140 }, 'y', { x: 60, y: 20 }],
  ] as const) {
    expect(edgeResize(box, edge, point)).toEqual({ pivot, axis, scale: 2 });
  }
});

test('axis resizing preserves the other axis, supports scoped undo and resets reused slots', () => {
  const { school, output } = pond();
  school.transform(0, [0, 0], 1, 0.65 - output.uSpine[0], 0.5 - output.uSpine[1]);
  const before = school.capture();
  const x = output.uSpine[0], y = output.uSpine[1];
  expect(school.resizeAxis(0, [0.6, 0.3], 'x', 2)).toBe(2);
  expect(school.stretch(0)).toEqual([2, 1]);
  expect(output.uSpine[0]).toBeCloseTo(0.6 + (x - 0.6) * 2);
  expect(output.uSpine[1]).toBe(y);
  school.resizeAxis(0, [0.2, 0.3], 'y', 1.5);
  expect(school.stretch(0)).toEqual([2, 1.5]);
  expect(school.scale(0)).toBe(1);
  school.restoreFish(0, before);
  expect(school.stretch(0)).toEqual([1, 1]);
  expect(output.uSpine.slice(0, 2)).toEqual(before.head.slice(0, 2));
  school.resizeAxis(0, [0, 0], 'x', 100);
  expect(school.stretch(0)[0]).toBeGreaterThan(1);
  expect(school.stretch(0)[0]).toBeLessThanOrEqual(4);
  school.removeFish(0);
  expect(school.addFish(0.5, 0.5, 0, 1)).toBe(0);
  expect(school.stretch(0)).toEqual([1, 1]);
});

test('axis enlargement can extend offscreen while fixing the opposite edge', () => {
  for (const [x, y, angle, axis, side] of [
    [1.35, 0.5, 0, 'x', 'min'], [0.25, 0.5, Math.PI, 'x', 'max'],
    [0.8, 0.8, Math.PI / 2, 'y', 'min'], [0.8, 0.2, -Math.PI / 2, 'y', 'max'],
  ] as const) {
    const { school, output } = pond();
    const id = school.addFish(x, y, angle, 1);
    const before = renderedBounds(school, output, id);
    const anchor = axis === 'x' ? (side === 'min' ? before.minX : before.maxX) : (side === 'min' ? before.minY : before.maxY);
    const pivot = axis === 'x' ? [anchor, y] : [x, anchor];
    const otherScale = school.scale(id);
    expect(school.resizeAxis(id, pivot, axis, 4)).toBe(4);
    const after = renderedBounds(school, output, id);
    const actual = axis === 'x' ? (side === 'min' ? after.minX : after.maxX) : (side === 'min' ? after.minY : after.maxY);
    expect(actual).toBeCloseTo(anchor, 5);
    expect(school.scale(id)).toBe(otherScale);
    if (axis === 'x') expect(side === 'min' ? after.maxX > 1.6 : after.minX < 0).toBe(true);
    else expect(side === 'min' ? after.maxY > 1 : after.minY < 0).toBe(true);
    if (axis === 'x') {
      expect(after.minY).toBeCloseTo(before.minY, 5); expect(after.maxY).toBeCloseTo(before.maxY, 5);
    } else {
      expect(after.minX).toBeCloseTo(before.minX, 5); expect(after.maxX).toBeCloseTo(before.maxX, 5);
    }
  }
});

function renderedBounds(school: ReturnType<typeof createSchool>, output: Record<string, Float32Array>, id: number) {
  const geometry = new FishGeometry(id);
  geometry.update(output.uSpine, output.uFish[id * 4], output.uFish[id * 4 + 1], school.scale(id));
  const position = geometry.getAttribute('position');
  const [sx, sy] = school.stretch(id);
  const hx = output.uSpine[id * 20], hy = output.uSpine[id * 20 + 1];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let k = 0; k < geometry.drawRange.count; k++) {
    const px = hx + (position.getX(k) - hx) * sx, py = hy + (position.getY(k) - hy) * sy;
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  }
  geometry.dispose();
  return { minX, maxX, minY, maxY };
}


test('all four corner resizes keep the opposite rendered corner fixed even offscreen', () => {
  for (const [x, y, angle, corner] of [
    [1.3, 0.75, 0.4, 'ne'], [0.3, 0.75, 2.5, 'nw'],
    [1.3, 0.25, -0.4, 'se'], [0.3, 0.25, -2.5, 'sw'],
  ] as const) {
    const { school, output } = pond();
    const id = school.addFish(x, y, angle, 1);
    school.resizeAxis(id, [x, y], 'x', 1.3);
    const before = renderedBounds(school, output, id);
    const anchorX = corner.endsWith('e') ? before.minX : before.maxX;
    const anchorY = corner.startsWith('n') ? before.minY : before.maxY;
    const pivot = [anchorX, anchorY];
    for (const ratio of [10, 10, 0.6, 1.1, 10]) {
      school.resizeUniform(id, pivot, ratio);
      const after = renderedBounds(school, output, id);
      expect(corner.endsWith('e') ? after.minX : after.maxX).toBeCloseTo(anchorX, 5);
      expect(corner.startsWith('n') ? after.minY : after.maxY).toBeCloseTo(anchorY, 5);
      expect((after.maxX - after.minX) / (after.maxY - after.minY)).toBeCloseTo((before.maxX - before.minX) / (before.maxY - before.minY), 4);
    }
  }
});
