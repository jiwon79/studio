/** Slow, phase-shifted dives give each fish an independent vertical trajectory. */
export function fishDepth(index: number, time = 0) {
  const phase = (index * 0.61803398875) % 1;
  const period = 18 + ((index * 0.38196601125) % 1) * 8;
  const angle = (phase + time / period) * Math.PI * 2;
  const depth = 0.5 - 0.5 * Math.cos(angle);
  return { depth, scale: 1.08 - depth * 0.24, z: -depth * 1.15, pitch: Math.sin(angle) * 0.2 };
}

/** Pause a selected fish's dive clock without jumping when it resumes. */
export class DepthMotion {
  private readonly clocks: number[] = [];
  private readonly previous: number[] = [];

  sample(index: number, time: number, paused: boolean) {
    if (this.previous[index] === undefined) {
      this.previous[index] = time;
      this.clocks[index] = time;
    }
    if (!paused) this.clocks[index] += Math.max(0, time - this.previous[index]);
    this.previous[index] = Math.max(this.previous[index], time);
    return fishDepth(index, this.clocks[index]);
  }
}
