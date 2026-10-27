import { test, expect } from 'vitest';
import data from './angles.json';
import poses from './debug-poses.json';
import matches from './reference-matches.json';
import schedule from './reference-schedule.json';
import {auditSequence} from './sequence-audit';
import { referencePose, referenceFeatures, legFeatures, REFERENCE_VERSION } from './gait-reference';
import { ReferenceSequencer,cutIndex } from './reference-sequencer';
import {WalkCoverageError} from './walk-sequencer';
import {createWalkState,CYCLE_FRAMES} from './reference-clock';
const planner = new ReferenceSequencer(data.frames);
const key = (i: number) => `${data.frames[i].source}:${data.frames[i].sourceFrame}`;
const swap = (f: number[]) => [...f.slice(2, 4), ...f.slice(0, 2), ...f.slice(6, 8), ...f.slice(4, 6), ...f.slice(10, 12), ...f.slice(8, 10), ...f.slice(14, 16), ...f.slice(12, 14)];
test('the imported cycle preserves anatomical legs and its original heel-to-toe contacts', () => {
    for (let i = 0; i < 120; i++) {
        const phase = i / 120, p = referencePose(phase), opposite = referencePose(phase + .5);
        expect(p.leftSupport || p.rightSupport).toBe(true);
        expect(p.leftSupport).toBe(opposite.rightSupport);
        expect(p.rightSupport).toBe(opposite.leftSupport);
        for (const j of [29, 30, 31, 32])
            expect(p.points[j][1]).toBeGreaterThanOrEqual(-1e-8);
        if (p.leftSupport) {
            expect(Math.min(p.points[29][1],p.points[31][1])).toBeLessThan(.04);
        }
        if (p.rightSupport) {
            expect(Math.min(p.points[30][1],p.points[32][1])).toBeLessThan(.04);
        }
        expect(p.points[27][0]).toBeGreaterThan(p.points[28][0]);
    }
    expect(referencePose(0).leftSupport).toBe(true);
    expect(referencePose(.5).rightSupport).toBe(true);
});
test('every reference feature still names the same photographed joint', () => {
    expect(matches.version).toBe(REFERENCE_VERSION);
    expect(matches.assetVersion).toBe(data.assetVersion);
    expect(matches.frames).toHaveLength(data.frames.length);
    const lookup = new Map(poses.frames.map(row => [row.key, row.points]));
    data.frames.forEach((frame, i) => { const actual = legFeatures(lookup.get(key(i))!); actual.forEach((v, j) => expect(matches.frames[i].features[j]).toBeCloseTo(v, 4)); expect(Number.isFinite(matches.frames[i].phase)).toBe(true); expect(matches.frames[i].phase).toBeGreaterThanOrEqual(0); expect(matches.frames[i].phase).toBeLessThan(1); void frame; });
});
test('an opposite-foot pose cannot become a valid match by exchanging its labels', () => {
    const features = swap(referenceFeatures(0, 0));
    const frames = [0, 1, 2].map(i => ({ clip: 'opposite', source: 'test', sourceFrame: i, yaw: 0, phase: 0, atlas: 0, tile: i }));
    const fitted = frames.map(() => ({ features, confidence: Array(8).fill(1), stance: 'both', phase: 0, error: 0 }));
    const p = new ReferenceSequencer(frames, 3, fitted);
    expect(p.inspect(0, 0, 0).oppositeFits).toBe(true);
    expect(() => p.plan(0, createWalkState())).toThrow(WalkCoverageError);
});
for (let yaw = -90; yaw <= 90; yaw += 5)
    test(`${yaw}° follows one complete anatomical gait for 60 cycles`, () => {
        let state = createWalkState();
        const used = new Map<string, number>();
        let count = 0;
        while (state.tick < Math.ceil(CYCLE_FRAMES*60)) {
            const cut = planner.plan(yaw, state);
            expect(cut.swapped).toBe(false);
            expect(cut.halfCycle).toBe(false);
            expect(cut.referenceError).toBeLessThanOrEqual(.4);
            expect(cut.count).toBeGreaterThanOrEqual(1);
            expect(cut.count).toBeLessThanOrEqual(3);
            for (let i = 0; i < cut.count; i++) {
                const index = cutIndex(cut,i), tick = state.tick + i, frame = data.frames[index], check = planner.inspect(index, tick, yaw);
                expect(check.oppositeFits).toBe(false);expect(matches.frames[index].uncertain).toBe(false);
                expect(Math.abs(frame.yaw - yaw)).toBeLessThanOrEqual(5);
                if(i){const step=frame.sourceFrame-data.frames[cutIndex(cut,i-1)].sourceFrame;expect(step).toBeGreaterThan(0);expect(step).toBeLessThanOrEqual(cut.qualityVerified?schedule.maxSourceStep:1);}
                const last = used.get(key(index));
                if (last !== undefined)
                    expect(tick - last).toBeGreaterThanOrEqual(CYCLE_FRAMES);
                used.set(key(index), tick);
            }
            expect(cut.after.tick).toBe(state.tick + cut.count);
            expect(cut.after.origin).toBe(0);
            state = cut.after;
            count++;
        }
        expect(count).toBeGreaterThanOrEqual(Math.ceil(CYCLE_FRAMES*60/3));
    }, 20000);
