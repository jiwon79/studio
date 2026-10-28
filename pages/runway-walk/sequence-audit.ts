import type {AngleFrame} from './angle-match';
import {cutIndex,type ReferenceSequencer} from './reference-sequencer';
import {cutPhotoTransform,transformPosture,IDENTITY_PHOTO} from './photo-registration';
import {clockPhase,createWalkState} from './reference-clock';
import {measureMotion,summarizeMotion,type MotionQuality} from './motion-quality';
import {alignedFace,measureFace,summarizeUpperBody} from './upper-body-quality';
import {measureAppearanceProgress,measureGaitProgress} from './gait-progress';
import type {Posture} from './posture-match';

export type MeasuredTransition = MotionQuality & {from:number;to:number;tick:number};
/** Inspect displayed frames, including within-person steps and the next cycle's
 * first frame. A low fitting score or a smooth network trace cannot pass this. */
export function auditSequence(planner:ReferenceSequencer,frames:readonly AngleFrame[],yaw:number,ticks=300,poses?:readonly {points:readonly (readonly number[])[]}[]){
 let state=createWalkState(),last:number|undefined,lastTransform=IDENTITY_PHOTO;
 const transitions:MeasuredTransition[]=[],runs:{look:string;count:number}[]=[],indices:number[]=[];
 const faceTransitions:(ReturnType<typeof measureFace>&{cut:boolean})[]=[];
 const appearances:(ReturnType<typeof measureAppearanceProgress>&{tick:number;from:number;to:number})[]=[];
 const boundaries:(ReturnType<typeof measureGaitProgress>&{tick:number;from:number;to:number;hipDx:number;footResidual:number})[]=[];
 while(state.tick<=ticks){
  const cut=planner.plan(yaw,state);
  if(cut.count===3&&state.tick+2<=ticks){
   const phases=[0,1,2].map(j=>clockPhase(state.tick+j)) as [number,number,number];
   const postures=[0,1,2].map(j=>{const p=frames[cutIndex(cut,j)].posture;if(!p)throw Error('Missing appearance landmarks');return transformPosture(p,cutPhotoTransform(cut,j,p,phases[j],yaw));}) as [Posture,Posture,Posture];
   appearances.push({tick:state.tick,from:cutIndex(cut,0),to:cutIndex(cut,2),...measureAppearanceProgress(postures,phases,yaw)});
  }
  for(let j=0;j<cut.count&&state.tick+j<=ticks;j++){
   const index=cutIndex(cut,j),tick=state.tick+j,frame=frames[index],look=frame.look??frame.clip;
   const transform=frame.posture?cutPhotoTransform(cut,j,frame.posture,clockPhase(tick),yaw):IDENTITY_PHOTO;
   if(runs[runs.length-1]?.look===look)runs[runs.length-1].count++;else runs.push({look,count:1});
   if(last!==undefined){
    const previous=frames[last].posture,next=frame.posture;
    if(!previous||!next)throw Error('Missing registered photograph landmarks');
    const a=transformPosture(previous,lastTransform),b=transformPosture(next,transform);
    const motion=measureMotion(a,b,clockPhase(tick-1),clockPhase(tick),yaw);
    transitions.push({from:last,to:index,tick,...motion});
    // Small position errors can still rewind the feet at an identity change.
    // Include the wrap back to the first photograph, using anatomical foot IDs.
    if(j===0)boundaries.push({from:last,to:index,tick,hipDx:(b.center[2]-a.center[2])*512,footResidual:motion.footResidual,...measureGaitProgress(a,b,clockPhase(tick-1),clockPhase(tick),yaw)});
    if(poses)faceTransitions.push({...measureFace(alignedFace(poses[last].points,lastTransform),alignedFace(poses[index].points,transform),clockPhase(tick-1),clockPhase(tick),yaw),cut:frames[last].clip!==frame.clip});
   }
   indices.push(index);last=index;lastTransform=transform;
  }
  state=cut.after;
 }
 const progress={appearances:appearances.length,reverse:appearances.filter(r=>r.status==='reverse').length,stall:appearances.filter(r=>r.status==='stall').length,unmeasurable:appearances.filter(r=>r.status==='unmeasurable').length,smallMotion:appearances.filter(r=>r.status==='small-motion').length};
 const boundaryProgress={count:boundaries.length,reverse:boundaries.filter(r=>r.status==='reverse').length,stall:boundaries.filter(r=>r.status==='stall').length,unmeasurable:boundaries.filter(r=>r.status==='unmeasurable').length,hipMax:Math.max(0,...boundaries.map(r=>Math.abs(r.hipDx))),footMax:Math.max(0,...boundaries.map(r=>r.footResidual))};
 return {yaw,indices,transitions,runs,appearances,progress,boundaries,boundaryProgress,quality:summarizeMotion(transitions,runs.slice(0,-1).map(r=>r.count)),...(poses?{upperBody:summarizeUpperBody(faceTransitions)}:{})};
}
