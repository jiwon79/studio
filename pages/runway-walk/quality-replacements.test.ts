import {test,expect} from 'vitest';
import data from './angles.json';
import {ReferenceSequencer} from './reference-sequencer';
import {directionPhotos} from './direction-photos';
import {preservedOriginals} from './quality-coverage';
import gpt from './assets/gpt-quality/manifest.json';
import higgsfield from './assets/higgsfield-quality/manifest.json';
import first from './assets/higgsfield-quality-45/manifest.json';

test('every active photograph has an enhanced version, without rejected originals',()=>{
  const restored=new Set([...gpt.frames,...higgsfield.frames,...first.frames].map(row=>row.index));
  for(let yaw=-90;yaw<=90;yaw+=5){
    for(const index of directionPhotos(yaw)){
      expect(preservedOriginals.has(index),`rejected photo ${index} at ${yaw}`).toBe(false);
      expect(restored.has(index),`missing enhanced photo ${index} at ${yaw}`).toBe(true);
    }
  }
});

test('drag fallback pools cannot reintroduce replaced rejected photographs',()=>{
  const planner=new ReferenceSequencer(data.frames);
  for(let yaw=-90;yaw<=90;yaw+=5)for(const count of [1,2,3]){
    for(const block of planner.candidates(yaw,count)){
      for(let offset=0;offset<count;offset++)expect(preservedOriginals.has(block.start+offset)).toBe(false);
    }
  }
});
