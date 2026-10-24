export type AngleFrame = { clip: string; look?: string; source: string; sourceFrame: number; yaw: number; phase: number; atlas: number; tile: number };
export type AngleBlock = { start: number; yaw: number; phase: number; clip: string; look?: string };
export function buildBlocks(frames: readonly AngleFrame[], hold = 3): AngleBlock[] {
  return frames.flatMap((f, start) => {
    for (let offset = 1; offset < hold; offset++) {
      const next = frames[start + offset];
      if (!next || next.clip !== f.clip || next.sourceFrame !== f.sourceFrame + offset) return [];
    }
    return [{ start, yaw: f.yaw, phase: f.phase, clip: f.clip, look: f.look ?? f.clip }];
  });
}
export function phaseDistance(a: number, b: number) {
  const difference = Math.abs(a - b) % 1;
  return Math.min(difference, 1 - difference);
}
export function chooseBlock(blocks: readonly AngleBlock[], yaw: number, phase: number, recent: readonly string[] = []) {
  if (!blocks.length) throw new Error('No consecutive source blocks available');
  const nearest = Math.min(...blocks.map(b => Math.abs(b.yaw - yaw)));
  const eligible = blocks.filter(block => Math.abs(block.yaw - yaw) <= nearest + 5);
  const bestPhase = Math.min(...eligible.map(block => phaseDistance(block.phase,phase)));
  // Favor another outfit when its gait is within 2.4 frames of the best match.
  // Never widen the direction band to create apparent variety.
  const fresh = eligible.filter(block => !recent.includes(block.look ?? block.clip) && phaseDistance(block.phase,phase) <= bestPhase + 0.08);
  const pool = fresh.length ? fresh : eligible;
  let best = pool[0], bestCost = Infinity;
  for (const block of pool) {
    const cost = phaseDistance(block.phase, phase) * 5 + Math.abs(block.yaw - yaw) / 180;
    if (cost < bestCost) { best = block; bestCost = cost; }
  }
  return best;
}
