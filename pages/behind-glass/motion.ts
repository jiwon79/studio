export const fract = (value: number) => value - Math.floor(value);
export interface FootPose { forward: number; lift: number; roll: number }

/** The stance cancels the body's translation, keeping the sole planted in world space. */
export function footPose(cycle: number, stride: number): FootPose {
  const phase = fract(cycle);
  const stance = 0.62;
  if (phase < stance) {
    return { forward: stride * (stance / 2 - phase), lift: 0, roll: Math.max(0, (phase - .46) / .16) };
  }
  const swing = (phase - stance) / (1 - stance);
  const ease = swing * swing * (3 - 2 * swing);
  return {
    forward: stride * stance * (ease - .5),
    lift: Math.sin(Math.PI * swing),
    roll: 1 - swing,
  };
}

export function wrapPosition(value: number, extent: number, margin: number): number {
  return fract((value + margin) / (extent + margin * 2)) * (extent + margin * 2) - margin;
}
