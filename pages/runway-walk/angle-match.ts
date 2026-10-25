export type AngleFrame = { clip: string; look?: string; source: string; sourceFrame: number; yaw: number; phase: number; atlas: number; tile: number; gait?: readonly number[]; gaitVelocity?: readonly number[] };
export type AngleBlock = { start: number; yaw: number; minYaw?: number; maxYaw?: number; phase: number; clip: string; look?: string; gait?: readonly number[]; gaitVelocity?: readonly number[] };
export function buildBlocks(frames: readonly AngleFrame[], hold = 3): AngleBlock[] {
  return frames.flatMap((f, start) => {
    for (let offset = 1; offset < hold; offset++) {
      const next = frames[start + offset];
      if (!next || next.clip !== f.clip || next.sourceFrame !== f.sourceFrame + offset) return [];
      // A detector swapping the two legs must not steer the next identity cut.
      const previous = frames[start + offset - 1];
      if (next.gait?.some((value, index) => Math.abs(value - (previous.gait?.[index] ?? value)) > .12)) return [];
    }
    const yaws = frames.slice(start, start + hold).map(frame => frame.yaw);
    return [{ start, yaw: yaws.reduce((sum,value)=>sum+value,0)/hold, minYaw: Math.min(...yaws), maxYaw: Math.max(...yaws), phase: f.phase, clip: f.clip, look: f.look ?? f.clip, gait: f.gait, gaitVelocity: f.gaitVelocity }];
  });
}
export function phaseDistance(a: number, b: number) {
  const difference = Math.abs(a - b) % 1;
  return Math.min(difference, 1 - difference);
}
export function gaitDistance(a?: readonly number[], b?: readonly number[]) {
  if (!a?.length || a.length !== b?.length) return 0;
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0) / a.length);
}
function swapLegs(values?: readonly number[]) {
  if (values?.length !== 8) return values;
  return [values[2],values[3],values[0],values[1],values[6],values[7],values[4],values[5]];
}
export function directionCandidates(blocks: readonly AngleBlock[], yaw: number) {
  if (!blocks.length) return [];
  const error = (block: AngleBlock) => Math.max(Math.abs((block.minYaw ?? block.yaw) - yaw), Math.abs((block.maxYaw ?? block.yaw) - yaw));
  const nearest = Math.min(...blocks.map(error));
  const close = blocks.filter(block => error(block) <= 5);
  // The presence of a sparse angle must not expand a five-degree allowance.
  // Outside the filmed range, retain only the nearest block as a fallback.
  return close.length ? close : blocks.filter(block => error(block) <= nearest + 1e-6);
}
export function directionCoverage(frames: readonly AngleFrame[], blocks: readonly AngleBlock[], yaw: number, hold = 3) {
  const candidates = directionCandidates(blocks, yaw);
  const identities = new Set(candidates.flatMap(block => frames.slice(block.start, block.start + hold).map(frame => `${frame.source}:${frame.sourceFrame}`)));
  return { frames: identities.size, outfits: new Set(candidates.map(block => block.look ?? block.clip)).size };
}
export function chooseBlock(blocks: readonly AngleBlock[], yaw: number, phase: number, recent: readonly string[] = [], previousGait?: readonly number[], previousVelocity?: readonly number[]) {
  if (!blocks.length) throw new Error('No consecutive source blocks available');
  return chooseCandidate(directionCandidates(blocks, yaw), yaw, phase, recent, previousGait, previousVelocity);
}
/** Score a direction's indexed pool without scanning the entire source library. */
export function chooseCandidate(eligible: readonly AngleBlock[], yaw: number, phase: number, recent: readonly string[] = [], previousGait?: readonly number[], previousVelocity?: readonly number[]) {
  if (!eligible.length) throw new Error('No direction candidates available');
  // Never replay the same photographed stride immediately. Soft novelty alone
  // allowed one three-frame block to loop, visibly rewinding the moving foot.
  const different = eligible.filter(block => (block.look ?? block.clip) !== recent[0]);
  const candidates = different.length ? different : eligible;
  // These shallow Prada/Hermès left turns have ambiguous leg labels. Preserve
  // the established phase matching for the other reviewed camera views.
  const shallowLeft = yaw >= -25 && yaw <= -5;
  // Anatomical left/right labels can differ between identities. Compare both
  // pairings, keeping joint positions, velocity and half-cycle phase together.
  // Screen-space ankle continuity matters more than knees or outfit novelty.
  const predicted = previousGait?.map((v,i) => v + (previousVelocity?.[i] ?? 0));
  const scored = candidates.map(block => {
    const cost = (swap: boolean) => {
      const gait = swap ? swapLegs(block.gait) : block.gait;
      const velocity = swap ? swapLegs(block.gaitVelocity) : block.gaitVelocity;
      return phaseDistance((block.phase + (swap ? .5 : 0)) % 1, phase) +
        gaitDistance(gait?.slice(0,4), predicted?.slice(0,4)) * 4 +
        gaitDistance(gait?.slice(4), predicted?.slice(4)) * 24 +
        gaitDistance(velocity, previousVelocity) * 16 + Math.abs(block.yaw-yaw) / 12;
    };
    return { block, cost: shallowLeft
      ? Math.min(cost(false), previousGait ? cost(true) : Infinity)
      : phaseDistance(block.phase, phase) * 2 + gaitDistance(block.gait, predicted) * 12 +
        gaitDistance(block.gaitVelocity, previousVelocity) * 12 + Math.abs(block.yaw-yaw) / 12 };
  });
  const bestCost = Math.min(...scored.map(s => s.cost));
  const bestPhase = Math.min(...candidates.map(block=>phaseDistance(block.phase,phase)));
  const fresh = scored.filter(({ block, cost }) => !recent.includes(block.look ?? block.clip) &&
    cost <= bestCost + (shallowLeft ? .4 : .6) &&
    (shallowLeft || phaseDistance(block.phase,phase) <= bestPhase + .12));
  return (fresh.length ? fresh : scored).reduce((best,s) => s.cost < best.cost ? s : best).block;
}
