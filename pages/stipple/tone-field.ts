/** Local morphology used only to prepare density along the outer silhouette. */
function extremumPass(source: Float32Array, width: number, height: number, radius: number, horizontal: boolean, minimum: boolean) {
  const result = new Float32Array(source.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = minimum ? Infinity : -Infinity;
      for (let offset = -radius; offset <= radius; offset++) {
        const px = horizontal ? Math.max(0, Math.min(width - 1, x + offset)) : x;
        const py = horizontal ? y : Math.max(0, Math.min(height - 1, y + offset));
        const sample = source[py * width + px];
        value = minimum ? Math.min(value, sample) : Math.max(value, sample);
      }
      result[y * width + x] = value;
    }
  }
  return result;
}

function boxPass(source: Float32Array, width: number, height: number, radius: number, horizontal: boolean) {
  const result = new Float32Array(source.length);
  const lines = horizontal ? height : width;
  const length = horizontal ? width : height;
  const index = (line: number, position: number) => horizontal ? line * width + position : position * width + line;
  const clamp = (position: number) => Math.max(0, Math.min(length - 1, position));
  for (let line = 0; line < lines; line++) {
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset++) sum += source[index(line, clamp(offset))];
    for (let position = 0; position < length; position++) {
      result[index(line, position)] = sum / (radius * 2 + 1);
      sum += source[index(line, clamp(position + radius + 1))] - source[index(line, clamp(position - radius))];
    }
  }
  return result;
}

function diffuse(source: Float32Array, width: number, height: number, radius: number) {
  let result = source;
  // Three separable box convolutions approximate a Gaussian without a hard cutoff.
  for (let pass = 0; pass < 3; pass++) {
    result = boxPass(result, width, height, radius, true);
    result = boxPass(result, width, height, radius, false);
  }
  return result;
}

/** Only near-white paper connected to the frame is exterior; enclosed eye whites stay inside. */
function findExterior(darkness: Float32Array, width: number, height: number) {
  const exterior = new Uint8Array(darkness.length);
  const queue = new Int32Array(darkness.length);
  let head = 0;
  let tail = 0;
  const enqueue = (index: number) => {
    if (exterior[index] || darkness[index] > 0.02) return;
    exterior[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  return exterior;
}

/** Two-pass chamfer distance measures the narrow band around the actual silhouette. */
function distanceTo(exterior: Uint8Array, width: number, height: number, target: number) {
  const distance = Float32Array.from(exterior, value => value === target ? 0 : 1e6);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x > 0) distance[i] = Math.min(distance[i], distance[i - 1] + 1);
      if (y > 0) {
        distance[i] = Math.min(distance[i], distance[i - width] + 1);
        if (x > 0) distance[i] = Math.min(distance[i], distance[i - width - 1] + Math.SQRT2);
        if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i - width + 1] + Math.SQRT2);
      }
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i + 1] + 1);
      if (y + 1 < height) {
        distance[i] = Math.min(distance[i], distance[i + width] + 1);
        if (x > 0) distance[i] = Math.min(distance[i], distance[i + width - 1] + Math.SQRT2);
        if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i + width + 1] + Math.SQRT2);
      }
    }
  }
  return distance;
}

/** Input/output: ink coverage. Preserve interior detail beyond the narrow silhouette band. */
export function softenInkField(darkness: Float32Array, width: number, height: number) {
  const exterior = findExterior(darkness, width, height);
  const insideDistance = distanceTo(exterior, width, height, 1);
  const outsideDistance = distanceTo(exterior, width, height, 0);
  let opened = extremumPass(darkness, width, height, 3, true, true);
  opened = extremumPass(opened, width, height, 3, false, true);
  opened = extremumPass(opened, width, height, 3, true, false);
  opened = extremumPass(opened, width, height, 3, false, false);
  // Remove the dark outline only when preparing the edge density. This field
  // never replaces eyes, mouth lines, or interior shading in the actual output.
  const edgeSource = Float32Array.from(darkness, (value, index) => value * 0.06 + Math.min(value, opened[index]) * 0.94);
  const feather = diffuse(edgeSource, width, height, 3);
  return Float32Array.from(darkness, (value, index) => {
    if (exterior[index]) return outsideDistance[index] <= 10 ? feather[index] : 0;
    if (insideDistance[index] >= 6) return value;
    const t = Math.max(0, insideDistance[index] - 3) / 3;
    const originalWeight = t * t * (3 - 2 * t);
    return feather[index] * (1 - originalWeight) + value * originalWeight;
  });
}
