import { test, expect } from 'vitest';
import { personBounds, overlap, placeCard } from './layout';

test('small card stays in mobile viewport without covering its person', () => {
  for(const x of [40,195,350]) for(const y of [230,420,650]) {
    const person=personBounds({x,y,scale:.65});
    const p=placeCard(person,[],204,110,{width:390,height:844});
    expect(overlap({...p,width:204,height:110},person)).toBe(0);
    expect(p.x).toBeGreaterThanOrEqual(12);expect(p.x+204).toBeLessThanOrEqual(378);
    expect(p.y).toBeGreaterThanOrEqual(12);expect(p.y+110).toBeLessThanOrEqual(832);
  }
});
