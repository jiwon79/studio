import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('repair an opaque bag body without filling the handle, open background or an oversized region', () => {
  const result=JSON.parse(execFileSync('python3',['-c',`
import json,sys
sys.path.insert(0,'scripts/runway-walk')
from solid_accessory import enclosed_hole
w=h=100
alpha=bytearray(w*h)
def border(x0,y0,x1,y1):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            if x in (x0,x1) or y in (y0,y1):alpha[y*w+x]=255
border(20,40,40,60)
border(25,25,35,40)
body=enclosed_hole(alpha,w,h,(30,50))
repaired=alpha.copy()
for i in body:repaired[i]=255
opened=alpha.copy();opened[50*w+20]=0
large=bytearray(w*h)
for y in range(3,95):
    for x in range(3,95):
        if x in (3,94) or y in (3,94):large[y*w+x]=255
print(json.dumps({'body':repaired[50*w+30],'handle':repaired[30*w+30],
 'outside':repaired[80*w+30],'filled':len(body),
 'open':len(enclosed_hole(opened,w,h,(30,50))),
 'large':len(enclosed_hole(large,w,h,(30,50))),
 'foreground':len(enclosed_hole(alpha,w,h,(20,50)))}))
`],{encoding:'utf8'}));
  expect(result.body).toBe(255);
  expect(result.handle).toBe(0);
  expect(result.outside).toBe(0);
  expect(result.filled).toBe(361);
  expect(result.open).toBe(0);
  expect(result.large).toBe(0);
  expect(result.foreground).toBe(0);
});
