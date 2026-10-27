import { expect, test } from 'vitest';
import data from './angles.json';
import { buildBlocks, choosePoseBlock, directionCoverage, directionCandidates, phaseDistance, gaitDistance, type AngleFrame } from './angle-match';
const f = (clip: string, sourceFrame: number): AngleFrame => ({ clip, source: 'test', sourceFrame, yaw: 0, phase: 0, atlas: 0, tile: 0 });
test('three-frame blocks cannot cross source gaps or clip boundaries', () => {
  const blocks = buildBlocks([f('a',10),f('a',11),f('a',12),f('a',14),f('a',15),f('b',16),f('b',17),f('b',18)]);
  expect(blocks.map(b => b.start)).toEqual([0,5]);
});
test('offline matching can skip one rejected source frame but never reverse, repeat, or cross a clip', () => {
  const frames=[f('a',10),f('a',12),f('a',13),f('a',13),f('a',12),f('a',16),f('b',17),f('b',18)];
  expect(buildBlocks(frames,3,2).map(b=>[b.start,b.lastSourceFrame])).toEqual([[0,13]]);
  expect(buildBlocks(frames)).toEqual([]);
});
test('each photograph has one pose identity even when source shots overlap', () => {
  const keys=data.frames.map(f=>`${f.source}:${f.sourceFrame}`);
  expect(new Set(keys).size).toBe(keys.length);
});
test('angle selection takes priority; phase remains continuous across the loop', () => {
  const blocks = [
    { start: 0, yaw: -70, phase: 0.99, clip: 'left' },
    { start: 3, yaw: 0, phase: 0.01, clip: 'front' },
    { start: 6, yaw: -70, phase: 0.5, clip: 'left-other' },
  ];
  expect(choosePoseBlock(blocks,-60,0.01).start).toBe(0);
  expect(choosePoseBlock(blocks,0,0.99).start).toBe(3);
  expect(phaseDistance(0.99,0.01)).toBeCloseTo(0.02);
});

test('exported source atlas offers valid consecutive blocks for every stored direction', () => {
  const blocks = buildBlocks(data.frames);
  for (let yaw=data.yawRange[0]; yaw<=data.yawRange[1]; yaw++) {
    const chosen = choosePoseBlock(blocks,yaw,0.25);
    expect(Math.abs(chosen.yaw - yaw)).toBeLessThanOrEqual(5);
    const sequence = data.frames.slice(chosen.start, chosen.start+3);
    expect(sequence[2].sourceFrame - sequence[0].sourceFrame).toBe(2);
    expect(new Set(sequence.map(f => f.clip)).size).toBe(1);
  }
  for (const frame of data.frames) {
    expect(frame.atlas).toBeLessThan(data.atlases.length);
    expect(frame.tile).toBeLessThan(data.columns * data.rows);
    expect(frame.phase).toBeGreaterThanOrEqual(0);
    expect(frame.phase).toBeLessThan(1);
  }
});

test('a matching gait cannot pull a frontal person into a diagonal direction', () => {
  const blocks = [
    { start: 0, yaw: -45, phase: 0.5, clip: 'diagonal' },
    { start: 3, yaw: 0, phase: 0, clip: 'frontal' },
  ];
  expect(choosePoseBlock(blocks,-30,0).clip).toBe('diagonal');
});

test('a turn must match the requested direction for the entire three-frame hold', () => {
  const frames=[
    {...f('turn-away',10),yaw:-38}, {...f('turn-away',11),yaw:-46}, {...f('turn-away',12),yaw:-54},
    {...f('compatible',20),yaw:-38}, {...f('compatible',21),yaw:-39}, {...f('compatible',22),yaw:-40},
  ];
  expect(choosePoseBlock(buildBlocks(frames),-38,0).clip).toBe('compatible');
});

