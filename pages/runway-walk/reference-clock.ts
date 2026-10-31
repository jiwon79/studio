import {REFERENCE_DURATION,wrapPhase} from './gait-reference';
import type {WalkState} from './walk-sequencer';
/** Native duration of the downloaded clip, at the artwork's 25 displayed fps. */
export const CYCLE_FRAMES=REFERENCE_DURATION*25;
/** A native cycle is 33⅓ display ticks. Reuse may occur at its nearest
 * sampled return (33), while phase always uses the unrounded native clock.
 * Rounding the exclusion interval up rejects legitimate adjacent cycles. */
export const MIN_REUSE_FRAMES=Math.round(CYCLE_FRAMES);
export const clockPhase=(tick:number,origin=0)=>wrapPhase(origin+tick/CYCLE_FRAMES);
export function createWalkState(phase=0,tick=0):WalkState {
    return {tick,origin:phase-tick/CYCLE_FRAMES,used:[],cuts:[]};
}
