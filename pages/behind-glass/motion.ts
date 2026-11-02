export const fract = (value: number) => value - Math.floor(value);
const smooth = (x: number) => x * x * (3 - 2 * x);
export interface FootPose { forward: number; lift: number; roll: number }
export const STRIDE = 148;
const STANCE = .62;
export type Gait = 'walk' | 'run';
export const RUN_STRIDE = 190;
const smoother = (x: number) => x ** 3 * (10 - 15 * x + 6 * x * x);

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

/** Two smooth support arcs per cycle, independent of the swinging foot.
 * The low point spans weight transfer; the high point is mid-stance.
 */
export function pelvisHeight(cycle: number, gait: Gait = 'walk'): number {
  if (gait === 'run') return 104 - 5 * Math.cos(4 * Math.PI * (cycle - .18));
  return 109.5 + 5 * Math.cos(4 * Math.PI * (cycle - .28));
}

/** Short support and a flight interval distinguish running from faster walking. */
export function runningFootPose(cycle: number): FootPose {
  const phase = fract(cycle);
  const stance = .36;
  if (phase < stance) {
    return {
      forward: RUN_STRIDE * (stance / 2 - phase), lift: 0,
      roll: .62 * smooth(Math.max(0, (phase - .15) / .21))
        - .12 * (1 - smooth(Math.min(1, phase / .08))),
    };
  }
  const swing = (phase - stance) / (1 - stance);
  return {
    forward: RUN_STRIDE * (-stance / 2 - (1 - stance) * swing + smoother(swing)),
    lift: 3.2 * Math.sin(Math.PI * swing) ** 2,
    roll: .62 - .74 * smooth(swing),
  };
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
