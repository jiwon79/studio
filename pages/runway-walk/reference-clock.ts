import {REFERENCE_DURATION,wrapPhase} from './gait-reference';
import type {WalkState} from './walk-sequencer';
/** Native duration of the downloaded clip, at the artwork's 25 displayed fps. */
export const CYCLE_FRAMES=REFERENCE_DURATION*25;
export const clockPhase=(tick:number,origin=0)=>wrapPhase(origin+tick/CYCLE_FRAMES);
export function createWalkState(phase=0,tick=0):WalkState {
    return {tick,origin:phase-tick/CYCLE_FRAMES,used:[],cuts:[]};
}
