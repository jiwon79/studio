import { buildBlocks, directionCandidates, gaitDistance, type AngleFrame, type AngleBlock } from './angle-match';
import { postureTransition, type Posture } from './posture-match';
export const CYCLE_FRAMES = 30;
const HISTORY_FRAMES = CYCLE_FRAMES * 4;
export class WalkCoverageError extends Error {
}
export type WalkState = {
    tick: number;
    origin: number;
    observedEnd?: number;
    last?: {
        index: number;
        swapped: boolean;
        halfCycle: boolean;
    };
    used: readonly {
        key: string;
        tick: number;
    }[];
    cuts: readonly {
        start: number;
        look: string;
        tick: number;
    }[];
};
export type WalkCut = AngleBlock & {
    swapped: boolean;
    halfCycle: boolean;
    before: WalkState;
    after: WalkState;
    phaseError: number;
    phaseGap: number;
    relaxed: boolean;
    sourceContinuation: boolean;
};
const key = (frame: AngleFrame) => `${frame.source}:${frame.sourceFrame}`;
const wrap = (phase: number) => ((phase % 1) + 1) % 1;
export const clockPhase = (tick: number, origin = 0) => wrap(origin + tick / CYCLE_FRAMES);
export function createWalkState(phase = 0, tick = 0): WalkState { return { tick, origin: phase - tick / CYCLE_FRAMES, used: [], cuts: [] }; }
function swapPairs(values: readonly number[] | undefined) { return values?.length === 8 ? [...values.slice(2, 4), ...values.slice(0, 2), ...values.slice(6, 8), ...values.slice(4, 6)] : values; }
export function orientedPosture(posture: Posture | undefined, swapped: boolean) {
    if (!posture || !swapped)
        return posture;
    return { ...posture, soles: [...posture.soles.slice(4), ...posture.soles.slice(0, 4)], velocity: [...posture.velocity.slice(4), ...posture.velocity.slice(0, 4)], visibility: [...posture.visibility.slice(2), ...posture.visibility.slice(0, 2)] };
}
export function orientedPhase(frame: AngleFrame, halfCycle: boolean) { return wrap(frame.phase + (halfCycle ? .5 : 0)); }
function near(phase: number, target: number) { return phase + Math.round(target - phase); }
function phaseSpan(first: AngleFrame, last: AngleFrame) { return wrap(last.phase - first.phase); }
/** A direction change discards speculative future cuts, preserving elapsed time
 * and the photos actually displayed. Its first view may establish a new foot
 * correspondence; later cuts must continue that correspondence and gait. */
