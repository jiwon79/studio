/** Stable per-fish depth keeps editing bounds still while a fish is selected. */
export function fishDepth(index: number) {
  const unit = (index * 0.61803398875) % 1;
  const depth = unit * unit * (3 - 2 * unit);
  return { depth, scale: 1 - depth * 0.14, z: -depth * 1.15 };
}
