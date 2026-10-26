/** Anatomical reference walk. +x is the person's left, +z walks towards camera.
 * Phase 0 is left heel strike; .5 is right heel strike. Identity never changes.
 * This is an authored IK test gait, not measured human motion capture. */
export type V3 = [
    number,
    number,
    number
];
export type ReferencePose = {
    points: V3[];
    leftSupport: boolean;
    rightSupport: boolean;
    phase: number;
    yaw: number;
};
export const REFERENCE_VERSION = 'anatomical-ik-v1';
export const REFERENCE_HEIGHT = 1.75;
const wrap = (p: number) => ((p % 1) + 1) % 1;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function knee(hip: V3, ankle: V3): V3 {
    const dy = ankle[1] - hip[1], dz = ankle[2] - hip[2], distance = Math.hypot(dy, dz);
    const along = distance / 2, bend = Math.sqrt(Math.max(0, .43 ** 2 - along ** 2));
    return [mix(hip[0], ankle[0], .5), hip[1] + dy * .5 + dz / distance * bend, hip[2] + dz * .5 - dy / distance * bend];
}
export function referencePose(phase: number, yaw = 0): ReferencePose {
    phase = wrap(phase);
    const p: V3[] = Array.from({ length: 33 }, () => [0, 0, 0]);
    const hipY = .86 + .012 * Math.cos(phase * Math.PI * 4), sway = .01 * Math.sin(phase * Math.PI * 2);
    p[23] = [.105 + sway, hipY, 0];
    p[24] = [-.105 + sway, hipY, 0];
    const support: boolean[] = [];
    for (const [side, hipId, kneeId, ankleId, heelId, toeId, offset] of [[1, 23, 25, 27, 29, 31, 0], [-1, 24, 26, 28, 30, 32, .5]]) {
        const t = wrap(phase + offset), stance = t < .6;
        support.push(stance);
        const swing = (t - .6) / .4, progress = swing * swing * (3 - 2 * swing);
        const z = stance ? mix(.26, -.26, t / .6) : mix(-.26, .26, progress);
        const lift = stance ? 0 : .115 * Math.sin(Math.PI * swing);
        const x = side * .07 + sway * .25;
        p[ankleId] = [x, .075 + lift, z];
        p[heelId] = [x, lift, z - .055];
        p[toeId] = [x, lift, z + .15];
        p[kneeId] = knee(p[hipId], p[ankleId]);
    }
    p[11] = [.215 + sway * .4, 1.36, 0];
    p[12] = [-.215 + sway * .4, 1.36, 0];
    for (const [side, shoulder, elbow, wrist, index, offset] of [[1, 11, 13, 15, 19, 0], [-1, 12, 14, 16, 20, .5]]) {
        const swing = -.16 * Math.cos((phase + offset) * Math.PI * 2);
        p[elbow] = [side * .245 + sway * .4, 1.105, swing * .5 + .035];
        p[wrist] = [side * .225 + sway * .4, .87, swing];
        p[index] = [p[wrist][0], .82, swing + .025];
        p[index - 2] = [p[wrist][0] + side * .02, .83, swing - .015];
        p[index + 2] = [p[wrist][0] - side * .02, .85, swing + .025];
        void shoulder;
    }
    p[0] = [sway * .3, 1.635, .10];
    p[7] = [.105 + sway * .3, 1.63, 0];
    p[8] = [-.105 + sway * .3, 1.63, 0];
    for (const i of [1, 2, 3])
        p[i] = [.035 + sway * .3, 1.66, .105];
    for (const i of [4, 5, 6])
        p[i] = [-.035 + sway * .3, 1.66, .105];
    p[9] = [.025, 1.60, .11];
    p[10] = [-.025, 1.60, .11];
    const angle = yaw * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    return { points: p.map(([x, y, z]) => [x * c + z * s, y, -x * s + z * c]), leftSupport: support[0], rightSupport: support[1], phase, yaw };
}
export function projectReference(pose: ReferencePose): number[][] {
    const scale = 660 / REFERENCE_HEIGHT;
    return pose.points.map(([x, y]) => [(256 + x * scale) / 512, (720 - y * scale) / 768, 1]);
}
export const REFERENCE_JOINTS = [25, 26, 27, 28, 29, 30, 31, 32] as const;
export const REFERENCE_WEIGHTS = [.5, .5, 1, 1, .7, .7, .7, .7];
/** Hip-relative, leg-length normalized 2D features; photographs stay untouched. */
export function legFeatures(points: readonly (readonly number[])[]): number[] {
    const hip = [(points[23][0] + points[24][0]) * 256, (points[23][1] + points[24][1]) * 384];
    const distance = (a: number, b: number) => Math.hypot((points[a][0] - points[b][0]) * 512, (points[a][1] - points[b][1]) * 768);
    const length = (distance(23, 25) + distance(25, 27) + distance(24, 26) + distance(26, 28)) / 2;
    return REFERENCE_JOINTS.flatMap(j => [(points[j][0] * 512 - hip[0]) / length, (points[j][1] * 768 - hip[1]) / length]);
}
export function referenceFeatures(phase: number, yaw: number) { return legFeatures(projectReference(referencePose(phase, yaw))); }
export function legError(source: readonly number[], target: readonly number[], confidence: readonly number[] = REFERENCE_JOINTS.map(() => 1)) {
    let error = 0, weight = 0;
    for (let i = 0; i < 8; i++) {
        const w = REFERENCE_WEIGHTS[i] * Math.max(.15, confidence[i]);
        error += ((source[i * 2] - target[i * 2]) ** 2 + (source[i * 2 + 1] - target[i * 2 + 1]) ** 2) * w;
        weight += w;
    }
    return Math.sqrt(error / weight);
}

/** Audit-only permutation. It must never be used as an accepted correspondence. */
export function oppositeLegFeaturesForAudit(f:readonly number[]) {return [1,0,3,2,5,4,7,6].flatMap(j=>[f[j*2],f[j*2+1]]);}
export function suspectedFootRelabel(before:readonly number[],after:readonly number[],confidence:readonly number[]) {
 const direct=legError(after,before,confidence);
 const opposite=legError(oppositeLegFeaturesForAudit(after),before,confidence.map((_,i)=>confidence[i^1]));
 return direct>.14&&opposite*3<direct;
}
