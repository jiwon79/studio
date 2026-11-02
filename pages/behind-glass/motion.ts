export const fract = (value: number) => value - Math.floor(value);
const smooth = (x: number) => x * x * (3 - 2 * x);
export interface FootPose { forward: number; lift: number; roll: number }
export const STRIDE = 148;
const STANCE = .62;

/** A planted sole cancels the body's travel. Swing joins that velocity smoothly. */
export function footPose(cycle: number, stride: number): FootPose {
  const phase = fract(cycle);
  if (phase < STANCE) {
    const heelStrike = 1 - smooth(Math.min(1, phase / .09));
    const toeOff = smooth(Math.max(0, (phase - .43) / (STANCE - .43)));
    return { forward: stride * (STANCE / 2 - phase), lift: 0, roll: toeOff * .48 - heelStrike * .16 };
  }
  const swing = (phase - STANCE) / (1 - STANCE);
  const ease = smooth(swing);
  // Hermite endpoint tangents preserve the velocity of the preceding stance.
  const tangent = -stride * (1 - STANCE) * (2 * swing ** 3 - 3 * swing ** 2 + swing);
  return {
    forward: stride * STANCE * (ease - .5) + tangent,
    lift: Math.sin(Math.PI * swing) ** 2,
    roll: .48 * (1 - ease) - .16 * ease,
  };
}

export interface Joint { forward: number; height: number }
export const THIGH_LENGTH = 58;
export const SHIN_LENGTH = 55;
export const FOOT_LIFT = 7;
const HEEL_RISE = 6;
const SOLE_HEIGHT = 4;
const ankleHeight = (foot: FootPose) => foot.lift * FOOT_LIFT + Math.max(0, foot.roll) * HEEL_RISE + SOLE_HEIGHT;

/** Follow the support legs' reach instead of holding the pelvis in a crouch. */
export function pelvisHeight(cycle: number): number {
  const reach = THIGH_LENGTH + SHIN_LENGTH - 1.2;
  const heights = [footPose(cycle, STRIDE), footPose(cycle + .5, STRIDE)]
    .map(foot => ankleHeight(foot) + Math.sqrt(reach ** 2 - foot.forward ** 2));
  // A smooth minimum transfers support without a height jump at toe-off.
  const [a, b] = heights;
  return (a + b - Math.hypot(a - b, 1.5)) / 2;
}

/** Two-bone leg in the direction-of-travel plane; the knee bends forward. */
export function legPose(foot: FootPose, hipHeight: number): { hip: Joint; knee: Joint; ankle: Joint } {
  const hip = { forward: 0, height: hipHeight };
  const ankle = { forward: foot.forward, height: ankleHeight(foot) };
  const dx = ankle.forward;
  const dy = ankle.height - hipHeight;
  const distance = Math.hypot(dx, dy);
  const along = (THIGH_LENGTH ** 2 - SHIN_LENGTH ** 2 + distance ** 2) / (2 * distance);
  const bend = Math.sqrt(Math.max(0, THIGH_LENGTH ** 2 - along ** 2));
  const knee = {
    forward: dx * along / distance - dy * bend / distance,
    height: hipHeight + dy * along / distance + dx * bend / distance,
  };
  return { hip, knee, ankle };
}

export function wrapPosition(value: number, extent: number, margin: number): number {
  return fract((value + margin) / (extent + margin * 2)) * (extent + margin * 2) - margin;
}