test('all selectable five-degree views retain eight outfits and consecutive source frames', () => {
  const blocks = buildBlocks(data.frames);
  for (let yaw=-90; yaw<=90; yaw+=5) {
    const coverage = directionCoverage(data.frames,blocks,yaw,data.holdFrames);
    expect(coverage.outfits, `outfits at ${yaw}`).toBeGreaterThanOrEqual(8);
    expect(coverage.frames, `frames at ${yaw}`).toBeGreaterThanOrEqual(30);
  }
});
test('supplemental footage covers shallow and diagonal directions with actual left turns', () => {
  const added=data.frames.filter(f=>f.source==='hermes');
  expect(new Set(added.map(f=>f.look)).size).toBeGreaterThanOrEqual(8);
  expect(added.every(f=>f.yaw<=0)).toBe(true);
  for(const yaw of [-30,-35])expect(added.some(f=>Math.abs(f.yaw-yaw)<=5)).toBe(true);
  const turns=data.frames.filter(f=>f.source==='prada24');
  expect(new Set(turns.map(f=>f.look)).size).toBeGreaterThanOrEqual(8);
  expect(turns.every(f=>f.yaw<=0)).toBe(true);
});
test('reviewed spectator-overlap frames stay out of the frontal library', () => {
  expect(data.frames.some(f=>f.clip==='gucci-look-179')).toBe(false);
  for(const clip of ['hermes24-right-349','hermes25-right-33','hermes25-right-243','hermes25-right-494','hermes25-left-541','hermes25-right-163','hermes25-right-211','hermes25-right-256','hermes24-right-247','hermes24-right-259','hermes24-right-552','hermes25-right-70','hermes24-right-327'])expect(data.frames.some(f=>f.clip===clip)).toBe(false);
  expect(data.frames.some(f=>f.clip==='fendi-look-1720'&&f.sourceFrame>=759)).toBe(false);
  const frontal=['prada25-look-50','prada25-look-112','fendi-look-1720','gucci-look-95'];
  expect(data.frames.filter(f=>frontal.includes(f.clip)).length).toBe(111);
});
test('all published clips were reviewed without carried items', () => {
  expect(data.clips.every(clip => clip.carriedItems === 'none')).toBe(true);
  for (const clip of ['lv-front-276','lv-front-488','lv-front-662','prada-oblique-234','prada-left-154','gucci-look-123','gucci-look-191','prada25-nearfront-86','hermes24-right-125','hermes25-right-45','hermes25-right-223','hermes25-right-383','hermes25-right-409','hermes25-right-70']) {
    expect(data.frames.some(frame => frame.clip === clip), clip).toBe(false);
  }
});
test('avoid recent outfits when another outfit has a nearby gait in the same direction', () => {
  const blocks = [
    {start:0,yaw:-45,phase:0,clip:'a'},
    {start:3,yaw:-45,phase:0.02,clip:'b'},
    {start:6,yaw:-45,phase:0.06,clip:'c'},
    {start:9,yaw:0,phase:0,clip:'wrong-direction'},
  ];
  expect(choosePoseBlock(blocks,-45,0,['a','b']).clip).toBe('c');
});
test('an excellent phase match cannot immediately replay the same photographed stride', () => {
  const blocks = [
    { start: 0, yaw: 22, phase: 0, clip: 'looping-stride' },
    { start: 3, yaw: 22, phase: .48, clip: 'other-outfit' },
  ];
  expect(choosePoseBlock(blocks, 22, 0, ['looping-stride']).clip).toBe('other-outfit');
});
test('blocks with a detector leg swap cannot drive the gait transition', () => {
  const frames = [
    {...f('swap', 10), gait: [.2,.7,.8,.7]},
    {...f('swap', 11), gait: [.8,.7,.2,.7]},
    {...f('swap', 12), gait: [.79,.7,.21,.7]},
    {...f('clean', 20), gait: [.2,.7,.8,.7]},
    {...f('clean', 21), gait: [.21,.7,.79,.7]},
    {...f('clean', 22), gait: [.22,.7,.78,.7]},
  ];
  expect(buildBlocks(frames).map(block => block.clip)).toEqual(['clean']);
});
test('no direction immediately rewinds an outfit during several walking cycles', () => {
  const blocks = buildBlocks(data.frames);
  for (let yaw=-90; yaw<=90; yaw++) {
    let recent: string[] = [], last: AngleFrame | undefined, phase = 0;
    const candidates = directionCandidates(blocks, yaw);
    for (let cut=0; cut<60; cut++) {
      const next = choosePoseBlock(candidates, yaw, phase, recent, last?.gait, last?.gaitVelocity);
      const look = next.look ?? next.clip;
      expect(look, `immediate replay at ${yaw}`).not.toBe(recent[0]);
      last = data.frames[next.start + 2];
      phase = (last.phase + 1/30) % 1;
      recent = [look, ...recent].slice(0,4);
    }
  }
});
test('each representative direction visits several compatible outfits during playback', () => {
  const blocks = buildBlocks(data.frames);
  for (const yaw of [-90,-75,-60,-38,-35,-30,-20,-15,-10,-5,0,15,30,45,60,75,90]) {
    let recent: string[]=[]; let previous: readonly number[] | undefined; let velocity: readonly number[] | undefined; const visited=new Set<string>();
    for (let cut=0; cut<120; cut++) {
      const block=choosePoseBlock(blocks,yaw,(cut/10)%1,recent,previous,velocity);
      const look=block.look ?? block.clip; visited.add(look); recent=[look,...recent].slice(0,4);
      previous=data.frames[block.start+2].gait;
      velocity=data.frames[block.start+2].gaitVelocity;
    }
    // Phase and joint continuity can narrow an eight-outfit source pool.
    expect(visited.size, `playback at ${yaw}`).toBeGreaterThanOrEqual(6);
  }
});
test('an approaching foot keeps moving in the same direction across an identity cut', () => {
  const pose = [0,0,0,0,0,0,0,0];
  const velocity = [.01,0,0,0,0,0,0,0];
  const blocks = [
    {start:0,yaw:-15,phase:0,clip:'reverse',gait:velocity,gaitVelocity:velocity.map(v=>-v)},
    {start:3,yaw:-15,phase:.01,clip:'forward',gait:velocity,gaitVelocity:velocity},
  ];
  expect(choosePoseBlock(blocks,-15,0,[],pose,velocity).clip).toBe('forward');
});
test('near-front directions have filmed intermediate views instead of repeating only frontal frames', () => {
  const blocks=buildBlocks(data.frames);
  for(const yaw of [-10,-15,-20]) {
    for(let step=0;step<30;step++) {
      const block=choosePoseBlock(blocks,yaw,step/30);
      expect(block.yaw).toBeLessThan(0);
      expect(Math.abs(block.yaw-yaw)).toBeLessThanOrEqual(5);
    }
  }
});
test('all exported source identities are unique and stay inside one camera shot', () => {
  expect(new Set(data.frames.map(f=>`${f.clip}:${f.sourceFrame}`)).size).toBe(data.frames.length);
  expect(new Set(data.frames.map(f=>`${f.source}:${f.sourceFrame}`)).size).toBe(data.frames.length);
  for (const clip of data.clips) {
    const frames=data.frames.filter(f=>f.clip===clip.id);
    expect(buildBlocks(frames).length,clip.id).toBeGreaterThan(0);
    for (const f of frames) {
      expect(f.sourceFrame).toBeGreaterThanOrEqual(clip.sourceSegment[0]);
      expect(f.sourceFrame).toBeLessThan(clip.sourceSegment[1]);
    }
  }
});
test('finale supplements contain only reviewed complete frames of one outfit', () => {
  for(const clip of data.clips.filter(c=>c.id.startsWith('hermes-turn-'))) {
    const allowed=new Set(clip.reviewedFrames);
    for(const f of data.frames.filter(f=>f.clip===clip.id))expect(allowed.has(f.sourceFrame)).toBe(true);
    expect(clip.screenPhaseCalibration?.reference).toBe(clip.phaseReference);
  }
});
test('75-degree selection excludes frontal and rear parts of the reviewed turns', () => {
  expect(data.yawRange).toEqual([-90,90]);
  const eligible=directionCandidates(buildBlocks(data.frames),-75);
  const selected=eligible.flatMap(b=>data.frames.slice(b.start,b.start+data.holdFrames));
  expect(selected.some(f=>f.clip==='lv-left-100')).toBe(false);
  expect(selected.filter(f=>f.clip==='prada-oblique-234').every(f=>f.sourceFrame>=5872)).toBe(true);
  expect(selected.some(f=>f.clip==='prada24-turn-351')).toBe(false);
  expect(selected.filter(f=>f.clip==='prada-look-318').every(f=>f.sourceFrame>=7968)).toBe(true);
  expect(selected.filter(f=>f.clip==='prada-left-154').every(f=>f.sourceFrame<=3850)).toBe(true);
  expect(selected.every(f=>Math.abs(f.yaw+75)<6)).toBe(true);
  expect(data.frames.some(f=>f.clip==='prada-look-80'&&f.sourceFrame===2011)).toBe(false);
  expect(data.frames.some(f=>f.clip==='prada24-turn-142'&&[3557,3560,3561,3562].includes(f.sourceFrame))).toBe(false);
  expect(data.frames.some(f=>f.clip==='prada24-turn-351'&&[8778,8787,8802].includes(f.sourceFrame))).toBe(false);
  const rear=data.frames.find(f=>f.clip==='prada24-turn-351'&&f.sourceFrame===8804);
  expect(rear?.yaw).toBeLessThan(-100);
  for(const clip of ['prada-look-318','prada-look-26','prada-look-186']) {
    const yaws=data.frames.filter(f=>f.clip===clip).map(f=>f.yaw);
    expect(Math.max(...yaws)-Math.min(...yaws),clip).toBeGreaterThan(20);
  }
});
test('registered stature and floor remain stable across the actual library', () => {
  const heights=data.frames.map(f=>f.registration.height).sort((a,b)=>a-b);
  const floors=data.frames.map(f=>f.registration.ground).sort((a,b)=>a-b);
  const p=(values: number[],q: number)=>values[Math.floor((values.length-1)*q)];
  expect(p(heights,.95)-p(heights,.05)).toBeLessThan(30);
  expect(p(floors,.95)-p(floors,.05)).toBeLessThan(15);
  for(const f of data.frames) {
    expect(f.gait.length).toBe(8);
    expect(f.gaitVelocity.length).toBe(8);
    expect(f.gait.every(v=>Number.isFinite(v)&&Math.abs(v)<1)).toBe(true);
  }
});
test('prefer compatible knee and ankle positions when phase estimates are close', () => {
  const previous = [-.08,.18,.08,.18,-.1,.35,.1,.35];
  const blocks = [
    {start:0,yaw:-45,phase:0,clip:'swapped-legs',gait:[.1,.18,-.1,.18,.2,.35,-.2,.35]},
    {start:3,yaw:-45,phase:.02,clip:'continuous',gait:previous},
    {start:6,yaw:0,phase:0,clip:'wrong-direction',gait:previous},
  ];
  expect(choosePoseBlock(blocks,-38,0,[],previous).clip).toBe('continuous');
  expect(gaitDistance(previous,previous)).toBe(0);
});

