import data from './angles.json';
import schedule from './reference-schedule.json';
const directions: Record<string, (number | number[])[]> = schedule.directions;
export function directionPhotos(yaw: number): number[] {
  const cuts = directions[String(yaw)];
  if (!cuts) throw new Error(`Missing complete direction: ${yaw}`);
  return [...new Set(cuts.flatMap(cut => typeof cut === 'number' ? [cut, cut + 1, cut + 2] : cut))];
}
export function directionPages(yaw: number): number[] {
  return [...new Set(directionPhotos(yaw).map(index => data.frames[index].atlas))];
}
