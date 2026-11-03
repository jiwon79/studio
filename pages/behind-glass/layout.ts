/** Center beneath the actual rendered soles; only screen edges can constrain it. */
export function positionBelowFeet(feet: { x: number; y: number }, width: number, height: number, viewport: { width: number; height: number }): { x: number; y: number } {
  return {
    x: Math.max(12, Math.min(viewport.width - width - 12, feet.x - width / 2)),
    y: Math.max(12, Math.min(viewport.height - height - 12, feet.y + 10)),
  };
}