test('an available direction does not widen the absolute five-degree allowance', () => {
  const blocks=[
    {start:0,yaw:-35,minYaw:-36,maxYaw:-34,phase:.1,clip:'close'},
    {start:3,yaw:-30,minYaw:-30,maxYaw:-30,phase:0,clip:'too-frontal'},
  ];
  expect(directionCandidates(blocks,-38).map(b=>b.clip)).toEqual(['close']);
  expect(choosePoseBlock(blocks,-38,0).clip).toBe('close');
});

test('right-facing Prada footage never enters a left-facing candidate pool', () => {
  const blocks=buildBlocks(data.frames);
  for(let yaw=-90;yaw<=0;yaw++) {
    const selected=directionCandidates(blocks,yaw);
    expect(selected.some(b=>['prada25-curve-70','prada25-nearfront-83'].includes(b.clip))).toBe(false);
    for(const b of selected) {
      expect(Math.abs((b.minYaw??b.yaw)-yaw)).toBeLessThanOrEqual(5);
      expect(Math.abs((b.maxYaw??b.yaw)-yaw)).toBeLessThanOrEqual(5);
    }
  }
});


test('corrected ankle detections remain usable in the bag-free library', () => {
  const frames=data.frames;
  expect(frames.some(f=>f.clip==='prada24-turn-76')).toBe(false);
  expect(frames.some(f=>f.clip==='lv-left-100'&&f.sourceFrame===2529)).toBe(false);
  expect(frames.some(f=>f.clip==='hermes25-left-613'&&f.sourceFrame===15358)).toBe(true);
  expect(frames.some(f=>f.clip==='hermes25-left-613'&&f.sourceFrame===15359)).toBe(true);
  for(const sourceFrame of [15075,15076])expect(frames.some(f=>f.clip==='hermes25-left-601'&&f.sourceFrame===sourceFrame)).toBe(true);
  expect(frames.some(f=>f.clip==='hermes25-left-626'&&f.sourceFrame===15676)).toBe(false);
  for(const sourceFrame of [15677,15678,15679])expect(frames.some(f=>f.clip==='hermes25-left-626'&&f.sourceFrame===sourceFrame)).toBe(true);
  for(const clip of ['lv-left-100','prada-left-129'])expect(frames.some(f=>f.clip===clip)).toBe(false);
});


