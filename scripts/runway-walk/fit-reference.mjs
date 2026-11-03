/** Fit each filmed clip to one advancing, anatomical 3D gait. Never swap feet. */
import {createServer} from 'vite';import fs from 'node:fs';import crypto from 'node:crypto';import path from 'node:path';
const directory=path.resolve(process.argv[2]??'pages/runway-walk');
const motion=JSON.parse(fs.readFileSync(path.join(directory,'reference-motion.json')));
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true},server:{middlewareMode:true}});
try {
 const {referenceFeatures,legFeatures,legError,REFERENCE_JOINTS,REFERENCE_VERSION,REFERENCE_MODEL_HASH,REFERENCE_DURATION,suspectedFootRelabel}=await server.ssrLoadModule('/pages/runway-walk/gait-reference.ts');
 if(motion.modelHash!==REFERENCE_MODEL_HASH||motion.duration!==REFERENCE_DURATION)throw Error('Install the same imported reference model before fitting another output directory');
 const data=JSON.parse(fs.readFileSync(path.join(directory,'angles.json')));const poses=JSON.parse(fs.readFileSync(path.join(directory,'debug-poses.json')));
 const keys=data.frames.map(f=>`${f.source}:${f.sourceFrame}`);
 if(new Set(keys).size!==keys.length||new Set(poses.frames.map(p=>p.key)).size!==poses.frames.length)throw Error('Duplicate photograph identity: review overlapping source shots before fitting');
 const lookup=new Map(poses.frames.map(p=>[p.key,p.points]));const bins=120;
 const rows=data.frames.map(frame=>{
  const points=lookup.get(`${frame.source}:${frame.sourceFrame}`),features=legFeatures(points),confidence=REFERENCE_JOINTS.map(j=>points[j][2]);
  const costs=Array.from({length:bins},(_,phase)=>legError(features,referenceFeatures(phase/bins,frame.yaw),confidence));
  const leftGround=Math.max(points[29][1],points[31][1])*768,rightGround=Math.max(points[30][1],points[32][1])*768;
  const stance=leftGround-rightGround>18?'left':rightGround-leftGround>18?'right':'both';
  return {features,confidence,costs,stance};
 });
 const uncertain=new Set();
 for(let i=1;i<data.frames.length;i++){
  const previous=data.frames[i-1],frame=data.frames[i];
  if(previous.clip!==frame.clip||frame.sourceFrame!==previous.sourceFrame+1||!suspectedFootRelabel(rows[i-1].features,rows[i].features,rows[i].confidence))continue;
  for(let j=Math.max(0,i-3);j<Math.min(data.frames.length,i+4);j++)if(data.frames[j].clip===frame.clip&&Math.abs(data.frames[j].sourceFrame-frame.sourceFrame)<=2)uncertain.add(j);
 }
 const frames=Array(data.frames.length),clips=[];
 for(const clip of data.clips){
  const indices=data.frames.flatMap((f,i)=>f.clip===clip.id?[i]:[]),first=data.frames[indices[0]].sourceFrame;let best;
  const stable=indices.filter(i=>!uncertain.has(i));if(stable.length<8&&stable.length<indices.length)indices.forEach(i=>uncertain.add(i));
  const training=stable.length>=8?stable:indices;
  for(let freq=.65;freq<=1.25001;freq+=.01)for(let start=0;start<bins;start++){
   let cost=0;for(const i of training){const phase=(start/bins+(data.frames[i].sourceFrame-first)/data.fps*freq)%1;const ix=Math.round(phase*bins)%bins;cost+=rows[i].costs[ix]**2;}
   cost/=training.length;if(!best||cost<best.cost)best={frequency:freq,offset:start/bins,cost};
  }
  const errors=[];
  for(const i of indices){const phase=(best.offset+(data.frames[i].sourceFrame-first)/data.fps*best.frequency)%1;const error=rows[i].costs[Math.round(phase*bins)%bins];errors.push(error);frames[i]={phase:+phase.toFixed(6),error:+error.toFixed(6),stance:rows[i].stance,uncertain:uncertain.has(i),features:rows[i].features.map(v=>+v.toFixed(5)),confidence:rows[i].confidence.map(v=>+v.toFixed(3))};}
  clips.push({clip:clip.id,firstSourceFrame:first,...best,maxError:Math.max(...errors),uncertainFrames:indices.filter(i=>uncertain.has(i)).length});
 }
 if(!Array.from(frames).every(row=>row&&Number.isFinite(row.error)&&Number.isFinite(row.phase)))throw Error('Incomplete reference export');
 const digest=crypto.createHash('sha256').update(JSON.stringify({frames,version:REFERENCE_VERSION})).digest('hex').slice(0,12);
 const output={version:REFERENCE_VERSION,referenceModelHash:motion.modelHash,referenceDuration:motion.duration,assetVersion:data.assetVersion,matchVersion:digest,phaseConvention:'0 imported Walk_Formal_Loop start, 0.5 opposite contact; anatomical identity fixed',features:'hip-relative 2D knees ankles heels toes; one time-linear fit per source clip',frames,clips};
 fs.writeFileSync(path.join(directory,'reference-matches.json'),JSON.stringify(output)+'\n');
 console.log('Fitted',frames.length,'photos /',clips.length,'source clips',digest);
 console.log('Worst clip fits',clips.sort((a,b)=>b.cost-a.cost).slice(0,8));
}finally{await server.close();}