export function rebaseWalkState(state: WalkState, tick: number): WalkState { return { ...state, tick, observedEnd: undefined, used: state.used.filter(row => row.tick < tick), cuts: state.cuts.filter(row => row.tick < tick) }; }
export class WalkSequencer {
    readonly blocks: AngleBlock[];
    private directions = new Map<number, AngleBlock[]>();
    constructor(readonly frames: readonly AngleFrame[], readonly hold = 3) { this.blocks = buildBlocks(frames, hold); }
    candidates(yaw: number) { let pool = this.directions.get(yaw); if (!pool) {
        pool = directionCandidates(this.blocks, yaw);
        this.directions.set(yaw, pool);
    } return pool; }
    /** State after only the frames that reached the screen, never a decoded future. */
    afterFrames(cut: WalkCut, count = this.hold): WalkState {
        const shown = Math.max(0, Math.min(this.hold, count));
        if (!shown)
            return cut.before;
        const rows = this.frames.slice(cut.start, cut.start + shown), end = rows[rows.length - 1], tick = cut.before.tick;
        const used = cut.before.used.filter(row => tick - row.tick < HISTORY_FRAMES).concat(rows.map((frame, i) => ({ key: key(frame), tick: tick + i })));
        const cuts = cut.before.cuts.filter(row => tick - row.tick < HISTORY_FRAMES).concat({ start: cut.start, look: cut.look ?? cut.clip, tick });
        const startPhase = near(orientedPhase(rows[0], cut.halfCycle), cut.before.origin + tick / CYCLE_FRAMES);
        return { ...cut.before, tick: tick + shown, used, cuts, last: { index: cut.start + shown - 1, swapped: cut.swapped, halfCycle: cut.halfCycle }, observedEnd: startPhase + phaseSpan(rows[0], end) };
    }
    seed(index: number, swapped = false, tick = 0, halfCycle = false): WalkState {
        const frame = this.frames[index], phase = orientedPhase(frame, halfCycle);
        return { tick, origin: phase + 1 / CYCLE_FRAMES - tick / CYCLE_FRAMES, observedEnd: phase, last: { index, swapped, halfCycle }, used: [{ key: key(frame), tick: tick - 1 }], cuts: [{ start: index, look: frame.look ?? frame.clip, tick: tick - 1 }] };
    }
    plan(yaw: number, state: WalkState): WalkCut {
        const eligible = this.candidates(yaw);
        if (!eligible.length)
            throw new WalkCoverageError(`No filmed cut for ${yaw}`);
        const time = state.origin + state.tick / CYCLE_FRAMES;
        const last = state.last ? this.frames[state.last.index] : undefined;
        const lastSwap = state.last?.swapped ?? false;
        const previousGait = lastSwap ? swapPairs(last?.gait) : last?.gait;
        const previousVelocity = lastSwap ? swapPairs(last?.gaitVelocity) : last?.gaitVelocity;
        const previousPosture = orientedPosture(last?.posture, lastSwap);
        const predicted = previousGait?.map((v, i) => v + (previousVelocity?.[i] ?? 0));
        const used = new Map(state.used.filter(row => state.tick - row.tick < CYCLE_FRAMES).map(row => [row.key, row.tick]));
        const recentLooks = state.cuts.slice(-4).map(row => row.look);
        // Detector left/right labels and phase origin are separate estimates.
        // Two side-view photos may have the same phase and screen-space stance
        // while their detector labels are reversed. Never force a half-cycle jump
        // solely to correct those labels; compare each mapping independently.
        const options = eligible.flatMap(block => [false, true].flatMap(halfCycle => [false, true].map(swapped => {
            const first = this.frames[block.start], end = this.frames[block.start + this.hold - 1];
            const firstPhase = near(orientedPhase(first, halfCycle), time);
            const endPhase = firstPhase + phaseSpan(first, end);
            const phaseError = Math.max(Math.abs(firstPhase - time), Math.abs(endPhase - (time + (this.hold - 1) / CYCLE_FRAMES)));
            const gap = state.observedEnd === undefined ? 1 / CYCLE_FRAMES : firstPhase - state.observedEnd;
            const repeated = this.frames.slice(block.start, block.start + this.hold).some((frame, i) => {
                const previous = used.get(key(frame));
                return previous !== undefined && state.tick + i - previous < CYCLE_FRAMES;
            });
            const continuation = !!last && first.clip === last.clip && first.sourceFrame === last.sourceFrame + 1 && swapped === lastSwap && halfCycle === state.last?.halfCycle;
            const look = block.look ?? block.clip;
            const immediate = state.cuts[state.cuts.length - 1]?.look === look;
            const posture = orientedPosture(first.posture, swapped);
            const metrics = previousPosture && posture ? postureTransition(previousPosture, posture, false, true) : undefined;
            const gait = swapped ? swapPairs(first.gait) : first.gait;
            const velocity = swapped ? swapPairs(first.gaitVelocity) : first.gaitVelocity;
            const exactAge = [...state.cuts].reverse().find(row => row.start === block.start);
            const reuseCost = exactAge ? Math.max(0, 1 - (state.tick - exactAge.tick) / HISTORY_FRAMES) : 0;
            const cost = phaseError * 22 + Math.abs(gap - 1 / CYCLE_FRAMES) * 5 + Math.abs(block.yaw - yaw) / 18 +
                gaitDistance(gait, predicted) * 18 + gaitDistance(velocity, previousVelocity) * 22 +
                (metrics ? (metrics.leanReliable ? metrics.leanDelta / 5 : 0) + metrics.footRms / 24 + metrics.footMotion / 18 + metrics.torsoRms / 80 : 0) +
                (immediate ? (continuation ? .45 : 4) : recentLooks.includes(look) ? .18 : 0) + reuseCost * .6;
            return { block, swapped, halfCycle, phaseError, gap, repeated, continuation, immediate, cost, metrics };
        })));
        // Time and frame freshness precede pose similarity. A similar still cannot
        // reset the clock, reverse a stride, or replay its source inside one cycle.
        // Source annotations are approximate: up to one frame of phase overlap is
        // acceptable, while the END of each real three-frame stride must advance.
        const fresh = options.filter(o => !o.repeated && o.gap >= -.03 &&
            o.gap + phaseSpan(this.frames[o.block.start], this.frames[o.block.start + this.hold - 1]) > .02 && (!o.immediate || o.continuation));
        if (!fresh.length)
            throw new WalkCoverageError(`No forward, unrepeated source cut for ${yaw}`);
        const bestPhaseError = Math.min(...fresh.map(o => o.phaseError));
        const timed = fresh.filter(o => o.phaseError <= Math.min(.105, bestPhaseError + .01) && o.gap <= .18);
        if (!timed.length)
            throw new WalkCoverageError(`No timed source cut for ${yaw}`);
        const pool = timed;
        const safe = pool.filter(o => !o.metrics || ((!o.metrics.leanReliable || o.metrics.leanDelta <= 4) && (!o.metrics.usableSoles || o.metrics.footRms <= 32)));
        const acceptable = safe.length ? safe : pool;
        const different = acceptable.filter(o => !o.immediate);
        const choose = different.length ? different : acceptable;
        const best = choose.reduce((a, b) => a.cost < b.cost ? a : b);
        const cut = { ...best.block, swapped: best.swapped, halfCycle: best.halfCycle, before: state, after: state, phaseError: best.phaseError, phaseGap: best.gap, relaxed: false, sourceContinuation: best.continuation };
        cut.after = this.afterFrames(cut);
        return cut;
    }
}