test('the expanded right range is filmed and stays within the absolute allowance for all three frames', () => {
  const blocks=buildBlocks(data.frames);
  const newSources=new Set(['hermes24','hermes25']);
  expect(new Set(data.frames.filter(f=>newSources.has(f.source)&&f.yaw>=80&&f.yaw<=95).map(f=>f.look)).size).toBeGreaterThanOrEqual(8);
  for(let yaw=-90;yaw<=90;yaw++) {
    for(const block of directionCandidates(blocks,yaw)) {
      for(const frame of data.frames.slice(block.start,block.start+data.holdFrames)) {
        expect(Math.abs(frame.yaw-yaw),`${yaw}: ${frame.clip}/${frame.sourceFrame}`).toBeLessThanOrEqual(5);
        if(yaw>=15)expect(frame.yaw).toBeGreaterThan(0);
      }
    }
  }
  for(const source of data.sources.filter(s=>newSources.has(s.id))) {
    expect(source.originalFps).toBe(30);
    expect(source.fps).toBe(25);
    expect(source.sourceOffset).toBe(0);
  }
});


test('crowded shots contain only the source-reviewed complete frames', () => {
  const restricted=['hermes25-right-275','hermes25-left-626','hermes25-left-542','hermes25-right-341','hermes25-left-574','hermes25-right-188','hermes24-clean-563'];
  for(const id of restricted) {
    const clip=data.clips.find(c=>c.id===id)!;
    const allowed=new Set(clip.reviewedFrames);
    for(const frame of data.frames.filter(f=>f.clip===id))expect(allowed.has(frame.sourceFrame),`${id}/${frame.sourceFrame}`).toBe(true);
  }
});
test('re-reviewed frontal bodies cannot enter the forty-degree pool', () => {
  expect(data.frames.filter(frame=>frame.clip==='hermes25-right-477').every(frame=>frame.yaw<=15)).toBe(true);
  const candidates = directionCandidates(buildBlocks(data.frames),40);
  expect(candidates.some(block=>block.clip==='hermes25-right-477')).toBe(false);
  for(const clip of ['hermes24-clean-145','hermes24-clean-110','hermes25-right-178']) {
    expect(data.frames.some(frame=>frame.clip===clip),clip).toBe(false);
  }
});
test('newly identified spectator fragments and partial silhouettes stay excluded', () => {
  const excluded: Record<string, number[]> = {
    'hermes24-right-169':[4221,4224,4226,4236,4259,4260,4261,4262,4279,4280],
    'hermes24-right-184':[4658,4659,4660,4661],
    'hermes25-right-504':[12622,12623,12624],
    'hermes25-right-485':[12125,12126,12127,12128,12129,12130],
    'hermes25-left-601':[15058,15059,15060,15061,15062,15064,15065,15066],
    'hermes25-right-178':[4455,4456],
    'prada24-turn-130':[3231,3232,3233,3234,3242,3255,3256],
  };
  for(const [clip,indices] of Object.entries(excluded)) {
    expect(data.frames.some(frame=>frame.clip===clip && indices.includes(frame.sourceFrame)),clip).toBe(false);
  }
});
test('foot position takes priority over a closer phase with visibly displaced ankles', () => {
  const previous=[.4,.65,.6,.65,.3,.85,.65,.9];
  const candidates=[
    {start:0,yaw:-15,phase:0,clip:'jumping-feet',gait:[.4,.65,.6,.65,.39,.85,.74,.9]},
    {start:3,yaw:-15,phase:.06,clip:'aligned-feet',gait:previous},
  ];
  expect(choosePoseBlock(candidates,-15,0,[],previous).clip).toBe('aligned-feet');
});
test('a changed anatomical leg label cannot outweigh the same visible foot positions and motion', () => {
  const previous=[.4,.65,.6,.65,.3,.85,.65,.9], velocity=[.01,0,-.01,0,.02,0,-.02,0];
  const candidates=[
    {start:0,yaw:-15,phase:0,clip:'displaced',gait:[.4,.65,.6,.65,.45,.85,.8,.9],gaitVelocity:velocity},
    {start:3,yaw:-15,phase:.5,clip:'same-pixels',gait:[.59,.65,.41,.65,.63,.9,.32,.85],gaitVelocity:[-.01,0,.01,0,-.02,0,.02,0]},
  ];
  expect(choosePoseBlock(candidates,-15,0,[],previous,velocity).clip).toBe('same-pixels');
});
test('minus fifteen degree walking keeps the cut-to-cut foot displacement small', () => {
  const candidates=directionCandidates(buildBlocks(data.frames),-15);
  const swap=(g: readonly number[])=>[g[6],g[7],g[4],g[5]];
  let phase=0,recent: string[]=[],last: AngleFrame|undefined;
  const jumps: number[]=[];
  for(let cut=0;cut<150;cut++) {
    const next=choosePoseBlock(candidates,-15,phase,recent,last?.gait,last?.gaitVelocity);
    const start=data.frames[next.start];
    if(last?.gait)jumps.push(Math.min(gaitDistance(start.gait.slice(4),last.gait.slice(4)),gaitDistance(swap(start.gait),last.gait.slice(4))));
    last=data.frames[next.start+2];phase=(last.phase+1/30)%1;
    recent=[next.look??next.clip,...recent].slice(0,4);
  }
  jumps.sort((a,b)=>a-b);
  expect(jumps.reduce((sum,jump)=>sum+jump,0)/jumps.length).toBeLessThan(.025);
  expect(jumps[Math.floor(jumps.length*.95)]).toBeLessThan(.05);
});
