export interface Sway { x: number; y: number; vx: number; vy: number }
/** Damped suspension: the feet lag behind motion and overshoot after reversal. */
export function advanceSway(state: Sway, velocity: { x: number; y: number }, dt: number): void {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const step = dt / steps;
  const target = (v: number) => 52 * Math.tanh(-v / 650);
  for (let i = 0; i < steps; i++) {
    state.vx += (110 * (target(velocity.x) - state.x) - 9 * state.vx) * step;
    state.vy += (110 * (target(velocity.y) - state.y) - 9 * state.vy) * step;
    state.x += state.vx * step;
    state.y += state.vy * step;
  }
}
