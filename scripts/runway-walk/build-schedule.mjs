/** Compile cyclic photograph edits against the fixed visual gates.
 * A failed search never changes the gates or exports an unqualified path.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';

const root=path.resolve(process.argv[2]??'pages/runway-walk');
const output=path.resolve(process.argv[3]??path.join(root,'reference-schedule.json'));
const register=process.argv.slice(4).includes('--register');
const requested=process.argv.slice(4).filter(v=>v!=='--register').map(Number);
if(requested.some(y=>!Number.isInteger(y)||y< -90||y>90||y%5))throw Error('Directions must be 5-degree steps from -90 to 90');
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});
try {
 const {buildBlocks,directionCandidates}=await server.ssrLoadModule('/pages/runway-walk/angle-match.ts');
 const {ReferenceSequencer}=await server.ssrLoadModule('/pages/runway-walk/reference-sequencer.ts');
 const {clockPhase,CYCLE_FRAMES}=await server.ssrLoadModule('/pages/runway-walk/reference-clock.ts');
 const {measureMotion:rawMeasure,summarizeMotion,MOTION_LIMITS:L}=await server.ssrLoadModule('/pages/runway-walk/motion-quality.ts');
 const {registeredPosture,PHOTO_REGISTRATION_VERSION}=await server.ssrLoadModule('/pages/runway-walk/photo-registration.ts');
 const cache=new WeakMap();
 const posture=(p,phase,yaw)=>{if(!register)return p;let rows=cache.get(p);if(!rows){rows=new Map();cache.set(p,rows);}const key=`${yaw}:${phase.toFixed(6)}`;if(!rows.has(key))rows.set(key,registeredPosture(p,phase,yaw,true));return rows.get(key);};
 const measureMotion=(a,b,pa,pb,yaw)=>rawMeasure(posture(a,pa,yaw),posture(b,pb,yaw),pa,pb,yaw);
 const data=JSON.parse(fs.readFileSync(path.join(root,'angles.json')));
 const fits=JSON.parse(fs.readFileSync(path.join(root,'reference-matches.json')));
 if(data.assetVersion!==fits.assetVersion)throw Error('Refit the current photograph library first');
 const keys=data.frames.map(f=>`${f.source}:${f.sourceFrame}`);
 if(new Set(keys).size!==keys.length)throw Error('Duplicate photograph identity');
 const planner=new ReferenceSequencer(data.frames,3,fits.frames);
 const period=Math.round(CYCLE_FRAMES*9),steps=period/3,lookback=Math.ceil((CYCLE_FRAMES+2)/3),budget=Math.floor(period*.05);
 if(!Number.isInteger(steps))throw Error('The imported clock does not close on the three-frame cadence');
 const hard=m=>Number.isFinite(m.footResidual)&&m.footResidual<=L.footMax&&m.leanReliable&&m.leanResidual<=L.leanMax&&m.torsoResidual<=L.torsoMax;
 const fail=m=>[+(m.footResidual>L.footP95),+(m.leanResidual>L.leanP95),+(m.torsoResidual>L.torsoP95)];
 const cost=m=>(m.footResidual/L.footP95)**2+(m.leanResidual/L.leanP95)**2+(m.torsoResidual/L.torsoP95)**2;
 const phaseError=(a,b)=>Math.abs(((a-b+.5)%1+1)%1-.5);
 const blocks=buildBlocks(data.frames,3,2);
 // Use actual display times: a source frame is reusable only after a full gait,
 // including the last-to-first boundary. Source gaps must not change identity.
 const conflicts=(a,ta,b,tb)=>a.keys.some((key,i)=>b.keys.some((other,j)=>key===other&&Math.abs(tb+j-ta-i)<CYCLE_FRAMES));
 const directions={},failed=[];
 for(const yaw of requested.length?requested:Array.from({length:37},(_,i)=>i*5-90)) {
  const candidates=directionCandidates(blocks,yaw).filter(b=>Math.max(Math.abs(b.minYaw-yaw),Math.abs(b.maxYaw-yaw))<=5&&fits.frames.slice(b.start,b.start+3).every(f=>f.error<=.4&&!f.uncertain));
  const pools=[],edgeCache=new Map();
  for(let step=0;step<steps;step++) {
   const tick=step*3,nodes=[];
   for(const block of candidates) {
    if(phaseError(fits.frames[block.start].phase,clockPhase(tick))>.22)continue;
    const checks=[0,1,2].map(j=>planner.inspect(block.start+j,tick+j,yaw));
    if(checks.some(c=>c.oppositeFits)||checks.reduce((s,c)=>s+c.direct,0)/3>.4)continue;
    const rows=[1,2].map(j=>measureMotion(data.frames[block.start+j-1].posture,data.frames[block.start+j].posture,clockPhase(tick+j-1),clockPhase(tick+j),yaw));
    if(!rows.every(hard))continue;
    nodes.push({...block,keys:keys.slice(block.start,block.start+3),rows,bad:[0,1,2].map(a=>rows.reduce((s,m)=>s+fail(m)[a],0)),score:rows.reduce((s,m)=>s+cost(m)+fail(m).reduce((a,b)=>a+b,0)*100,0)+checks.reduce((s,c)=>s+c.direct,0)});
   }
   pools.push(nodes);
  }
  const empty=pools.flatMap((nodes,i)=>nodes.length?[]:[i*3]);
  if(empty.length){console.log(yaw,'EMPTY phases at display ticks',empty);failed.push(yaw);continue;}
  function edge(a,b,tick) {
   tick=(tick%period+period)%period;
   const key=`${tick}:${a.start}:${b.start}`;
   let value=edgeCache.get(key);
   if(!value){value=measureMotion(data.frames[a.start+2].posture,data.frames[b.start].posture,clockPhase(tick-1),clockPhase(tick),yaw);edgeCache.set(key,value);}
   return value;
  }
  function search(rotation) {
   const pool=step=>pools[(step+rotation)%steps];
   let beam=pool(0).map(b=>({path:[b],score:b.score,bad:b.bad})).sort((a,b)=>a.score-b.score).slice(0,128);
   for(let step=1;step<steps;step++) {
    const next=[];
    for(const state of beam)for(const block of pool(step)) {
     const previous=state.path.at(-1);
     if(previous.look===block.look)continue;
     const earliest=Math.max(0,step-lookback);
     if(state.path.slice(earliest).some((a,i)=>conflicts(a,(earliest+i)*3,block,step*3)))continue;
     const transition=edge(previous,block,(step+rotation)*3);
     if(!hard(transition))continue;
     const bad=state.bad.map((n,a)=>n+block.bad[a]+fail(transition)[a]);
     if(bad.some(n=>n>budget))continue;
     if(step>=steps-lookback&&state.path.slice(0,lookback).some((a,i)=>conflicts(block,step*3,a,period+i*3)))continue;
     if(step===steps-1) {
      const close=edge(block,state.path[0],rotation*3);
      if(!hard(close)||block.look===state.path[0].look)continue;
      for(let a=0;a<3;a++)bad[a]+=fail(close)[a];
      if(bad.some(n=>n>budget))continue;
     }
     const recent=state.path.slice(-4).filter(a=>a.look===block.look).length;
     next.push({path:[...state.path,block],bad,score:state.score+block.score+cost(transition)+recent*.2+fail(transition).reduce((a,b)=>a+b,0)*100});
    }
    if(!next.length){console.log(yaw,'search start',rotation*3,'stopped at',step*3);return;}
    next.sort((a,b)=>a.score-b.score);
    const seeds=new Map(),pairs=new Map();
    beam=next.filter(state=>{
     const seed=state.path[0].start,pair=[seed,...state.path.slice(-2).map(b=>b.start)].join(':');
     if((seeds.get(seed)??0)>=48||(pairs.get(pair)??0)>=4)return false;
     seeds.set(seed,(seeds.get(seed)??0)+1);pairs.set(pair,(pairs.get(pair)??0)+1);return true;
    }).slice(0,1536);
   }
   const ordered=Array(steps);
   beam[0].path.forEach((b,i)=>ordered[(i+rotation)%steps]=b);
   const indices=ordered.flatMap(b=>[b.start,b.start+1,b.start+2]);
   const rows=indices.map((index,tick)=>measureMotion(data.frames[indices[(tick+period-1)%period]].posture,data.frames[index].posture,clockPhase(tick-1),clockPhase(tick),yaw));
   const quality=summarizeMotion(rows,Array(steps).fill(3));
   if(!quality.pass)return;
   return {starts:ordered.map(b=>b.start),quality,outfits:new Set(ordered.map(b=>b.look)).size};
  }
  // Different starting phases explore different cyclic paths, keeping every
  // displayed tick, foot identity, source order and quality limit unchanged.
  let result;
  for(const rotation of [0,Math.floor(steps/4),Math.floor(steps/2),Math.floor(steps*3/4)]){result=search(rotation);if(result)break;}
  if(result){directions[yaw]=result.starts;console.log(yaw,JSON.stringify({...result.quality,outfits:result.outfits}));}
  else failed.push(yaw);
 }
 const reviewPolicy=JSON.parse(fs.readFileSync('pages/runway-walk/frame-audit.json'));
 const compiled={version:register?'fixed-cadence-v2':'fixed-cadence-v1',...(register?{registration:{version:PHOTO_REGISTRATION_VERSION,yaws:Object.keys(directions).map(Number)}}:{}),assetVersion:data.assetVersion,matchVersion:fits.matchVersion,periodFrames:period,cycleFrames:CYCLE_FRAMES,holdFrames:3,maxSourceStep:2,reviewPolicy,directions};
 console.log('Qualified angles:',Object.keys(directions).join(', '));
 if(failed.length){console.error('Missing coverage:',failed.join(', '));process.exitCode=1;}
 const liveOutput=output===path.resolve('pages/runway-walk/reference-schedule.json');
 if(liveOutput&&failed.length){
  // A diagnostic run must never erase a previously accepted edit. Partial
  // searches can be inspected through an explicit non-production output path.
  console.error('Keeping the installed schedule: one or more requested directions failed.');
 }else{
  if(liveOutput&&fs.existsSync(output)&&requested.length){
   const previous=JSON.parse(fs.readFileSync(output));
   const bindings=['version','assetVersion','matchVersion','periodFrames','cycleFrames','holdFrames','maxSourceStep','reviewPolicy','registration'];
   if(bindings.some(key=>JSON.stringify(previous[key])!==JSON.stringify(compiled[key])))throw Error('A subset cannot replace a schedule with different library, clock or review bindings; export and review the complete replacement separately');
   compiled.directions={...previous.directions,...directions};
  }
  const temporary=`${output}.tmp`;
  fs.writeFileSync(temporary,JSON.stringify(compiled)+'\n');
  fs.renameSync(temporary,output);
 }
} finally {await server.close();}
