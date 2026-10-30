import manifest from './assets/pose-test/manifest.json';
import { fitPoseSequence } from './pose-sequence-registration';
import type { PhotoTransform } from './photo-registration';

const targets = manifest.frames.map(row => row.target.map((p, j) => j === 2 ? row.headTarget.leftEye : j === 5 ? row.headTarget.rightEye : p));
export const zeroPoseFits = fitPoseSequence(manifest.frames.map(row => row.headBodyPoints), targets);

function compose(outer: PhotoTransform, inner: PhotoTransform): PhotoTransform {
  const c = Math.cos(outer.rotation), s = Math.sin(outer.rotation);
  return { scale: outer.scale * inner.scale, rotation: outer.rotation + inner.rotation,
    dx: outer.dx + outer.scale * (inner.dx * c - inner.dy * s),
    dy: outer.dy + outer.scale * (inner.dx * s + inner.dy * c) };
}
function inverse(t: PhotoTransform): PhotoTransform {
  const c = Math.cos(t.rotation), s = Math.sin(t.rotation);
  return { scale: 1 / t.scale, rotation: -t.rotation,
    dx: -(t.dx * c + t.dy * s) / t.scale, dy: (t.dx * s - t.dy * c) / t.scale };
}

/** Store the new image in the original photo's coordinate system. The main
 * renderer already applies the scheduled cut transform; undo the pilot's cut
 * here so that registration is applied exactly once, including on later reuse. */
export const zeroPosePatches = new Map(manifest.frames.map((row, i) => [row.index, {
  file: `./assets/pose-test/${row.headBody}`,
  registration: compose(inverse(row.oldCut), zeroPoseFits[i]),
}]));

export function zeroPoseAsset(row: { index: number; edited: string; registration?: PhotoTransform }, enabled: boolean) {
  const patch = enabled ? zeroPosePatches.get(row.index) : undefined;
  return { key: row.index * 2 + Number(!!patch), file: patch?.file ?? `./assets/gpt-zero/${row.edited}`,
    registration: patch?.registration ?? row.registration, patched: !!patch };
}
