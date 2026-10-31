import type {Posture} from './posture-match';
import {projectReference,referencePose} from './gait-reference';
/** Fixed visual gates in the 512×768 registered photograph. These measure
 * cross-person motion continuity; selection fit alone is not a quality result. */
export const MOTION_LIMITS={footP95:24,footMax:48,leanP95:3,leanMax:6,torsoP95:12,torsoMax:24,measurementCoverage:.95,appearanceFrames:3,displayGapP95:60,displayGapMax:100} as const;
export type MotionQuality={footResidual:number;rawFootJump:number;torsoResidual:number;leanResidual:number;usableSoles:number;leanReliable:boolean};
const projections=new Map<string,{soles:number[];center:number[];lean:number}>();
function referencePosture(phase:number,yaw:number){
    const key=`${yaw}:${phase.toFixed(6)}`,cached=projections.get(key);if(cached)return cached;
    const p=projectReference(referencePose(phase,yaw));
    const shoulder=[(p[11][0]+p[12][0])*256,(p[11][1]+p[12][1])*384],hip=[(p[23][0]+p[24][0])*256,(p[23][1]+p[24][1])*384];
    const value={soles:[29,31,30,32].flatMap(j=>[p[j][0]*512,p[j][1]*768]),center:[...shoulder,...hip],lean:Math.atan2(shoulder[0]-hip[0],hip[1]-shoulder[1])*180/Math.PI};
    if(projections.size>16000)projections.clear();projections.set(key,value);return value;
}
export function measureMotion(previous:Posture,next:Posture,previousPhase:number,nextPhase:number,yaw:number):MotionQuality{
    const a=referencePosture(previousPhase,yaw),b=referencePosture(nextPhase,yaw);
    let residual=0,raw=0,weight=0,usableSoles=0;
    for(let j=0;j<4;j++){
        const confidence=Math.min(previous.visibility[j],next.visibility[j]);if(confidence<.6)continue;usableSoles++;
        for(let axis=0;axis<2;axis++){const i=j*2+axis,pixels=axis?768:512,actual=(next.soles[i]-previous.soles[i])*pixels,expected=b.soles[i]-a.soles[i];residual+=(actual-expected)**2*confidence;raw+=actual**2*confidence;}weight+=confidence;
    }
    const torsoResidual=Math.sqrt(next.center.reduce((sum,v,i)=>{const actual=(v-previous.center[i])*(i%2?768:512),expected=b.center[i]-a.center[i];return sum+(actual-expected)**2;},0)/2);
    return {footResidual:usableSoles>=2?Math.sqrt(residual/weight):Infinity,rawFootJump:weight?Math.sqrt(raw/weight):Infinity,torsoResidual,leanResidual:Math.abs((next.lean-previous.lean)-(b.lean-a.lean)),usableSoles,leanReliable:Math.min(previous.confidence,next.confidence)>=.65};
}
export function percentile(values:readonly number[],q:number){if(!values.length)return Infinity;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.ceil(q*sorted.length)-1)];}
export function summarizeMotion(rows:readonly MotionQuality[],runs:readonly number[]){
    const feet=rows.filter(r=>Number.isFinite(r.footResidual)).map(r=>r.footResidual),lean=rows.filter(r=>r.leanReliable).map(r=>r.leanResidual),torso=rows.map(r=>r.torsoResidual);
    const report={transitions:rows.length,coverage:rows.length?feet.length/rows.length:0,leanCoverage:rows.length?lean.length/rows.length:0,footP95:percentile(feet,.95),footMax:Math.max(0,...feet),leanP95:percentile(lean,.95),leanMax:Math.max(0,...lean),torsoP95:percentile(torso,.95),torsoMax:Math.max(0,...torso),minRun:Math.min(...runs),maxRun:Math.max(...runs),equalDuration:runs.length>0&&runs.every(n=>n===MOTION_LIMITS.appearanceFrames)};
    const pass=report.coverage>=MOTION_LIMITS.measurementCoverage&&report.leanCoverage>=MOTION_LIMITS.measurementCoverage&&report.footP95<=MOTION_LIMITS.footP95&&report.footMax<=MOTION_LIMITS.footMax&&report.leanP95<=MOTION_LIMITS.leanP95&&report.leanMax<=MOTION_LIMITS.leanMax&&report.torsoP95<=MOTION_LIMITS.torsoP95&&report.torsoMax<=MOTION_LIMITS.torsoMax&&report.equalDuration;
    return {...report,pass};
}
