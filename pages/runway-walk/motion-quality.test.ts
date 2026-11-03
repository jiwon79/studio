import {expect,test} from 'vitest';
import {projectReference,referencePose} from './gait-reference';
import {measureMotion,summarizeMotion,MOTION_LIMITS} from './motion-quality';
import type {Posture} from './posture-match';
function observation(phase:number,yaw:number):Posture{
 const p=projectReference(referencePose(phase,yaw)),shoulder=[(p[11][0]+p[12][0])/2,(p[11][1]+p[12][1])/2],hip=[(p[23][0]+p[24][0])/2,(p[23][1]+p[24][1])/2];
 return {soles:[29,31,30,32].flatMap(j=>p[j].slice(0,2)),center:[...shoulder,...hip],lean:Math.atan2((shoulder[0]-hip[0])*512,(hip[1]-shoulder[1])*768)*180/Math.PI,axis:0,confidence:1,visibility:[1,1,1,1],velocity:Array(8).fill(0)};
}
test('native reference motion is compensated while a photographed foot jump remains measurable',()=>{
 const a=observation(.25,85),b=observation(.28,85),clean=measureMotion(a,b,.25,.28,85);
 expect(clean.footResidual).toBeLessThan(.001);expect(clean.torsoResidual).toBeLessThan(.001);expect(clean.leanResidual).toBeLessThan(.001);
 const jump={...b,soles:b.soles.map((x,i)=>x+(i%2?0:70/512))},broken=measureMotion(a,jump,.25,.28,85);
 expect(broken.footResidual).toBeCloseTo(70,5);expect(broken.footResidual).toBeGreaterThan(MOTION_LIMITS.footMax);
});
test('hidden feet do not count as zero motion error or a passing measurement',()=>{
 const a=observation(.1,85),b={...observation(.13,85),visibility:[.1,.1,.1,.1]},m=measureMotion(a,b,.1,.13,85);
 expect(m.footResidual).toBe(Infinity);expect(summarizeMotion([m],[3]).pass).toBe(false);
});
test('long identity holds fail the fixed cadence gate independently of pose fit',()=>{
 const m=measureMotion(observation(0,0),observation(.03,0),0,.03,0);
 expect(summarizeMotion([m],[3,3,3]).pass).toBe(true);expect(summarizeMotion([m],[3,12,3]).equalDuration).toBe(false);
});
