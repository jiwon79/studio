import { test, expect } from 'vitest';
import { PROCESS_STEPS, stageLayers } from './process-stages';
test('process views build from joints through volume and soles to the final glass', () => {
  expect(PROCESS_STEPS.map(s=>s.id)).toEqual(['skeleton','silhouette','soles','glass','interact']);
  expect(stageLayers('skeleton')).toMatchObject({joints:true,legs:false,feet:false,glass:false});
  expect(stageLayers('silhouette')).toMatchObject({joints:false,legs:true,feet:false,glass:false});
  expect(stageLayers('soles')).toMatchObject({legs:true,feet:true,glass:false});
  expect(stageLayers('glass')).toMatchObject({far:true,legs:true,feet:true,glass:true});
  expect(stageLayers('interact')).toMatchObject({joints:false,soles:false,far:true,legs:true,feet:true,glass:true});
});
