import type {Posture} from './posture-match';
import {projectReference,referencePose} from './gait-reference';

/** Direction and speed inside one photographed appearance. Translation of the
 * whole person must not manufacture leg motion. Compare anatomical feet relative
 * to the hips; a planted foot moving backwards is normal when the reference does.
 * These are screening thresholds, not calibrated perceptual quality scores. */
export const PROGRESS_LIMITS={visibility:.6,minExpected:8,minActual:4,reverseCosine:-.25,stallRatio:.25} as const;
export const PROGRESS_VERSION='hip-relative-steps-v1';
export type GaitProgress={actual:number;expected:number;cosine:number|null;gain:number|null;speedRatio:number|null;usableSoles:number;bothFeet:boolean;status:'forward'|'reverse'|'stall'|'small-motion'|'unmeasurable'};
const relative=(p:Posture)=>p.soles.map((v,i)=>(v-p.center[2+i%2])*(i%2?768:512));
function referenceRelative(phase:number,yaw:number){
 const p=projectReference(referencePose(phase,yaw));
 return [29,31,30,32].flatMap(j=>[0,1].map(k=>(p[j][k]-(p[23][k]+p[24][k])/2)*(k?768:512)));
}
export function measureGaitProgress(first:Posture,last:Posture,firstPhase:number,lastPhase:number,yaw:number):GaitProgress{
 const a=relative(first),b=relative(last),ra=referenceRelative(firstPhase,yaw),rb=referenceRelative(lastPhase,yaw);
 let aa=0,bb=0,ab=0,weight=0,usableSoles=0,left=false,right=false;
 for(let j=0;j<4;j++){
  const w=Math.min(first.visibility[j],last.visibility[j]);if(w<PROGRESS_LIMITS.visibility)continue;
  usableSoles++;if(j<2)left=true;else right=true;
  for(let k=0;k<2;k++){const i=j*2+k,v=b[i]-a[i],r=rb[i]-ra[i];aa+=v*v*w;bb+=r*r*w;ab+=v*r*w;}weight+=w;
 }
 const actual=weight?Math.sqrt(aa/weight):0,expected=weight?Math.sqrt(bb/weight):0;
 const cosine=aa>0&&bb>0?ab/Math.sqrt(aa*bb):null,gain=bb>0?ab/bb:null,speedRatio=expected>0?actual/expected:null,bothFeet=left&&right;
 const status=!bothFeet?'unmeasurable':expected<PROGRESS_LIMITS.minExpected?'small-motion':actual<expected*PROGRESS_LIMITS.stallRatio?'stall':actual>=PROGRESS_LIMITS.minActual&&cosine!==null&&cosine<PROGRESS_LIMITS.reverseCosine?'reverse':'forward';
 return {actual,expected,cosine,gain,speedRatio,usableSoles,bothFeet,status};
}
export function measureAppearanceProgress(poses:readonly [Posture,Posture,Posture],phases:readonly [number,number,number],yaw:number){
 const span=measureGaitProgress(poses[0],poses[2],phases[0],phases[2],yaw);
 const steps=[measureGaitProgress(poses[0],poses[1],phases[0],phases[1],yaw),measureGaitProgress(poses[1],poses[2],phases[1],phases[2],yaw)];
 // A single low-displacement sample also occurs frequently in the accepted
 // -70° sequence. Require a slow *whole appearance* for a stall warning; retain
 // the individual step measurements without labelling every pause a defect.
 const all=[span,...steps],status:GaitProgress['status']=all.some(m=>m.status==='unmeasurable')?'unmeasurable':all.some(m=>m.status==='reverse')?'reverse':span.status;
 return {...span,status,steps};
}
