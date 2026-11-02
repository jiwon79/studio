import { expect, test } from 'vitest';
import { Line, LineSegments } from 'three';
import { SpineDebug } from './spine-debug';
import { createSchool, MAX_SCENE_FISH } from './school';

test('debug bones follow the posed simulation and remain finite after scaling', () => {
  let spine: Float32Array = new Float32Array(MAX_SCENE_FISH * 20);
  const school = createSchool({
    canvas: { width: 1440, height: 900, clientWidth: 1440, clientHeight: 900 },
    options: () => ({ size: 1.15, interactive: false }),
    uniform: (name, value) => { if (name === 'uSpine') spine = value; },
  }, { target: [0.5, 0.5], over: false });
  const debug = new SpineDebug();
  for (const scale of [0.25, 1, 4]) {
    school.frame(scale);
    debug.update(spine, 1, scale);
    const bones = (debug.group.children[0] as Line).geometry.getAttribute('position');
    for (let k = 0; k < 10; k++) {
      expect(bones.getX(k)).toBe(spine[20 + k * 2]);
      expect(bones.getY(k)).toBe(spine[21 + k * 2]);
    }
    for (const child of debug.group.children as LineSegments[]) {
      const positions = child.geometry.getAttribute('position').array;
      expect([...positions].every(Number.isFinite)).toBe(true);
    }
  }
  debug.dispose();
});
