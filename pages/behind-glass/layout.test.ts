import { test, expect } from 'vitest';
import { spreadPeople, personBounds, overlap, placeCard } from './layout';

test('crossing people separate while the selected person keeps their position', () => {
  const people=[{x:250,y:300,scale:1},{x:270,y:310,scale:1},{x:230,y:330,scale:1}];
  spreadPeople(people,0);
  expect(people[0]).toEqual({x:250,y:300,scale:1});
  for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++)expect(overlap(personBounds(people[i]),personBounds(people[j]))).toBeLessThan(1);
});

test('small card stays in mobile viewport without covering its person', () => {
  for(const x of [40,195,350]) for(const y of [230,420,650]) {
    const person=personBounds({x,y,scale:.65});
    const p=placeCard(person,[],204,110,{width:390,height:844});
    expect(overlap({...p,width:204,height:110},person)).toBe(0);
    expect(p.x).toBeGreaterThanOrEqual(12);expect(p.x+204).toBeLessThanOrEqual(378);
    expect(p.y).toBeGreaterThanOrEqual(12);expect(p.y+110).toBeLessThanOrEqual(832);
  }
});
