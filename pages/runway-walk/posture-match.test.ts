import { test, expect } from 'vitest';
import data from './angles.json';
import poses from './debug-poses.json';
import { buildBlocks,chooseCandidate,directionCandidates,type AngleBlock } from './angle-match';
import { inspectTransition,postureTransition,type Posture } from './posture-match';

const posture:Posture={lean:0,axis:0,confidence:1,center:[.5,.3,.5,.5],soles:[.4,.9,.42,.92,.6,.9,.62,.92],visibility:[1,1,1,1],velocity:Array(8).fill(0)};
test('outfit novelty and a perfect phase cannot override a large torso tilt when a compatible cut exists',()=> {
  const block=(clip:string,lean:number,phase:number):AngleBlock=>({clip,start:0,yaw:10,phase,posture:{...posture,lean}});
  expect(chooseCandidate([block('new-but-tilted',9,0),block('recent-but-compatible',1,.08)],10,0,['previous','recent-but-compatible'],undefined,undefined,posture).clip).toBe('recent-but-compatible');
});
test('foot comparison excludes uncertain toes and keeps anatomical swaps consistent',()=> {
  const uncertain={...posture,soles:[100,100,...posture.soles.slice(2)],visibility:[.1,1,1,1]};
  expect(postureTransition(posture,uncertain).footRms).toBe(0);
  const swapped={...posture,soles:[...posture.soles.slice(4),...posture.soles.slice(0,4)]};
  expect(postureTransition(posture,swapped,true).footRms).toBe(0);
  expect(postureTransition(posture,swapped).footRms).toBeGreaterThan(100);
});
test('compact torso and sole descriptors agree with the rendered full pose library',()=> {
  data.frames.forEach((frame,index)=> {
    const points=poses.frames[index].points;
    [29,31,30,32].forEach((joint,j)=>points[joint].slice(0,2).forEach((v,axis)=>expect(frame.posture.soles[j*2+axis]).toBe(v)));
    const shoulder=[(points[11][0]+points[12][0])*256,(points[11][1]+points[12][1])*384];
    const hip=[(points[23][0]+points[24][0])*256,(points[23][1]+points[24][1])*384];
    expect(frame.posture.lean).toBeCloseTo(Math.atan2(shoulder[0]-hip[0],hip[1]-shoulder[1])*180/Math.PI,2);
  });
});
test('the reported 179th cut chooses a compatible replacement for the tilted gray jacket',()=> {
  const last=data.frames.find(f=>f.source==='hermes24' && f.sourceFrame===1548)!;
  const reported=data.frames.find(f=>f.source==='hermes24' && f.sourceFrame===15187)!;
  const next=chooseCandidate(directionCandidates(buildBlocks(data.frames),10),10,(last.phase+1/30)%1,['hermes24-right-61','hermes24-clean-563'],last.gait,last.gaitVelocity,last.posture);
  const oldGap=inspectTransition(last.posture,reported.posture),newGap=inspectTransition(last.posture,data.frames[next.start].posture);
  expect(oldGap.leanDelta).toBeGreaterThan(5);
  expect(newGap.leanDelta).toBeLessThan(1);
  expect(newGap.footRms).toBeLessThan(oldGap.footRms*.5);
});
test('repeated +10-degree walking cycles keep body tilt and shoe displacement bounded',()=> {
  const eligible=directionCandidates(buildBlocks(data.frames),10);let last:typeof data.frames[number]|undefined,phase=0;let recent:string[]=[];const looks=new Set<string>();
  for(let cut=0;cut<120;cut++) {
    const next=chooseCandidate(eligible,10,phase,recent,last?.gait,last?.gaitVelocity,last?.posture);
    const first=data.frames[next.start];
    looks.add(first.look);
    expect(first.look).not.toBe(recent[0]);
    if(last) { const gap=inspectTransition(last.posture,first.posture);expect(gap.leanDelta).toBeLessThanOrEqual(4);expect(gap.footRms).toBeLessThan(35); }
    recent=[first.look,...recent].slice(0,4);last=data.frames[next.start+2];phase=(last.phase+1/30)%1;
  }
  expect(looks.size).toBeGreaterThanOrEqual(6);
});
