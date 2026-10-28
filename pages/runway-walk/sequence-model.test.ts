import {test,expect} from 'vitest';
import data from './angles.json';
import schedule from './reference-schedule.json';
import {reviewSequence,reviewTick} from './sequence-model';
import {IDENTITY_PHOTO} from './photo-registration';

test('the full contact sheet follows every displayed occurrence in all 37 playback directions',()=>{
 for(let yaw=-90;yaw<=90;yaw+=5){
  const rows=reviewSequence(data.frames,yaw);
  const entries=(schedule.directions as Record<string,(number|number[])[]>)[yaw];
  expect(rows.map(r=>r.index)).toEqual(entries.flatMap(e=>Array.isArray(e)?e:[e,e+1,e+2]));
  expect(rows.map(r=>r.tick)).toEqual(Array.from({length:300},(_,i)=>i));
  expect(rows.map(r=>r.offset)).toEqual(Array.from({length:300},(_,i)=>i%3));
  expect(new Set(rows.map(r=>r.cut)).size).toBe(100);
 }
});
test('repeated photographs retain their occurrence-specific alignment and position',()=>{
 const rows=reviewSequence(data.frames,-20),transforms=(schedule.registration.photoTransforms as Record<string,typeof IDENTITY_PHOTO[]>)[-20];
 expect(new Set(rows.map(r=>r.index)).size).toBeLessThan(rows.length);
 rows.forEach((r,i)=>expect(r.transform).toEqual(transforms[i]));
});
test('the first and last photographs are neighbors at the real loop boundary',()=>{
 expect(reviewTick(-1,300)).toBe(299);
 expect(reviewTick(300,300)).toBe(0);
 expect(reviewTick(NaN,300)).toBe(0);
});
