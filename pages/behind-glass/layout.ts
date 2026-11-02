export interface Rect { x: number; y: number; width: number; height: number }
export interface PersonPosition { x: number; y: number; scale: number }
export const personBounds = (p: PersonPosition): Rect => ({ x: p.x - 85*p.scale, y: p.y - 180*p.scale, width: 170*p.scale, height: 240*p.scale });
export const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));

/** Small positional corrections let crossing routes pass beside each other. */
export function spreadPeople(people: PersonPosition[], selected: number): void {
  for (let pass=0; pass<12; pass++) for(let i=0;i<people.length;i++) for(let j=i+1;j<people.length;j++) {
    const a=people[i], b=people[j];
    const dx=b.x-a.x, dy=b.y-a.y;
    const px=90*(a.scale+b.scale)-Math.abs(dx);
    const py=125*(a.scale+b.scale)-Math.abs(dy);
    if(px<=0 || py<=0) continue;
    const first=i===selected?0:j===selected?1:.5;
    if(px<py) { const shift=(dx>=0?1:-1)*px; a.x-=shift*first; b.x+=shift*(1-first); }
    else { const shift=(dy>=0?1:-1)*py; a.y-=shift*first; b.y+=shift*(1-first); }
  }
}

export function placeCard(anchor: Rect, obstacles: Rect[], width: number, height: number, viewport: { width: number; height: number }): { x: number; y: number } {
  const gap=14, gutter=12;
  const clamp=(p:{x:number;y:number})=>({x:Math.max(gutter,Math.min(viewport.width-width-gutter,p.x)),y:Math.max(gutter,Math.min(viewport.height-height-gutter,p.y))});
  const candidates=[
    {x:anchor.x+anchor.width+gap,y:anchor.y+anchor.height-height},
    {x:anchor.x-width-gap,y:anchor.y+anchor.height-height},
    {x:anchor.x+(anchor.width-width)/2,y:anchor.y+anchor.height+gap},
    {x:anchor.x+(anchor.width-width)/2,y:anchor.y-height-gap},
  ];
  for(let y=gutter;y<=viewport.height-height-gutter;y+=24) for(let x=gutter;x<=viewport.width-width-gutter;x+=24) candidates.push({x,y});
  let best=clamp(candidates[0]), score=Infinity;
  for(const candidate of candidates){
    const p=clamp(candidate), rect={...p,width,height};
    const cost=overlap(rect,anchor)*1000+obstacles.reduce((s,r)=>s+overlap(rect,r),0)*10+Math.hypot(p.x-candidates[0].x,p.y-candidates[0].y);
    if(cost<score){score=cost;best=p;}
  }
  return best;
}
