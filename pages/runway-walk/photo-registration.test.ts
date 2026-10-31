import {expect,test} from 'vitest';
import {projectReference,referencePose} from './gait-reference';
import {photoTransform,transformPosture,transformPhotoPoint,registeredPosture,IDENTITY_PHOTO} from './photo-registration';
import type {Posture} from './posture-match';

function observation(phase:number,yaw:number):Posture{
 const p=projectReference(referencePose(phase,yaw)),shoulder=[(p[11][0]+p[12][0])/2,(p[11][1]+p[12][1])/2],hip=[(p[23][0]+p[24][0])/2,(p[23][1]+p[24][1])/2];
 return {center:[...shoulder,...hip],soles:[29,31,30,32].flatMap(j=>p[j].slice(0,2)),lean:Math.atan2((shoulder[0]-hip[0])*512,(hip[1]-shoulder[1])*768)*180/Math.PI,axis:0,visibility:[1,1,1,1],confidence:1,velocity:Array(8).fill(0)};
}
test('small whole-photo displacement is recovered without exchanging either foot',()=>{
 for(const yaw of [-90,-45,0,45,90])for(const phase of [0,.25,.5,.75]){
  const target=observation(phase,yaw),source=transformPosture(target,{scale:1.03,rotation:.02,dx:4,dy:-3});
  const aligned=transformPosture(source,photoTransform(source,phase,yaw));
  [...aligned.center,...aligned.soles].forEach((v,i)=>expect(v).toBeCloseTo([...target.center,...target.soles][i],8));
  expect(aligned.lean).toBeCloseTo(target.lean,8);
 }
});
test('one bounded similarity transform preserves the shape and orientation of the photograph',()=>{
 const p=observation(.4,70),large=transformPosture(p,{scale:1.5,rotation:.5,dx:90,dy:-80}),t=photoTransform(large,.4,70);
 expect(t.scale).toBeGreaterThanOrEqual(.94);expect(t.scale).toBeLessThanOrEqual(1.06);
 expect(Math.abs(t.rotation)).toBeLessThanOrEqual(Math.PI/72);expect(Math.abs(t.dx)).toBeLessThanOrEqual(10);expect(Math.abs(t.dy)).toBeLessThanOrEqual(10);
 const source=[[.3,.2],[.7,.2],[.3,.8]],mapped=source.map(p=>transformPhotoPoint(p,t));
 const distance=(a:number[],b:number[])=>Math.hypot((a[0]-b[0])*512,(a[1]-b[1])*768);
 expect(distance(mapped[0],mapped[1])/distance(source[0],source[1])).toBeCloseTo(t.scale,10);
 expect(distance(mapped[0],mapped[2])/distance(source[0],source[2])).toBeCloseTo(t.scale,10);
 expect((mapped[1][0]-mapped[0][0])*(mapped[2][1]-mapped[0][1])-(mapped[1][1]-mapped[0][1])*(mapped[2][0]-mapped[0][0])).toBeGreaterThan(0);
});
test('unregistered edits retain the exact original posture and pixels',()=>{
 const p=observation(.1,85);expect(registeredPosture(p,.1,85,false)).toBe(p);
 const point=[.2,.7,.83];transformPhotoPoint(point,IDENTITY_PHOTO).forEach((v,i)=>expect(v).toBeCloseTo(point[i],12));
});
