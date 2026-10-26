import { test, expect } from 'vitest';
import { validateFeedback, frameKey } from './review-model';
import data from './angles.json';
import poses from './debug-poses.json';

const keys = new Set(['hermes25:11937','prada25:2050']);
const draft = {clientId:'review-test-12345',frameKey:'hermes25:11937',target:10,category:'angle',note:'발 진행 방향이 다름',suggestedYaw:30,joint:28,comparedTo:'prada25:2050',assetVersion:data.assetVersion};
test('feedback uses stable photo IDs and preserves the viewed angle, joint and preceding photo',()=> {
  expect(validateFeedback(draft,keys)).toEqual(draft);
  for (const invalid of [{frameKey:'hermes25:1'},{target:11},{joint:33},{suggestedYaw:NaN},{category:'__proto__'},{comparedTo:'missing'},{note:'a'.repeat(2001)}]) expect(()=>validateFeedback({...draft,...invalid},keys)).toThrow(TypeError);
});
test('all 33 published joints are registered against the exact rendered knee/ankle positions',()=> {
  expect(poses.assetVersion).toBe(data.assetVersion);
  expect(poses.frames).toHaveLength(data.frames.length);
  data.frames.forEach((frame,index)=> {
    const pose=poses.frames[index];
    expect(pose.key).toBe(frameKey(frame)); expect(pose.points).toHaveLength(33);
    pose.points.forEach(point=>{ expect(point.every(Number.isFinite)).toBe(true); expect(point[2]).toBeGreaterThanOrEqual(0); expect(point[2]).toBeLessThanOrEqual(1); });
    [25,26,27,28].forEach((joint,offset)=> {
      expect(Math.abs(pose.points[joint][0]-frame.gait[offset*2])*512).toBeLessThan(.02);
      expect(Math.abs(pose.points[joint][1]-frame.gait[offset*2+1])*768).toBeLessThan(.02);
    });
  });
});
