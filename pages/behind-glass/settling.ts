export const STOP_RESPONSE = 18;
/** Fast continuous braking, with an exact rest after the remaining motion is tiny. */
export function settleSpeed(current: number, target: number, dt: number): number {
  const next = target + (current - target) * Math.exp(-dt * (target === 0 ? STOP_RESPONSE : 8));
  return Math.abs(next - target) < .003 ? target : next;
}
