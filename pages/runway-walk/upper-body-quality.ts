import {projectReference,referencePose} from './gait-reference';
import {percentile} from './motion-quality';
import {transformPhotoPoint,type PhotoTransform} from './photo-registration';

// Rounded up from the accepted +85° edit. Cuts and native source steps are
// measured separately so two small native steps cannot hide an identity jump.
export const UPPER_BODY_LIMITS={withinP95:7,withinMax:8,cutP95:21,cutMax:34,coverage:.95} as const;
const faceJoints=[0,2,5,9,10];
export function faceCenter(points:readonly (readonly number[])[]):number[]{
 return [0,1].map(axis=>faceJoints.reduce((sum,j)=>sum+points[j][axis],0)/faceJoints.length);
}
export function alignedFace(points:readonly (readonly number[])[],transform:PhotoTransform){
 return {center:transformPhotoPoint(faceCenter(points),transform),confidence:Math.min(...faceJoints.map(j=>points[j][2]))};
}
type Face=ReturnType<typeof alignedFace>;
export function measureFace(previous:Face,next:Face,previousPhase:number,nextPhase:number,yaw:number){
 const a=faceCenter(projectReference(referencePose(previousPhase,yaw))),b=faceCenter(projectReference(referencePose(nextPhase,yaw)));
 return {residual:Math.hypot((next.center[0]-previous.center[0]-b[0]+a[0])*512,(next.center[1]-previous.center[1]-b[1]+a[1])*768),reliable:Math.min(previous.confidence,next.confidence)>=.65};
}
export function summarizeUpperBody(rows:readonly (ReturnType<typeof measureFace>&{cut:boolean})[]){
 const measured=rows.filter(r=>r.reliable),within=measured.filter(r=>!r.cut).map(r=>r.residual),cuts=measured.filter(r=>r.cut).map(r=>r.residual);
 const quality={coverage:rows.length?measured.length/rows.length:0,withinP95:percentile(within,.95),withinMax:Math.max(0,...within),cutP95:percentile(cuts,.95),cutMax:Math.max(0,...cuts)};
 const l=UPPER_BODY_LIMITS;
 return {...quality,pass:quality.coverage>=l.coverage&&quality.withinP95<=l.withinP95&&quality.withinMax<=l.withinMax&&quality.cutP95<=l.cutP95&&quality.cutMax<=l.cutMax};
}
