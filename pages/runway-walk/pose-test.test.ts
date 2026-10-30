import { test, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import data from './assets/pose-test/manifest.json';
import motion from './reference-motion.json';
import photos from './angles.json';
import { clockPhase, createWalkState } from './reference-clock';
import { projectReference, referencePose } from './gait-reference';
import { ReferenceSequencer, cutIndex } from './reference-sequencer';

test('pose-conditioned images bind to exact playback slots and the imported model phase', () => {
  expect(data.angle).toBe(0);
  expect(data.modelHash).toBe(motion.modelHash);
  expect(data.clip).toBe(motion.clip);
  expect(data.duration).toBe(motion.duration);
  expect(data.completeGaitCycle).toBe(false);
  expect(data.frames).toHaveLength(12);
  const planner = new ReferenceSequencer(photos.frames);
  let state = createWalkState(); const indices: number[] = [];
  while (indices.length < 12) {
    const cut = planner.plan(0, state);
    for (let offset = 0; offset < cut.count && indices.length < 12; offset++) indices.push(cutIndex(cut, offset));
    state = cut.after;
  }
  data.frames.forEach((row, tick) => {
    expect(row.tick).toBe(tick);
    expect(row.index).toBe(indices[tick]);
    expect(row.sourceFrame).toBe(photos.frames[row.index].sourceFrame);
    expect(row.phase).toBeCloseTo(clockPhase(tick), 12);
    expect(row.target).toEqual(projectReference(referencePose(clockPhase(tick), 0)));
    for (const points of [row.baselinePoints, row.photoFirstPoints, row.modelFirstPoints]) {
      expect(points).toHaveLength(33);
      expect(points.flat().every(Number.isFinite)).toBe(true);
    }
    for (const file of [row.model, row.guide, row.photoFirst, row.modelFirst])
      expect(existsSync(fileURLToPath(new URL(`./assets/pose-test/${file}`, import.meta.url))), file).toBe(true);
  });
});
