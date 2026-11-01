export interface XY { x: number; y: number }
export interface Bounds { x: number; y: number; width: number; height: number }
export type Corner = 'nw' | 'ne' | 'sw' | 'se';
export type Edge = 'n' | 's' | 'e' | 'w';

/** Interpret a freehand outline (or open stroke) as an oriented fish footprint. */
export function sketchFootprint(points: XY[]) {
  if (points.length < 3) return null;
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  if (Math.hypot(maxX - minX, maxY - minY) < 18) return null;
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  let xx = 0, xy = 0, yy = 0;
  for (const point of points) {
    const x = point.x - center.x, y = point.y - center.y;
    xx += x * x; xy += x * y; yy += y * y;
  }
  const angle = Math.atan2(2 * xy, xx - yy) / 2;
  const projections = points.map(p => (p.x - center.x) * Math.cos(angle) + (p.y - center.y) * Math.sin(angle));
  return { center, angle, length: Math.max(...projections) - Math.min(...projections) };
}

/** Resize with a fixed opposite corner, preserving the fish's proportions. */
export function cornerResize(box: Bounds, corner: Corner, pointer: XY) {
  const pivot = { x: box.x + (corner.endsWith('w') ? box.width : 0), y: box.y + (corner.startsWith('n') ? box.height : 0) };
  const dx = corner.endsWith('w') ? -box.width : box.width;
  const dy = corner.startsWith('n') ? -box.height : box.height;
  const scale = Math.max(0.05, ((pointer.x - pivot.x) * dx + (pointer.y - pivot.y) * dy) / Math.max(dx * dx + dy * dy, 1));
  return { pivot, scale };
}

/** Stretch one screen axis, keeping the opposite edge fixed. */
export function edgeResize(box: Bounds, edge: Edge, pointer: XY) {
  const horizontal = edge === 'e' || edge === 'w';
  const pivot = { x: box.x + (edge === 'w' ? box.width : edge === 'e' ? 0 : box.width / 2),
    y: box.y + (edge === 'n' ? box.height : edge === 's' ? 0 : box.height / 2) };
  const extent = horizontal ? box.width : box.height;
  const distance = horizontal ? pointer.x - pivot.x : pointer.y - pivot.y;
  const sign = edge === 'n' || edge === 'w' ? -1 : 1;
  return { pivot, axis: horizontal ? 'x' as const : 'y' as const,
    scale: Math.max(0.05, distance * sign / Math.max(extent, 1)) };
}
