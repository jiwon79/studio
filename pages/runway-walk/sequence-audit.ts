import type {AngleFrame} from './angle-match';
import {cutIndex,type ReferenceSequencer} from './reference-sequencer';
import {registeredPosture} from './photo-registration';
import {clockPhase,createWalkState} from './reference-clock';
import {measureMotion,summarizeMotion,type MotionQuality} from './motion-quality';

export type MeasuredTransition = MotionQuality & {from:number;to:number;tick:number};
/** Inspect displayed frames, including within-person steps and the next cycle's
 * first frame. A low fitting score or a smooth network trace cannot pass this. */
export function auditSequence(planner:ReferenceSequencer,frames:readonly AngleFrame[],yaw:number,ticks=300){
 let state=createWalkState(),last:number|undefined,lastRegistered=false;
 const transitions:MeasuredTransition[]=[],runs:{look:string;count:number}[]=[],indices:number[]=[];
 while(state.tick<=ticks){
  const cut=planner.plan(yaw,state);
  for(let j=0;j<cut.count&&state.tick+j<=ticks;j++){
   const index=cutIndex(cut,j),tick=state.tick+j,frame=frames[index],look=frame.look??frame.clip;
   if(runs[runs.length-1]?.look===look)runs[runs.length-1].count++;else runs.push({look,count:1});
   if(last!==undefined){
    const previous=frames[last].posture,next=frame.posture;
    if(!previous||!next)throw Error('Missing registered photograph landmarks');
    transitions.push({from:last,to:index,tick,...measureMotion(registeredPosture(previous,clockPhase(tick-1),yaw,lastRegistered),registeredPosture(next,clockPhase(tick),yaw,!!cut.registered),clockPhase(tick-1),clockPhase(tick),yaw)});
   }
   indices.push(index);last=index;lastRegistered=!!cut.registered;
  }
  state=cut.after;
 }
 return {yaw,indices,transitions,runs,quality:summarizeMotion(transitions,runs.slice(0,-1).map(r=>r.count))};
}
