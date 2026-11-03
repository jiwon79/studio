/** Existing Quaternius mannequin / Walk_Formal_Loop, sampled from the GLB.
 * +x is the person's left, +z faces the front camera. No authored IK is used.
 * The rendered mesh and this lightweight matcher use the same clip/time/rig.
 */
import motion from './reference-motion.json';
export type V3 = [number, number, number];
export type ReferencePose = {points: V3[];leftSupport:boolean;rightSupport:boolean;phase:number;yaw:number};
export const REFERENCE_VERSION = motion.version;
export const REFERENCE_MODEL_HASH = motion.modelHash;
export const REFERENCE_HEIGHT = motion.height;
export const REFERENCE_DURATION = motion.duration;
export const wrapPhase = (p:number) => ((p%1)+1)%1;
export function referencePose(phase:number,yaw=0):ReferencePose {
    phase=wrapPhase(phase);
    const position=phase*motion.sampleCount,index=Math.floor(position),blend=position-index;
    const a=motion.samples[index],b=motion.samples[(index+1)%motion.sampleCount];
    const points=a.map((p,j)=>p.map((v,k)=>v+(b[j][k]-v)*blend)) as V3[];
    const leftSupport=Math.min(points[29][1],points[31][1])<.04;
    const rightSupport=Math.min(points[30][1],points[32][1])<.04;
    const angle=yaw*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    return {points:points.map(([x,y,z])=>[x*c+z*s,y,-x*s+z*c]),leftSupport,rightSupport,phase,yaw};
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
