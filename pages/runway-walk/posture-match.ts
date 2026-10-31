export type Posture = { lean: number; axis: number; confidence: number; center: readonly number[]; soles: readonly number[]; visibility: readonly number[]; velocity: readonly number[] };
export type Transition = { leanDelta: number; axisDelta: number; torsoRms: number; footRms: number; footMotion: number; usableSoles: number; leanReliable: boolean; swapped: boolean };
const swapFeet = (values: readonly number[]) => [...values.slice(4,8),...values.slice(0,4)];
/** Pixels in the 512×768 registered photograph, independent of display size. */
function pixelRms(a: readonly number[], b: readonly number[]) {
  return Math.sqrt(a.reduce((sum,v,i)=>sum+((v-b[i])*(i%2?768:512))**2,0)/(a.length/2));
}
export function postureTransition(previous: Posture, next: Posture, swapped = false, predict = false): Transition {
  const feet=swapped?swapFeet(next.soles):next.soles;
  const velocity=swapped?swapFeet(next.velocity):next.velocity;
  const visibility=swapped?[...next.visibility.slice(2,4),...next.visibility.slice(0,2)]:next.visibility;
  let error=0,motion=0,weight=0,usableSoles=0;
  for(let point=0;point<4;point++) {
    const confidence=Math.min(previous.visibility[point],visibility[point]);
    if(confidence<.6) continue;
    usableSoles++;
    for(let axis=0;axis<2;axis++) {
      const i=point*2+axis, pixels=axis?768:512;
      const projected=previous.soles[i]+(predict?previous.velocity[i]:0);
      error+=((feet[i]-projected)*pixels)**2*confidence;
      motion+=((velocity[i]-previous.velocity[i])*pixels)**2*confidence;
    }
    weight+=confidence;
  }
  return { leanDelta:Math.abs(next.lean-previous.lean),axisDelta:Math.abs(next.axis-previous.axis),
    torsoRms:pixelRms(previous.center,next.center),footRms:weight?Math.sqrt(error/weight):0,
    footMotion:weight?Math.sqrt(motion/weight):0,usableSoles,
    leanReliable:Math.min(previous.confidence,next.confidence)>=.65,swapped };
}
/** Same visual foot correspondence as the matcher, for the review overlay. */
export function inspectTransition(previous: Posture, next: Posture, allowSwap = true) {
  const direct=postureTransition(previous,next);
  const swapped=postureTransition(previous,next,true);
  return allowSwap && swapped.usableSoles && swapped.footRms<direct.footRms ? swapped : direct;
}
export function transitionWarning(metrics: Transition) {
  return (metrics.leanReliable && metrics.leanDelta>4) || (metrics.usableSoles>0 && metrics.footRms>32);
}