test('discarded future reference cuts never enter displayed-photo history', () => {
    const cut = planner.plan(10, createWalkState()), shown = planner.afterFrames(cut, 1);
    let future = cut.after;
    for (let i = 0; i < 4; i++)
        future = planner.plan(10, future).after;
    expect(shown.used.map(r => r.key)).toEqual([key(cut.start)]);
    expect(shown.tick).toBe(1);
    expect(shown.last!.swapped).toBe(false);
    expect(shown.last!.halfCycle).toBe(false);
});
for(const yaw of Object.keys(schedule.directions).map(Number))
 test(`${yaw}° compiled edit meets every fixed motion gate through four closed loops`,()=>{
  let state=createWalkState();
  while(state.tick<1200){const cut=planner.plan(yaw,state);expect(cut.qualityVerified).toBe(true);expect(cut.count).toBe(3);state=cut.after;}
  const audit=auditSequence(planner,data.frames,yaw,1200);
  expect(audit.quality.pass,JSON.stringify(audit.quality)).toBe(true);
 });
test('angle changes and drag ticks keep the anatomical reference clock and displayed-only history', async () => {
    const { rebaseWalkState } = await import('./walk-sequencer');
    let state = createWalkState();
    for (let i = 0; i < 740; i++) {
        const yaw = (i % 37) * 5 - 90, cut = planner.plan(yaw, rebaseWalkState(state, state.tick));
        const count = Math.min(cut.count, i % 3 + 1), shown = planner.afterFrames(cut, count);
        expect(shown.tick).toBe(state.tick + count);
        expect(shown.origin).toBe(0);
        expect(shown.last!.swapped).toBe(false);
        expect(shown.last!.halfCycle).toBe(false);
        state = rebaseWalkState(shown, shown.tick + i % 4);
    }
});
test('paused angle scrubbing cannot exhaust the reference pool with fictional future frames', async () => {
    const { rebaseWalkState } = await import('./walk-sequencer');
    let cut = planner.plan(10, createWalkState());
    for (let i = 0; i < 150; i++) {
        const state = rebaseWalkState(planner.afterFrames(cut, 1), 0);
        expect(state.used).toEqual([]);
        cut = planner.plan(i % 2 ? 10 : 15, state);
        expect(cut.before.tick).toBe(0);
    }
});

test('a source landmark identity jump is flagged without relabelling a normal passing step',async()=> {
 const {suspectedFootRelabel,oppositeLegFeaturesForAudit}=await import('./gait-reference');
 const before=referenceFeatures(0,90),after=referenceFeatures(1/30,90),confidence=Array(8).fill(1);
 expect(suspectedFootRelabel(before,oppositeLegFeaturesForAudit(after),confidence)).toBe(true);
 for(let tick=0;tick<30;tick++)expect(suspectedFootRelabel(referenceFeatures(tick/30,90),referenceFeatures((tick+1)/30,90),confidence)).toBe(false);
 expect(matches.frames.some(row=>row.uncertain)).toBe(true);
});
