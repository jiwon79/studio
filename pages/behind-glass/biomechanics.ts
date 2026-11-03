import clip from './data/opensim-walk.json';
import { fract } from './motion';

export const BIOMECHANICAL_STRIDE = clip.stride;
export interface BodyPoint { forward: number; height: number; lateral: number }
export interface BiomechanicalLeg {
  hip: BodyPoint; knee: BodyPoint; ankle: BodyPoint; contact: BodyPoint;
  lift: number; roll: number;
}

/** Periodic cubic interpolation of the joint positions realized by OpenSim. */
export function biomechanicalLeg(cycle: number, side: number): BiomechanicalLeg {
  const count = clip.frames.length;
  const frame = fract(cycle) * count;
  const index = Math.floor(frame);
  const t = frame - index;
  const leg = side < 0 ? 0 : 1;
  const point = (joint: number): BodyPoint => {
    const values = [0, 1, 2].map(axis => {
      const at = (offset: number) => clip.frames[(index + offset + count) % count][leg][joint][axis];
      const a = at(-1), b = at(0), c = at(1), d = at(2);
      return .5 * (2*b + (c-a)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t*t*t);
    });
    return { forward: values[0], height: values[1], lateral: -values[2] };
  };
  const heel = point(3), toe = point(4);
  const contact = {
    forward: (heel.forward + toe.forward) / 2,
    height: (heel.height + toe.height) / 2,
    lateral: (heel.lateral + toe.lateral) / 2,
  };
  return {
    hip: point(0), knee: point(1), ankle: point(2), contact,
    // Only opacity/blur is normalized; actual foot height is kept in contact.
    lift: Math.max(0, Math.min(1, contact.height / 20)),
    roll: -Math.atan2(toe.height - heel.height, toe.forward - heel.forward),
  };
}
