import { test, expect } from 'vitest';
import { positionBelowFeet } from './layout';

test('card sits centered ten pixels below the soles', () => {
  expect(positionBelowFeet({x:400,y:300},214,100,{width:1000,height:700})).toEqual({x:293,y:310});
});
test('card remains inside a narrow viewport near every edge', () => {
  for(const x of [0,195,390]) for(const y of [0,420,844]) {
    const p=positionBelowFeet({x,y},204,100,{width:390,height:844});
    expect(p.x).toBeGreaterThanOrEqual(12);expect(p.x+204).toBeLessThanOrEqual(378);
    expect(p.y).toBeGreaterThanOrEqual(12);expect(p.y+100).toBeLessThanOrEqual(832);
  }
});
