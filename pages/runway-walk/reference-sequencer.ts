import { buildBlocks, directionCandidates, type AngleBlock, type AngleFrame } from './angle-match';
import matches from './reference-matches.json';
import { postureTransition } from './posture-match';
import { clockPhase, createWalkState, WalkCoverageError, type WalkState } from './walk-sequencer';
import { legError, referenceFeatures } from './gait-reference';
export type ReferenceCut = AngleBlock & {
    count: number;
    before: WalkState;
    after: WalkState;
    swapped: false;
    halfCycle: false;
    phaseError: number;
    phaseGap: number;
    relaxed: false;
    sourceContinuation: boolean;
    referenceError: number;
    oppositeError: number;
    identityRejected: false;
};
type Match = {
    uncertain?:boolean;
    phase: number;
    error: number;
    stance: string;
    features: number[];
    confidence: number[];
};
const exchange = (f: readonly number[]) => [...f.slice(2, 4), ...f.slice(0, 2), ...f.slice(6, 8), ...f.slice(4, 6), ...f.slice(10, 12), ...f.slice(8, 10), ...f.slice(14, 16), ...f.slice(12, 14)];
const key = (frame: AngleFrame) => `${frame.source}:${frame.sourceFrame}`;
export class ReferenceSequencer {
    private pools = new Map<string, AngleBlock[]>();
    private targets = new Map<string, number[]>();
    readonly blocks: AngleBlock[];
    constructor(readonly frames: readonly AngleFrame[], readonly hold = 3, readonly fitted: readonly Match[] = matches.frames) {
        if (frames.length !== fitted.length)
            throw new Error('Reference poses do not match the photograph library');
        this.blocks = buildBlocks(frames, hold);
    }
    candidates(yaw: number, count = this.hold) {
        const id = `${yaw}:${count}`;
        let pool = this.pools.get(id);
        if (!pool) {
            pool = directionCandidates(count === this.hold ? this.blocks : buildBlocks(this.frames, count), yaw).filter(b => Math.max(Math.abs((b.minYaw ?? b.yaw) - yaw), Math.abs((b.maxYaw ?? b.yaw) - yaw)) <= 5 && this.fitted.slice(b.start,b.start+count).every(row=>row.error<=.4&&!row.uncertain));
            this.pools.set(id, pool);
        }
        return pool;
    }
    target(tick: number, yaw: number, origin = 0) {
        const phase = clockPhase(tick, origin), id = `${yaw}:${phase.toFixed(6)}`;
        let result = this.targets.get(id);
        if (!result) {
            result = referenceFeatures(phase, yaw);
            if (this.targets.size > 6000)
                this.targets.clear();
            this.targets.set(id, result);
        }
        return result;
    }
    /** Anatomical source IDs are fixed. Opposite-foot scores are rejection tests,
     * never an alternative correspondence, phase shift or mirrored photograph. */
    inspect(index: number, tick: number, yaw: number, origin = 0) {
        const source = this.fitted[index], target = this.target(tick, yaw, origin);
        const direct = legError(source.features, target, source.confidence), opposite = legError(exchange(source.features), target, source.confidence.map((_, i) => source.confidence[i ^ 1]));
        const separation = Math.hypot(target[4] - target[6], target[5] - target[7]);
        const oppositeFits = separation > .10 && direct > opposite + .025 && direct > opposite * 1.15;
        const phase = clockPhase(tick, origin), leftSupport = phase < .6, rightSupport = (phase + .5) % 1 < .6;
        const supportConflict = source.stance === 'left' && !leftSupport || source.stance === 'right' && !rightSupport;
        return { direct, opposite, oppositeFits, supportConflict };
    }
    seed(index: number, tick = 0): WalkState { const phase = this.fitted[index].phase; return { ...createWalkState(phase + 1 / 30, tick), last: { index, swapped: false, halfCycle: false }, used: [{ key: key(this.frames[index]), tick: tick - 1 }], cuts: [{ start: index, look: this.frames[index].look ?? this.frames[index].clip, tick: tick - 1 }] }; }
    afterFrames(cut: ReferenceCut, count = cut.count): WalkState {
        count = Math.max(0, Math.min(cut.count, count));
        if (!count)
            return cut.before;
        const tick = cut.before.tick, rows = this.frames.slice(cut.start, cut.start + count);
        return { ...cut.before, tick: tick + count, observedEnd: cut.before.origin + (tick + count - 1) / 30, last: { index: cut.start + count - 1, swapped: false, halfCycle: false }, used: cut.before.used.filter(r => tick - r.tick < 120).concat(rows.map((row, i) => ({ key: key(row), tick: tick + i }))), cuts: cut.before.cuts.filter(r => tick - r.tick < 120).concat({ start: cut.start, look: cut.look ?? cut.clip, tick }) };
    }
    plan(yaw: number, state: WalkState): ReferenceCut {
        for (let count = this.hold; count >= 1; count--) {
            const used = new Map(state.used.map(r => [r.key, r.tick])), last = state.last ? this.frames[state.last.index] : undefined;
            const options = this.candidates(yaw, count).flatMap(block => {
                const first = this.frames[block.start], look = block.look ?? block.clip;
                if (this.frames.slice(block.start, block.start + count).some((f, i) => state.tick + i - (used.get(key(f)) ?? -1000) < 30))
                    return [];
                const continuation = !!last && first.clip === last.clip && first.sourceFrame === last.sourceFrame + 1;
                if (state.cuts[state.cuts.length - 1]?.look === look && !continuation)
                    return [];
                const comparisons = Array.from({ length: count }, (_, i) => this.inspect(block.start + i, state.tick + i, yaw, state.origin));
                if (comparisons.some(c => c.oppositeFits))
                    return [];
                const direct = comparisons.reduce((s, c) => s + c.direct, 0) / count, opposite = comparisons.reduce((s, c) => s + c.opposite, 0) / count;
                // A body-length-normalized residual above .4 is missing coverage, not
                // permission to relabel the foot on a distant or unsuitable photograph.
                if (direct > .4)
                    return [];
                const expected = clockPhase(state.tick, state.origin), phase = this.fitted[block.start].phase;
                const phaseError = Math.abs(((phase - expected + .5) % 1 + 1) % 1 - .5);
                if (phaseError > .22)
                    return [];
                let motion = 0;
                for (let i = 1; i < count; i++) {
                    const a = this.fitted[block.start + i - 1].features, b = this.fitted[block.start + i].features;
                    const x = this.target(state.tick + i - 1, yaw, state.origin), y = this.target(state.tick + i, yaw, state.origin);
                    motion += Math.sqrt(b.reduce((sum, v, j) => sum + ((v - a[j]) - (y[j] - x[j])) ** 2, 0) / 16);
                }
                const recent = state.cuts.slice(-4).some(r => r.look === look), support = comparisons.filter(c => c.supportConflict).length / count;
                const transition = last?.posture && first.posture ? postureTransition(last.posture, first.posture, false, true) : undefined;
                const continuity = transition ? (transition.leanReliable ? transition.leanDelta / 8 : 0) + transition.torsoRms / 140 + transition.footRms / 100 : 0;
                return [{ block, direct, opposite, phaseError, continuation, transition, cost: continuity + direct * 12 + motion * 9 + phaseError * .4 + support * .12 + Math.abs(block.yaw - yaw) * .012 + (recent ? .035 : 0) }];
            });
            if (!options.length)
                continue;
            const safe = options.filter(o => !o.transition || ((!o.transition.leanReliable || o.transition.leanDelta <= 4) && (!o.transition.usableSoles || o.transition.footRms <= 32)));
            const pool = safe.length ? safe : options;
            const best = pool.reduce((a, b) => a.cost < b.cost ? a : b);
            const cut: ReferenceCut = { ...best.block, count, before: state, after: state, swapped: false, halfCycle: false, phaseError: best.phaseError, phaseGap: 1 / 30, relaxed: false, sourceContinuation: best.continuation, referenceError: best.direct, oppositeError: best.opposite, identityRejected: false };
            cut.after = this.afterFrames(cut);
            return cut;
        }
        throw new WalkCoverageError(`No anatomically compatible photograph for ${yaw}° at phase ${clockPhase(state.tick, state.origin).toFixed(2)}`);
    }
}
