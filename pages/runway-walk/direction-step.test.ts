import { expect, test } from 'vitest';
import { snapYaw } from './direction-step';

test('pointer and stored angles snap symmetrically to five-degree views', () => {
  expect([22,-22,2.5,-2.5,4.9,-4.9,0,93,-93].map(value=>snapYaw(value)))
    .toEqual([20,-20,5,-5,5,-5,0,90,-90]);
  for(let value=-200;value<=200;value+=.25) {
    expect(Math.abs(snapYaw(value)%5)).toBe(0);
    expect(Math.abs(snapYaw(value))).toBeLessThanOrEqual(90);
  }
});
