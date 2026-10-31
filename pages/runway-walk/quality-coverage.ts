import data from './angles.json';
import originals from './quality-originals.json';
import { directionPhotos } from './direction-photos';

// A rejected generation stays an original photograph, never a fabricated edit.
export const preservedOriginals = new Set(originals.assetVersion === data.assetVersion ? originals.frames : []);
export function qualityDirections(restored: ReadonlySet<number>) {
  return Array.from({ length: 37 }, (_, i) => i * 5 - 90)
    .filter(yaw => directionPhotos(yaw).every(index => restored.has(index) || preservedOriginals.has(index)));
}
