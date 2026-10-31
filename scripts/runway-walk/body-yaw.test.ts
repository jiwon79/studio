import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('torso interpolation follows a filmed turn and ignores an occluded or swapped axis', () => {
  const result=JSON.parse(execFileSync('python3',['-c',`
import json, math, sys
sys.path.insert(0,'scripts/runway-walk')
from body_yaw import estimate_yaws, torso_yaw

def pose(yaw):
    p=[[0.,0.,0.,1.] for _ in range(33)]
    for left,right in [(11,12),(23,24)]:
        p[right]=[-.2*math.cos(math.radians(yaw)),0.,-.2*math.sin(math.radians(yaw)),1.]
    return p

# The body has already turned halfway by frame 5, then turns more slowly.
rows=[{'sourceFrame':i,'pose':pose(-30-60*math.sqrt(i/30))} for i in range(31)]
keys=[[0,-30],[30/25,-90]]
yaws=estimate_yaws(rows,keys)
linear=estimate_yaws([{'sourceFrame':r['sourceFrame'],'pose':pose(-30)} for r in rows],keys)
bad=pose(-60);bad[24]=pose(60)[24]
occluded=pose(-60);occluded[11][3]=.1
rear=torso_yaw(pose(-120))
print(json.dumps({'early':yaws[5],'start':yaws[0],'end':yaws[30],
 'static':linear[5],'swapped':torso_yaw(bad),'occluded':torso_yaw(occluded),
 'left':torso_yaw(pose(-75)),'rear':rear}))
`],{encoding:'utf8'}));
  expect(result.start).toBe(-30);
  expect(result.end).toBe(-90);
  expect(result.early).toBeLessThan(-40);
  expect(result.early).toBeGreaterThanOrEqual(-45);
  expect(result.static).toBe(-40);
  expect(result.swapped).toBeNull();
  expect(result.occluded).toBeNull();
  expect(result.left).toBeCloseTo(-75);
  expect(result.rear).toBeCloseTo(-120);
});
