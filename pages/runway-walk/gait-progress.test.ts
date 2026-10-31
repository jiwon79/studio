import {expect,test} from 'vitest';
import {measureGaitProgress,measureAppearanceProgress} from './gait-progress';
import {projectReference,referencePose} from './gait-reference';
import type {Posture} from './posture-match';
import data from './angles.json';
import schedule from './reference-schedule.json';
import {PROGRESS_LIMITS,PROGRESS_VERSION} from './gait-progress';
import {ReferenceSequencer} from './reference-sequencer';
import {auditSequence} from './sequence-audit';
import {transformPosture} from './photo-registration';
import {clockPhase} from './reference-clock';
import {measureMotion} from './motion-quality';

function pose(phase:number,yaw=45):Posture{
 const p=projectReference(referencePose(phase,yaw));
 return {soles:[29,31,30,32].flatMap(j=>p[j].slice(0,2)),center:[11,23].flatMap(j=>[0,1].map(k=>(p[j][k]+p[j+1][k])/2)),lean:0,axis:0,confidence:1,visibility:[1,1,1,1],velocity:Array(8).fill(0)};
}
test('the same plausible poses in reverse order are distinguished from forward gait',()=>{
 const a=pose(.1),b=pose(.16);
 expect(measureGaitProgress(a,b,.1,.16,45).status).toBe('forward');
 expect(measureGaitProgress(b,a,.1,.16,45).status).toBe('reverse');
 expect(measureGaitProgress(a,a,.1,.16,45).status).toBe('stall');
});
test('moving a frozen photograph cannot manufacture leg progress',()=>{
 const a=pose(.1),b={...a,soles:a.soles.map((v,i)=>v+(i%2?.01:.04)),center:a.center.map((v,i)=>v+(i%2?.01:.04))};
 expect(measureGaitProgress(a,b,.1,.16,45).status).toBe('stall');
});
test('a backwards middle step is not hidden by forward first-to-last motion',()=>{
 const p=[pose(.1),pose(.04),pose(.16)] as const;
 expect(measureGaitProgress(p[0],p[2],.1,.16,45).status).toBe('forward');
 expect(measureAppearanceProgress(p,[.1,.13,.16],45).status).toBe('reverse');
});
test('two confident points on only one foot cannot qualify both anatomical feet',()=>{
 const a=pose(.1),b={...pose(.16),visibility:[1,1,.2,.2]};
 expect(measureGaitProgress(a,b,.1,.16,45).status).toBe('unmeasurable');
 expect(measureGaitProgress(a,a,.1,.1,45).status).toBe('small-motion');
});
test('the reported three-frame pauses and rewinds remain visible to the new audit',()=>{
 // Original v43 example: small displacement passed the old maximum-jump gate.
 const frames=[8891,8893].map(n=>data.frames.find(f=>f.clip==='issey19-left-355'&&f.sourceFrame===n)!);
 expect(measureGaitProgress(frames[0].posture,frames[1].posture,.17,.23,-45).status).toBe('stall');
});
test('the accepted left profile remains a useful progress control',()=>{
 const report=auditSequence(new ReferenceSequencer(data.frames),data.frames,-70,300);
 expect(report.progress).toMatchObject({appearances:100,reverse:0,stall:0,unmeasurable:0});
});
test('feedback-qualified views reject internal rewinds, whole-cut stalls and uncertain feet',()=>{
 expect(schedule.progressReview.version).toBe(PROGRESS_VERSION);
 expect(schedule.progressReview.limits).toEqual(PROGRESS_LIMITS);
 for(const yaw of schedule.progressReview.yaws){
  const report=auditSequence(new ReferenceSequencer(data.frames),data.frames,yaw,600);
  expect(report.progress,`${yaw}°`).toMatchObject({appearances:200,reverse:0,stall:0,unmeasurable:0});
 }
});
test('the reported frontal cut can pass the position gate while rewinding anatomical feet',()=>{
 const a=data.frames.find(f=>f.source==='prada25'&&f.sourceFrame===2813)!.posture;
 const b=data.frames.find(f=>f.source==='hermes'&&f.sourceFrame===11860)!.posture;
 const previous=transformPosture(a,{scale:.9452822699420822,rotation:.03796707309235699,dx:-2.5626532219635156,dy:10});
 const next=transformPosture(b,{scale:.9558177653508877,rotation:.0008519413487114277,dx:4.11301449326904,dy:10});
 expect(measureMotion(previous,next,clockPhase(170),clockPhase(171),0).footResidual).toBeLessThan(24);
 expect(measureGaitProgress(previous,next,clockPhase(170),clockPhase(171),0).status).toBe('reverse');
});
test('reviewed identity changes include the loop closure and reject anatomical rewinds',()=>{
 expect(schedule.boundaryReview.yaws).toEqual([-90,-85,-80,-75,-70,-65,-60,-55,-50,-45,-40,-35,-30,-25,-20,-15,-10,-5,0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90]);
 for(const yaw of schedule.boundaryReview.yaws){
  const report=auditSequence(new ReferenceSequencer(data.frames),data.frames,yaw,600);
  expect(report.boundaryProgress,`${yaw}°`).toMatchObject({count:200,reverse:0,stall:0,unmeasurable:0});
  expect(report.boundaries.filter(b=>b.tick%300===0)).toHaveLength(2);
  expect(report.boundaryProgress.hipMax).toBeLessThanOrEqual(schedule.boundaryReview.limits.hipMax);
  expect(report.boundaryProgress.footMax).toBeLessThanOrEqual(schedule.boundaryReview.limits.footMax);
 }
});
