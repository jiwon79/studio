import { afterEach, expect, test, vi } from 'vitest';
import { PondEditor } from './editor';
import type { Bounds } from './editor-model';

class ElementStub extends EventTarget {
  hidden = true;
  textContent = '';
  style = {};
  private captured = new Set<number>();
  setAttribute() {}
  matches() { return false; }
  getBoundingClientRect() { return { left: 0, top: 0 }; }
  setPointerCapture(id: number) { this.captured.add(id); }
  hasPointerCapture(id: number) { return this.captured.has(id); }
  releasePointerCapture(id: number) { this.captured.delete(id); }
}

function fixture() {
  const canvas = new ElementStub();
  const elements = new Map<string, ElementStub>();
  const windowEvents = new ElementStub();
  vi.stubGlobal('window', windowEvents);
  vi.stubGlobal('document', {
    querySelector: (selector: string) => {
      if (!elements.has(selector)) elements.set(selector, new ElementStub());
      return elements.get(selector);
    },
    querySelectorAll: () => [],
  });
  const fish = new Map<number, Bounds>([[0, { x: 100, y: 100, width: 80, height: 40 }]]);
  const capture = () => new Map([...fish].map(([id, box]) => [id, { ...box }]));
  const editor = new PondEditor(canvas as unknown as HTMLCanvasElement, {
    nodes: () => [...fish].map(([id, bounds]) => ({ id, bounds })),
    add(points) {
      if (points.length < 3) return -1;
      fish.set(1, { x: points[0].x, y: points[0].y, width: 100, height: 30 });
      return 1;
    },
    translate(id, dx, dy) { const box = fish.get(id)!; box.x += dx; box.y += dy; },
    scale: () => 1,
    stretch: () => 1,
    remove: id => { fish.delete(id); },
    splash() {},
    capture,
    restore(saved, id) { if (saved.has(id)) fish.set(id, { ...saved.get(id)! }); else fish.delete(id); },
    changed: () => editor?.refresh(),
  });
  function pointer(type: string, x: number, y: number, pointerId = 1) {
    if (type === 'lostpointercapture') canvas.releasePointerCapture(pointerId);
    canvas.dispatchEvent(Object.assign(new Event(type), { clientX: x, clientY: y, pointerId,
      isPrimary: true, button: 0, pointerType: 'mouse' }));
  }
  function key(key: string, ctrlKey = false, shiftKey = false) {
    windowEvents.dispatchEvent(Object.assign(new Event('keydown'), { key, ctrlKey, shiftKey, code: key,
      metaKey: false, altKey: false }));
  }
  function drag() { pointer('pointerdown', 120, 120); pointer('pointermove', 170, 150); }
  return { editor, fish, pointer, key, drag, windowEvents, canvas };
}

afterEach(() => vi.unstubAllGlobals());

test('sketched fish are never selected, but creation still supports undo and redo', () => {
  const { editor, fish, pointer, key } = fixture();
  pointer('pointerdown', 300, 300);
  pointer('pointermove', 350, 280);
  pointer('pointermove', 400, 300);
  pointer('pointerup', 300, 300);
  expect(fish.has(1)).toBe(true);
  expect(editor.selectedId).toBeNull();
  key('z', true);
  expect(fish.has(1)).toBe(false);
  key('z', true, true);
  expect(fish.has(1)).toBe(true);
  expect(editor.selectedId).toBeNull();
});

for (const interruption of ['blur', 'resize', 'pointercancel', 'lostpointercapture']) {
  test(`${interruption} retains the latest drag pose and makes it undoable`, () => {
    const { editor, fish, pointer, key, drag, windowEvents } = fixture();
    drag();
    if (interruption === 'blur' || interruption === 'resize') windowEvents.dispatchEvent(new Event(interruption));
    else pointer(interruption, 170, 150);
    pointer('pointerup', 170, 150);
    expect(fish.get(0)).toMatchObject({ x: 150, y: 130 });
    expect(editor.selectedId).toBe(0);
    key('z', true);
    expect(fish.get(0)).toMatchObject({ x: 100, y: 100 });
  });
}

test('late capture events cannot roll back a new drag, while Escape explicitly cancels it', () => {
  const { fish, pointer, key, drag, canvas } = fixture();
  drag();
  pointer('pointerup', 180, 160); // Final up position also counts.
  expect(fish.get(0)).toMatchObject({ x: 160, y: 140 });
  pointer('pointerdown', 180, 160, 2);
  pointer('pointermove', 210, 190, 2);
  pointer('lostpointercapture', 180, 160, 1);
  expect(fish.get(0)).toMatchObject({ x: 190, y: 170 });
  // A queued event for a reused pointer ID is stale while capture is held.
  canvas.dispatchEvent(Object.assign(new Event('lostpointercapture'), { pointerId: 2 }));
  pointer('pointermove', 220, 200, 2);
  expect(fish.get(0)).toMatchObject({ x: 200, y: 180 });
  key('Escape');
  expect(fish.get(0)).toMatchObject({ x: 160, y: 140 });
  pointer('pointerup', 210, 190, 2);
  expect(fish.get(0)).toMatchObject({ x: 160, y: 140 });
});
