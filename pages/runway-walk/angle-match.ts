export type AngleFrame = { clip: string; look?: string; source: string; sourceFrame: number; yaw: number; phase: number; atlas: number; tile: number; gait?: readonly number[]; gaitVelocity?: readonly number[] };
export type AngleBlock = { start: number; yaw: number; phase: number; clip: string; look?: string; gait?: readonly number[]; gaitVelocity?: readonly number[] };
export function buildBlocks(frames: readonly AngleFrame[], hold = 3): AngleBlock[] {
  return frames.flatMap((f, start) => {
    for (let offset = 1; offset < hold; offset++) {
      const next = frames[start + offset];
      if (!next || next.clip !== f.clip || next.sourceFrame !== f.sourceFrame + offset) return [];
    }
    return [{ start, yaw: f.yaw, phase: f.phase, clip: f.clip, look: f.look ?? f.clip, gait: f.gait, gaitVelocity: f.gaitVelocity }];
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
export function chooseBlock(blocks: readonly AngleBlock[], yaw: number, phase: number, recent: readonly string[] = [], previousGait?: readonly number[], previousVelocity?: readonly number[]) {
  if (!blocks.length) throw new Error('No consecutive source blocks available');
  const nearest = Math.min(...blocks.map(b => Math.abs(b.yaw - yaw)));
  const eligible = blocks.filter(block => Math.abs(block.yaw - yaw) <= nearest + 5);
  const bestPhase = Math.min(...eligible.map(block => phaseDistance(block.phase,phase)));
  // Match the next joint position and its motion, so two similar-looking poses
  // with opposite swing directions cannot make a foot suddenly reverse.
  const predicted = previousGait?.map((v,i) => v + (previousVelocity?.[i] ?? 0));
  const scored = eligible.map(block => ({ block, cost:
    phaseDistance(block.phase, phase) * 2 + gaitDistance(block.gait, predicted) * 12 +
    gaitDistance(block.gaitVelocity, previousVelocity) * 12 + Math.abs(block.yaw - yaw) / 90,
  }));
  const bestCost = Math.min(...scored.map(s => s.cost));
  const fresh = scored.filter(({ block, cost }) => !recent.includes(block.look ?? block.clip) &&
    cost <= bestCost + 0.25 && phaseDistance(block.phase,phase) <= bestPhase + 0.12);
  return (fresh.length ? fresh : scored).reduce((best,s) => s.cost < best.cost ? s : best).block;
}
