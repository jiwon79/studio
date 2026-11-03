import { expect, test } from 'vitest';
import data from './angles.json';
import { WalkCoverageError, WalkSequencer, CYCLE_FRAMES, clockPhase, createWalkState, orientedPhase, orientedPosture, rebaseWalkState } from './walk-sequencer';
const sequencer = new WalkSequencer(data.frames, data.holdFrames);
const key = (index: number) => `${data.frames[index].source}:${data.frames[index].sourceFrame}`;
for (let yaw = -90; yaw <= 90; yaw += 5) {
    test(`${yaw}° keeps walking for 60 cycles without short source loops or phase drift`, () => {
        let state = createWalkState();
        const shown = new Map<string, number>();
        const cuts: number[] = [];
        for (let i = 0; i < 600; i++) {
            const cut = sequencer.plan(yaw, state);
            expect(cut.relaxed).toBe(false);
            expect(cut.phaseError).toBeLessThanOrEqual(.105);
            expect(cut.phaseGap).toBeGreaterThanOrEqual(-.03);
            expect(cut.phaseGap).toBeLessThanOrEqual(.18);
            if (state.observedEnd !== undefined)
                expect(cut.after.observedEnd! - state.observedEnd).toBeGreaterThan(.02);
            expect(cut.after.tick).toBe((i + 1) * data.holdFrames);
            expect(cut.after.origin).toBe(0);
            // An exact two- or five-cut loop used to pass pose-only checks at +15/+10.
            cuts.push(cut.start);
            for (const period of [2, 3, 5])
                if (cuts.length >= period * 2) {
                    expect(cuts.slice(-period)).not.toEqual(cuts.slice(-2 * period, -period));
                }
            const last = state.last && data.frames[state.last.index];
            if (last?.look === data.frames[cut.start].look) {
                expect(cut.sourceContinuation).toBe(true);
                expect(data.frames[cut.start].clip).toBe(last.clip);
                expect(data.frames[cut.start].sourceFrame).toBe(last.sourceFrame + 1);
                expect(cut.swapped).toBe(state.last!.swapped);
            }
            for (let offset = 0; offset < data.holdFrames; offset++) {
                const index = cut.start + offset, frame = data.frames[index], tick = state.tick + offset;
                expect(Math.abs(frame.yaw - yaw)).toBeLessThanOrEqual(5);
                expect(frame.clip).toBe(cut.clip);
                expect(frame.sourceFrame).toBe(data.frames[cut.start].sourceFrame + offset);
                if (shown.has(key(index)))
                    expect(tick - shown.get(key(index))!).toBeGreaterThanOrEqual(CYCLE_FRAMES);
                shown.set(key(index), tick);
            }
            state = cut.after;
        }
        expect(Math.abs(state.observedEnd! - 60)).toBeLessThan(.15);
    }, 20000);
}
test('discarding decoded future cuts retains only photos that actually reached the screen', () => {
    const first = sequencer.plan(10, createWalkState());
    const displayed = sequencer.afterFrames(first, 1);
    // Speculative planning has no side effects on the actual playback cursor.
    let speculative = first.after;
    for (let i = 0; i < 4; i++)
        speculative = sequencer.plan(10, speculative).after;
    expect(displayed.used.map(row => row.key)).toEqual([key(first.start)]);
    expect(displayed.tick).toBe(1);
    const changed = rebaseWalkState(displayed, 1);
    expect(changed.used).toEqual(displayed.used);
    expect(changed.observedEnd).toBeUndefined();
    expect(sequencer.plan(15, changed)).toEqual(sequencer.plan(15, rebaseWalkState(sequencer.afterFrames(first, 1), 1)));
});
test('direction changes, partial cuts and drag time preserve one advancing clock', () => {
    let state = createWalkState();
    for (let i = 0; i < 740; i++) {
        const yaw = (i % 37) * 5 - 90;
        const cut = sequencer.plan(yaw, rebaseWalkState(state, state.tick));
        const count = i % 3 + 1;
        const displayed = sequencer.afterFrames(cut, count);
        expect(displayed.tick).toBe(state.tick + count);
        expect(displayed.origin).toBe(0);
        expect(cut.relaxed).toBe(false);
        // Simulate a few drag-preview ticks before requesting a new HD view.
        state = rebaseWalkState(displayed, displayed.tick + (i % 4));
    }
});
test('every direction can resume from different photographed gait phases', () => {
    for (let yaw = -90; yaw <= 90; yaw += 5) {
        const pool = sequencer.candidates(yaw);
        for (const index of [0, Math.floor(pool.length / 2), pool.length - 1]) {
            let state = sequencer.seed(pool[index].start, index === 0);
            for (let i = 0; i < 120; i++) {
                const cut = sequencer.plan(yaw, state);
                expect(cut.relaxed).toBe(false);
                state = cut.after;
            }
        }
    }
}, 20000);
test('half-cycle correspondence carries the same feet, motion and confidence together', () => {
    const posture = { lean: 1, axis: 2, confidence: 1, center: [0, 0, 1, 1], soles: [0, 1, 2, 3, 4, 5, 6, 7], velocity: [10, 11, 12, 13, 14, 15, 16, 17], visibility: [.1, .2, .8, .9] };
    const swapped = orientedPosture(posture, true)!;
    expect(swapped.soles).toEqual([4, 5, 6, 7, 0, 1, 2, 3]);
    expect(swapped.velocity).toEqual([14, 15, 16, 17, 10, 11, 12, 13]);
    expect(swapped.visibility).toEqual([.8, .9, .1, .2]);
    expect(orientedPosture(swapped, true)).toEqual(posture);
    const selected = sequencer.candidates(10)[0].start;
    const state = sequencer.seed(selected, true, 0, true);
    expect(clockPhase(-1, state.origin)).toBeCloseTo(orientedPhase(data.frames[selected], true));
    expect(state.last).toEqual({ index: selected, swapped: true, halfCycle: true });
    expect(clockPhase(30)).toBe(0);
    expect(clockPhase(31)).toBeCloseTo(1 / 30);
});
// Scrubbing a paused still is not another walking tick. It must not accumulate
// imaginary future usage and eventually exhaust the direction's source pool.
test('repeated paused direction changes do not consume a whole gait cycle', () => {
    let cut = sequencer.plan(10, createWalkState());
    for (let i = 0; i < 200; i++) {
        const state = rebaseWalkState(sequencer.afterFrames(cut, 1), 0);
        expect(state.used).toEqual([]);
        cut = sequencer.plan(i % 2 ? 10 : 15, state);
        expect(cut.before.tick).toBe(0);
        expect(cut.relaxed).toBe(false);
    }
});
test('missing phase coverage stops selection instead of silently skipping half a stride', () => {
    const frames = [0, 1, 2].map(i => ({ clip: 'only', source: 'test', sourceFrame: i, yaw: 0, phase: .3 + i / 30, atlas: 0, tile: i }));
    const sparse = new WalkSequencer(frames);
    expect(() => sparse.plan(0, createWalkState())).toThrow(WalkCoverageError);
});
test('correcting detector foot labels does not shift the gait clock by half a cycle', () => {
    const selected = sequencer.candidates(80)[0].start;
    const direct = sequencer.seed(selected, false);
    const relabelled = sequencer.seed(selected, true);
    expect(relabelled.origin).toBe(direct.origin);
    expect(relabelled.observedEnd).toBe(direct.observedEnd);
    expect(relabelled.last!.swapped).toBe(true);
    expect(relabelled.last!.halfCycle).toBe(false);
});
