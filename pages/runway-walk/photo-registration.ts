import type {Posture} from './posture-match';
import {projectReference,referencePose} from './gait-reference';

/** One similarity transform for the complete photograph. No limb deformation,
 * reflection, interpolation of pixels between people, or changed foot IDs. */
export const PHOTO_REGISTRATION_VERSION='whole-photo-v1';
export type PhotoTransform={scale:number;rotation:number;dx:number;dy:number};
export const IDENTITY_PHOTO:PhotoTransform={scale:1,rotation:0,dx:0,dy:0};
/** Baked cut transforms keep size and rotation constant during an appearance. */
export function cutPhotoTransform(cut:{registered?:boolean;photoTransforms?:readonly PhotoTransform[]},offset:number,p:Posture,phase:number,yaw:number):PhotoTransform{
 return cut.photoTransforms?.[offset]??(cut.registered?photoTransform(p,phase,yaw):IDENTITY_PHOTO);
}
export function validPhotoTransforms(transforms:readonly PhotoTransform[],length:number):boolean{
 return transforms.length===length&&transforms.every((t,i)=>
  [t.scale,t.rotation,t.dx,t.dy].every(Number.isFinite)&&t.scale>=.94&&t.scale<=1.06&&Math.abs(t.rotation)<=Math.PI/72&&Math.abs(t.dx)<=10&&Math.abs(t.dy)<=10&&
  (i%3===0||(t.scale===transforms[i-1].scale&&t.rotation===transforms[i-1].rotation)));
}
const anchor=[256,420],targets=new Map<string,{center:number[];soles:number[]}>();
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));

export function transformPhotoPoint(point:readonly number[],t:PhotoTransform):number[]{
 const x=point[0]*512-anchor[0],y=point[1]*768-anchor[1],c=Math.cos(t.rotation),s=Math.sin(t.rotation);
 return [(anchor[0]+t.dx+t.scale*(x*c-y*s))/512,(anchor[1]+t.dy+t.scale*(x*s+y*c))/768,...point.slice(2)];
}
export function transformPosture(p:Posture,t:PhotoTransform):Posture{
 const points=(v:readonly number[])=>Array.from({length:v.length/2},(_,i)=>transformPhotoPoint(v.slice(i*2,i*2+2),t)).flat();
 const c=Math.cos(t.rotation),s=Math.sin(t.rotation);
 const velocity=Array.from({length:p.velocity.length/2},(_,i)=>{
  const x=p.velocity[i*2]*512,y=p.velocity[i*2+1]*768;
  return [t.scale*(x*c-y*s)/512,t.scale*(x*s+y*c)/768];
 }).flat();
 return {...p,center:points(p.center),soles:points(p.soles),velocity,lean:p.lean+t.rotation*180/Math.PI,axis:p.axis+t.rotation*180/Math.PI};
}
export function photoTransform(p:Posture,phase:number,yaw:number):PhotoTransform{
 const key=`${yaw}:${phase.toFixed(6)}`;
 let target=targets.get(key);
 if(!target){
  const joints=projectReference(referencePose(phase,yaw));
  target={center:[(joints[11][0]+joints[12][0])/2,(joints[11][1]+joints[12][1])/2,(joints[23][0]+joints[24][0])/2,(joints[23][1]+joints[24][1])/2],soles:[29,31,30,32].flatMap(j=>joints[j].slice(0,2))};
  if(targets.size>16000)targets.clear();targets.set(key,target);
 }
 const a=[...p.center,...p.soles],b=[...target.center,...target.soles],weights=[2,4,...p.visibility.map(v=>v>=.6?v:0)];
 let sx=0,sy=0,tx=0,ty=0,w=0;
 for(let i=0;i<6;i++){const z=weights[i];sx+=a[i*2]*512*z;sy+=a[i*2+1]*768*z;tx+=b[i*2]*512*z;ty+=b[i*2+1]*768*z;w+=z;}
 sx/=w;sy/=w;tx/=w;ty/=w;
 let dot=0,cross=0,denom=0;
 for(let i=0;i<6;i++){const x=a[i*2]*512-sx,y=a[i*2+1]*768-sy,u=b[i*2]*512-tx,v=b[i*2+1]*768-ty,z=weights[i];dot+=(x*u+y*v)*z;cross+=(x*v-y*u)*z;denom+=(x*x+y*y)*z;}
 if(!Number.isFinite(denom)||denom<1)return IDENTITY_PHOTO;
 const rotation=clamp(Math.atan2(cross,dot),-Math.PI/72,Math.PI/72),c=Math.cos(rotation),s=Math.sin(rotation),scale=clamp((dot*c+cross*s)/denom,.94,1.06);
 return {scale,rotation,dx:clamp(tx-(anchor[0]+scale*((sx-anchor[0])*c-(sy-anchor[1])*s)),-10,10),dy:clamp(ty-(anchor[1]+scale*((sx-anchor[0])*s+(sy-anchor[1])*c)),-10,10)};
}
export function registeredPosture(p:Posture,phase:number,yaw:number,enabled:boolean){
 return enabled?transformPosture(p,photoTransform(p,phase,yaw)):p;
}
/** Apply after save(), and restore() after drawing the original photograph. */
export function applyPhotoTransform(ctx:CanvasRenderingContext2D,t:PhotoTransform){
 ctx.translate(anchor[0]+t.dx,anchor[1]+t.dy);ctx.rotate(t.rotation);ctx.scale(t.scale,t.scale);ctx.translate(-anchor[0],-anchor[1]);
}
