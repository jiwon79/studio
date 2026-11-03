import { test, expect } from 'vitest';
import { settleSpeed } from './settling';

test('braking starts without a pose snap and reaches exact rest quickly', () => {
  let speed=1;
  const first=settleSpeed(speed,0,1/60);
  expect(first).toBeGreaterThan(.7);
  expect(first).toBeLessThan(1);
  for(let i=0;i<22;i++) {
    const next=settleSpeed(speed,0,1/60);
    expect(next).toBeLessThanOrEqual(speed); speed=next;
  }
  expect(speed).toBe(0);
});

test('braking is consistent across frame rates', () => {
  const sample=(dt:number)=>{let speed=1;for(let t=0;t<.2-1e-6;t+=dt)speed=settleSpeed(speed,0,dt);return speed;};
  expect(sample(1/30)).toBeCloseTo(sample(1/120),6);
});
