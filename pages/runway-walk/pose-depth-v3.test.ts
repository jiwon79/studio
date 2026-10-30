import { test, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import depth from './assets/pose-depth-v3/manifest.json';
import previous from './assets/pose-test/manifest.json';
import restored from './assets/gpt-zero/manifest.json';
import motion from './reference-motion.json';
import { clockPhase } from './reference-clock';
import { referencePose } from './gait-reference';
import { depthTwelveFrames } from './zero-twelve-comparison';
import { zeroPoseAsset } from './gpt-zero-pose-patch';

test('all twelve depth-conditioned candidates bind to unchanged imported poses and complete files', () => {
  expect(depth.status).toBe('experimental-not-promoted');
  expect(depth.modelHash).toBe(motion.modelHash);
  expect(depth.clip).toBe(motion.clip);
  expect(depth.frames).toHaveLength(12);
  depth.frames.forEach((r, i) => {
    expect(r.tick).toBe(i);
    expect(r.index).toBe(previous.frames[i].index);
    expect(r.phase).toBeCloseTo(clockPhase(i), 12);
    const native = referencePose(r.phase).points;
    for (const j of [23, 24, 25, 26, 27, 28, 29, 30, 31, 32])
      for (let k = 0; k < 3; k++) expect(Math.abs(r.target3D[j][k] - native[j][k])).toBeLessThan(.002);
    expect(r.points).toHaveLength(33);
    expect(r.points.flat().every(Number.isFinite)).toBe(true);
    const bytes = readFileSync(new URL(`./assets/pose-depth-v3/${r.file}`, import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(r.fileHash);
    expect(readFileSync(new URL(`./assets/pose-depth-v3/${r.guide}`, import.meta.url)).length).toBeGreaterThan(1000);
    expect(depthTwelveFrames[i].after).toBe(`./assets/pose-depth-v3/${r.file}`);
    expect(depthTwelveFrames[i].before).toBe(`./assets/pose-test/${previous.frames[i].headBody}`);
    const main = zeroPoseAsset(restored.frames.find(p => p.index === r.index)!, true);
    expect(main.file).toBe(`./assets/pose-test/${previous.frames[i].headBody}`);
  });
});
