import {createServer} from 'vite';import fs from 'node:fs';import path from 'node:path';
const directory=path.resolve(process.argv[2]??'pages/runway-walk'),output=process.argv[3];
if(!output)throw Error('Expected output selection path');
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true},server:{middlewareMode:true}});
try {
 const {ReferenceSequencer}=await server.ssrLoadModule('/pages/runway-walk/reference-sequencer.ts');
 const {REFERENCE_MODEL_HASH,REFERENCE_DURATION}=await server.ssrLoadModule('/pages/runway-walk/gait-reference.ts');
 const {createWalkState}=await server.ssrLoadModule('/pages/runway-walk/reference-clock.ts');
 const data=JSON.parse(fs.readFileSync(path.join(directory,'angles.json'))),matches=JSON.parse(fs.readFileSync(path.join(directory,'reference-matches.json')));
 const motion=JSON.parse(fs.readFileSync(path.join(directory,'reference-motion.json')));
 if(matches.referenceModelHash!==motion.modelHash||matches.referenceDuration!==motion.duration||motion.modelHash!==REFERENCE_MODEL_HASH||motion.duration!==REFERENCE_DURATION)throw Error('Refit the current imported model before selecting drag photographs');
 if(matches.assetVersion!==data.assetVersion)throw Error('Refit the anatomical reference before generating drag photographs');
 const planner=new ReferenceSequencer(data.frames,data.holdFrames,matches.frames),phases=8,step=5,frames=[];
 for(let yaw=data.yawRange[0];yaw<=data.yawRange[1];yaw+=step){const row=[];for(let phase=0;phase<phases;phase++)row.push(planner.plan(yaw,createWalkState(phase/phases)).start);frames.push(row);}
 fs.writeFileSync(output,JSON.stringify({sourceAssetVersion:data.assetVersion,referenceMatchVersion:matches.matchVersion,selector:matches.version,phases,step,frames}));
}finally{await server.close();}
