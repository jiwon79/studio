import type { PhotoTransform } from './photo-registration';
import type { PosePoints } from './pose-test-metrics';

const joints = [2, 5, 11, 12, 23, 24, 27, 28, 29, 30, 31, 32];
const weights = [2, 2, .5, .5, .7, .7, 1, 1, .7, .7, .7, .7];
type Term = readonly [number, number];

/** Jointly fit uniform whole-photo similarities. Position, anatomical landmark
 * displacement and torso direction share one objective. No limb warp, mirrored
 * fit, label permutation, image interpolation or synthetic in-between frame. */
export function fitPoseSequence(sources: readonly PosePoints[], targets: readonly PosePoints[]): PhotoTransform[] {
  if (sources.length !== targets.length) throw Error('Pose sequence lengths differ');
  if (!sources.length) return [];
  const raw = sources.map(pixel), goal = targets.map(pixel), count = sources.length * 4;
  const matrix = Array.from({ length: count }, () => new Float64Array(count)), rhs = new Float64Array(count);
  function equation(terms: readonly Term[], value: number, weight: number) {
    for (const [i, a] of terms) {
      rhs[i] += weight * a * value;
      for (const [j, b] of terms) matrix[i][j] += weight * a * b;
    }
  }
  function coordinate(frame: number, joint: number, axis: number): Term[] {
    const x = raw[frame][joint][0] - 256, y = raw[frame][joint][1] - 420, i = frame * 4;
    return axis === 0 ? [[i, x], [i + 1, -y], [i + 2, 1]] : [[i, y], [i + 1, x], [i + 3, 1]];
  }
  for (let frame = 0; frame < sources.length; frame++) {
    joints.forEach((joint, j) => {
      for (let axis = 0; axis < 2; axis++) {
        const row = coordinate(frame, joint, axis);
        equation(row, goal[frame][joint][axis], weights[j]);
        if (frame) equation([...row, ...coordinate(frame - 1, joint, axis).map(([i, v]) => [i, -v] as Term)],
          goal[frame][joint][axis] - goal[frame - 1][joint][axis], weights[j] * 8);
      }
    });
    const vector = (p: number[][]) => [0, 1].map(k => (p[11][k] + p[12][k] - p[23][k] - p[24][k]) / 2);
    const v = vector(raw[frame]), t = vector(goal[frame]), length = Math.hypot(...t);
    if (length < 1 || Math.hypot(...v) < 1) throw Error('Degenerate torso');
    const nx = -t[1] / length, ny = t[0] / length;
    equation([[frame * 4, v[0] * nx + v[1] * ny], [frame * 4 + 1, -v[1] * nx + v[0] * ny]], 0, 128);
  }
  // Pivoted elimination for this small, positive-definite normal system.
  for (let k = 0; k < count; k++) {
    let pivot = k;
    for (let i = k + 1; i < count; i++) if (Math.abs(matrix[i][k]) > Math.abs(matrix[pivot][k])) pivot = i;
    if (Math.abs(matrix[pivot][k]) < 1e-9) throw Error('Degenerate sequence registration');
    [matrix[k], matrix[pivot]] = [matrix[pivot], matrix[k]];
    [rhs[k], rhs[pivot]] = [rhs[pivot], rhs[k]];
    for (let i = k + 1; i < count; i++) {
      const factor = matrix[i][k] / matrix[k][k];
      for (let j = k + 1; j < count; j++) matrix[i][j] -= factor * matrix[k][j];
      rhs[i] -= factor * rhs[k];
    }
  }
  const result = new Float64Array(count);
  for (let i = count - 1; i >= 0; i--) {
    let value = rhs[i];
    for (let j = i + 1; j < count; j++) value -= matrix[i][j] * result[j];
    result[i] = value / matrix[i][i];
  }
  return sources.map((_, frame) => {
    const [a, b, tx, ty] = result.slice(frame * 4, frame * 4 + 4), scale = Math.hypot(a, b);
    if (![a, b, tx, ty].every(Number.isFinite) || scale < .8 || scale > 1.2 || Math.abs(Math.atan2(b, a)) > Math.PI / 12)
      throw Error('Sequence registration exceeds whole-photo bounds');
    return { scale, rotation: Math.atan2(b, a), dx: tx - 256, dy: ty - 420 };
  });
}

function pixel(points: PosePoints) {
  if (points.length !== 33 || points.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) throw Error('Invalid pose');
  return points.map(p => [p[0] * 512, p[1] * 768]);
}
