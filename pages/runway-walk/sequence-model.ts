import type {AngleFrame} from './angle-match';
import {ReferenceSequencer,cutIndex} from './reference-sequencer';
import {createWalkState,clockPhase} from './reference-clock';
import {cutPhotoTransform,type PhotoTransform} from './photo-registration';
import schedule from './reference-schedule.json';

export type ReviewFrame={tick:number;index:number;cut:number;offset:number;transform:PhotoTransform};
/** The full default playback loop, including every repeated photograph and its
 * actual whole-photo registration. Candidate/library order is not playback. */
export function reviewSequence(frames:readonly AngleFrame[],yaw:number):ReviewFrame[]{
 const planner=new ReferenceSequencer(frames),rows:ReviewFrame[]=[];
 let state=createWalkState(),group=0;
 while(state.tick<schedule.periodFrames){
  const cut=planner.plan(yaw,state);
  for(let j=0;j<cut.count&&state.tick+j<schedule.periodFrames;j++){
   const tick=state.tick+j,index=cutIndex(cut,j),posture=frames[index].posture;
   if(!posture)throw Error('Missing photograph landmarks');
   rows.push({tick,index,cut:group,offset:j,transform:cutPhotoTransform(cut,j,posture,clockPhase(tick),yaw)});
  }
  state=cut.after;group++;
 }
 return rows;
}
export function reviewTick(value:number,length:number){return Number.isFinite(value)&&length>0?((Math.floor(value)%length)+length)%length:0;}
