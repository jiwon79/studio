import {expect,test} from 'vitest';
import data from './angles.json';
import poses from './debug-poses.json';
import schedule from './reference-schedule.json';
import {ReferenceSequencer,cutIndex} from './reference-sequencer';
import {createWalkState,clockPhase} from './reference-clock';
import {cutPhotoTransform,validPhotoTransforms} from './photo-registration';
import {alignedFace,measureFace,summarizeUpperBody} from './upper-body-quality';
import {auditSequence} from './sequence-audit';

test('every stabilized direction keeps face movement within the accepted profile envelope',()=>{
 for(const yaw of [...new Set([...Object.keys(schedule.registration.photoTransforms).map(Number),85])]){
  const planner=new ReferenceSequencer(data.frames);let state=createWalkState();
  const faces:ReturnType<typeof alignedFace>[]=[],transforms=[];
  while(state.tick<600){const cut=planner.plan(yaw,state);expect(cut.qualityVerified).toBe(true);
   for(let j=0;j<cut.count;j++){
    const index=cutIndex(cut,j),tick=state.tick+j,t=cutPhotoTransform(cut,j,data.frames[index].posture,clockPhase(tick),yaw);
    transforms.push(t);faces.push(alignedFace(poses.frames[index].points,t));
   }state=cut.after;
  }
  expect(validPhotoTransforms(transforms,600)).toBe(true);
  // Include the last-to-first transition so this measures complete closed loops.
  const rows=faces.map((f,i)=>({...measureFace(faces[(i+faces.length-1)%faces.length],f,clockPhase(i-1),clockPhase(i),yaw),cut:i%3===0}));
  expect(summarizeUpperBody(rows).pass,JSON.stringify({yaw,quality:summarizeUpperBody(rows)})).toBe(true);
  expect(auditSequence(planner,data.frames,yaw).quality.pass).toBe(true);
 }
});
test('a rare face jump cannot hide among the two native steps in each appearance',()=>{
 const rows=Array.from({length:300},(_,i)=>({residual:i%3?1:i<18?30:10,reliable:true,cut:i%3===0}));
 expect(summarizeUpperBody(rows).pass).toBe(false);
 expect(summarizeUpperBody(rows.map(r=>({...r,residual:r.cut?10:1,reliable:false}))).pass).toBe(false);
});
test('a baked correction cannot introduce scaling or rotation inside an appearance',()=>{
 const t={scale:1,rotation:0,dx:0,dy:0};
 expect(validPhotoTransforms([t,{...t,dx:2},t],3)).toBe(true);
 expect(validPhotoTransforms([t,{...t,scale:1.01},t],3)).toBe(false);
 expect(validPhotoTransforms([t,{...t,rotation:.01},t],3)).toBe(false);
 expect(validPhotoTransforms([t,{...t,dx:21},t],3)).toBe(false);
});
