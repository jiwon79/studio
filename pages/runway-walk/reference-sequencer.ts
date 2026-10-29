import { buildBlocks, directionCandidates, validSourceRun, type AngleBlock, type AngleFrame } from './angle-match';
import matches from './reference-matches.json';
import motion from './reference-motion.json';
import { postureTransition } from './posture-match';
import {WalkCoverageError,type WalkState} from './walk-sequencer';
import {clockPhase,createWalkState,CYCLE_FRAMES,MIN_REUSE_FRAMES} from './reference-clock';
import { legError, referenceFeatures, referencePose } from './gait-reference';
import schedule from './reference-schedule.json';
import {audits,blockHeld} from './review-policy';
import {measureMotion,MOTION_LIMITS} from './motion-quality';
import {PHOTO_REGISTRATION_VERSION,photoTransform,transformPosture,IDENTITY_PHOTO,validPhotoTransforms,type PhotoTransform} from './photo-registration';
type CompiledSchedule=Omit<typeof schedule,'directions'|'registration'> & {directions:Record<string,(number|number[])[]>;registration?:{version:string;yaws:number[];photoTransforms?:Record<string,PhotoTransform[]>}};
const compiled:CompiledSchedule=schedule;
export const cutIndex=(cut:ReferenceCut,offset:number)=>cut.indices?.[offset]??cut.start+offset;
export const cutIndices=(cut:ReferenceCut,count=cut.count)=>Array.from({length:count},(_,i)=>cutIndex(cut,i));
export type ReferenceCut = AngleBlock & {
    qualityVerified?: boolean;
    registered?: boolean;
    photoTransforms?: readonly PhotoTransform[];
    indices?: readonly number[];
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
    private verifiedSchedule=false;
    readonly blocks: AngleBlock[];
    constructor(readonly frames: readonly AngleFrame[], readonly hold = 3, readonly fitted: readonly Match[] = matches.frames) {
        if(fitted===matches.frames&&(matches.referenceModelHash!==motion.modelHash||matches.referenceDuration!==motion.duration))throw new Error('Photograph fits are for a different reference animation');
        if (frames.length !== fitted.length)
            throw new Error('Reference poses do not match the photograph library');
        this.blocks = buildBlocks(frames, hold);
        const validTransforms=Object.entries(compiled.registration?.photoTransforms??{}).every(([yaw,rows])=>compiled.registration?.yaws.includes(+yaw)&&!!compiled.directions[yaw]&&validPhotoTransforms(rows,schedule.periodFrames));
        this.verifiedSchedule=validTransforms&&(!compiled.registration||compiled.registration.version===PHOTO_REGISTRATION_VERSION)&&fitted===matches.frames&&hold===3&&schedule.assetVersion===matches.assetVersion&&schedule.matchVersion===matches.matchVersion&&schedule.cycleFrames===CYCLE_FRAMES&&schedule.minReuseFrames===MIN_REUSE_FRAMES&&JSON.stringify(schedule.reviewPolicy)===JSON.stringify(audits);
    }
    usesRegistration(yaw:number){return this.verifiedSchedule&&!!compiled.registration?.yaws.includes(yaw);}
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
        const phase = clockPhase(tick, origin), {leftSupport,rightSupport} = referencePose(phase);
        const supportConflict = source.stance === 'left' && !leftSupport || source.stance === 'right' && !rightSupport;
        return { direct, opposite, oppositeFits, supportConflict };
    }
    seed(index: number, tick = 0): WalkState { const phase = this.fitted[index].phase; return { ...createWalkState(phase + 1 / CYCLE_FRAMES, tick), last: { index, swapped: false, halfCycle: false }, used: [{ key: key(this.frames[index]), tick: tick - 1 }], cuts: [{ start: index, look: this.frames[index].look ?? this.frames[index].clip, tick: tick - 1 }] }; }
    afterFrames(cut: ReferenceCut, count = cut.count): WalkState {
        count = Math.max(0, Math.min(cut.count, count));
        if (!count)
            return cut.before;
        const tick = cut.before.tick, rows = cutIndices(cut,count).map(i=>this.frames[i]);
        return { ...cut.before, tick: tick + count, observedEnd: cut.before.origin + (tick + count - 1) / CYCLE_FRAMES, last: { index: cutIndex(cut,count-1), swapped: false, halfCycle: false }, used: cut.before.used.filter(r => tick - r.tick < CYCLE_FRAMES*4).concat(rows.map((row, i) => ({ key: key(row), tick: tick + i }))), cuts: cut.before.cuts.filter(r => tick - r.tick < CYCLE_FRAMES*4).concat({ start: cut.start, look: cut.look ?? cut.clip, tick }) };
    }
    /** Offline paths include the loop boundary and fixed three-frame appearances.
     * The clock remains the imported clip's native clock. A drag may enter the
     * middle of a cut; only that initial partial cut can be shorter than three. */
    private scheduled(yaw:number,state:WalkState):ReferenceCut|undefined {
        if(!this.verifiedSchedule||state.origin!==0)return;
        const starts=compiled.directions[String(yaw)];if(!starts?.length)return;
        const registered=this.usesRegistration(yaw);
        const registeredRows=compiled.registration?.photoTransforms?.[String(yaw)];
        const preferred=state.referenceSchedule?.yaw===yaw?state.referenceSchedule.shift:0;
        const shifts=[preferred,...[0,100,200].filter(s=>s!==preferred)];
        const used=new Map(state.used.map(r=>[r.key,r.tick]));
        for(const shift of shifts){
            const position=((state.tick+shift)%schedule.periodFrames+schedule.periodFrames)%schedule.periodFrames;
            const offset=position%3,entry=starts[Math.floor(position/3)];
            const indices=(typeof entry==='number'?[entry,entry+1,entry+2]:entry).slice(offset),start=indices[0],count=3-offset;
            const rows=indices.map(i=>this.frames[i]),first=rows[0];
            const allowReverse=compiled.boundaryReview.yaws.includes(yaw);
            if(rows.length!==count||!validSourceRun(rows,schedule.maxSourceStep??1,allowReverse)||rows.some((f,i)=>Math.abs(f.yaw-yaw)>5||this.fitted[indices[i]].uncertain||state.tick+i-(used.get(key(f))??-1000)<MIN_REUSE_FRAMES)||blockHeld(first.clip,first.sourceFrame,rows[count-1].sourceFrame,yaw))continue;
            const checks=rows.map((_,i)=>this.inspect(indices[i],state.tick+i,yaw));if(checks.some(c=>c.oppositeFits))continue;
            const direct=checks.reduce((s,c)=>s+c.direct,0)/count;if(direct>.4)continue;
            if(state.last&&state.referenceSchedule?.yaw===yaw){
                const a=this.frames[state.last.index].posture,b=first.posture;
                if(!a||!b)continue;
                const pa=clockPhase(state.tick-1),pb=clockPhase(state.tick);
                const lastShift=state.referenceSchedule.shift;
                const lastPosition=((state.tick-1+lastShift)%schedule.periodFrames+schedule.periodFrames)%schedule.periodFrames;
                const ta=registeredRows?.[lastPosition]??(registered?photoTransform(a,pa,yaw):IDENTITY_PHOTO);
                const tb=registeredRows?.[position]??(registered?photoTransform(b,pb,yaw):IDENTITY_PHOTO);
                const m=measureMotion(transformPosture(a,ta),transformPosture(b,tb),pa,pb,yaw);
                if(m.footResidual>MOTION_LIMITS.footMax||m.leanResidual>MOTION_LIMITS.leanMax||m.torsoResidual>MOTION_LIMITS.torsoMax)continue;
            }
            const before={...state,referenceSchedule:{yaw,shift}};
            const cut:ReferenceCut={start,indices,registered,yaw:rows.reduce((s,f)=>s+f.yaw,0)/count,phase:first.phase,clip:first.clip,look:first.look??first.clip,sourceFrame:first.sourceFrame,lastSourceFrame:rows[count-1].sourceFrame,count,before,after:before,swapped:false,halfCycle:false,phaseError:Math.abs(((this.fitted[start].phase-clockPhase(state.tick)+.5)%1+1)%1-.5),phaseGap:1/CYCLE_FRAMES,relaxed:false,sourceContinuation:false,referenceError:direct,oppositeError:checks.reduce((s,c)=>s+c.opposite,0)/count,identityRejected:false,qualityVerified:true};
            if(registeredRows)cut.photoTransforms=registeredRows.slice(position,position+count);
            cut.after=this.afterFrames(cut);return cut;
        }
    }
    plan(yaw: number, state: WalkState, lookahead = 5): ReferenceCut {
        const scheduled=this.scheduled(yaw,state);if(scheduled)return scheduled;
        for (let count = this.hold; count >= 1; count--) {
            const used = new Map(state.used.map(r => [r.key, r.tick])), last = state.last ? this.frames[state.last.index] : undefined;
            const options = this.candidates(yaw, count).flatMap(block => {
                const first = this.frames[block.start], look = block.look ?? block.clip;
                if (this.frames.slice(block.start, block.start + count).some((f, i) => state.tick + i - (used.get(key(f)) ?? -1000) < MIN_REUSE_FRAMES))
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
            // A locally closest three-frame run can consume the only photo
            // needed just afterwards. Reserve a viable short future instead of
            // reaching a dead end and repeating or reversing the same stride.
            const ranked=[...pool].sort((a,b)=>a.cost-b.cost);
            for(const best of ranked){
                const cut: ReferenceCut = { ...best.block, count, before: state, after: state, swapped: false, halfCycle: false, phaseError: best.phaseError, phaseGap: 1 / CYCLE_FRAMES, relaxed: false, sourceContinuation: best.continuation, referenceError: best.direct, oppositeError: best.opposite, identityRejected: false };
                cut.after = this.afterFrames(cut);
                if(lookahead){try{this.plan(yaw,cut.after,lookahead-1);}catch(error){if(error instanceof WalkCoverageError)continue;throw error;}}
                return cut;
            }
        }
        throw new WalkCoverageError(`No anatomically compatible photograph for ${yaw}° at phase ${clockPhase(state.tick, state.origin).toFixed(2)}`);
    }
}
