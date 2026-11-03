import { test, expect } from 'vitest';
import { advanceSway } from './drag-physics';

test('suspended feet lag, reverse gradually, and settle after movement stops', () => {
  const s = { x: 0, y: 0, vx: 0, vy: 0 };
  for (let i=0;i<24;i++) advanceSway(s,{x:1000,y:0},1/60);
  expect(s.x).toBeLessThan(-30);
  advanceSway(s,{x:-1000,y:0},1/60);
  expect(s.x).toBeLessThan(0);
  for(let i=0;i<40;i++) advanceSway(s,{x:-1000,y:0},1/60);
  expect(s.x).toBeGreaterThan(30);
  for(let i=0;i<180;i++) advanceSway(s,{x:0,y:0},1/60);
  expect(Math.abs(s.x)+Math.abs(s.vx)).toBeLessThan(.01);
});

test('large pointer jumps stay bounded and frame rates produce similar sway', () => {
  const sample=(dt:number)=>{const s={x:0,y:0,vx:0,vy:0};for(let t=0;t<.5-1e-6;t+=dt)advanceSway(s,{x:100000,y:-100000},dt);return s;};
  const a=sample(1/30),b=sample(1/120);
  expect(Math.abs(a.x)).toBeLessThan(70);
  expect(Math.abs(a.x-b.x)).toBeLessThan(.1);
  expect(Number.isFinite(a.y+a.vy)).toBe(true);
});
