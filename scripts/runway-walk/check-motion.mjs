/** Fixed visual regression gate. The optional report path is local QA output. */
import fs from 'node:fs';import {createServer} from 'vite';
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true},server:{middlewareMode:true}});
try{
 const {ReferenceSequencer}=await server.ssrLoadModule('/pages/runway-walk/reference-sequencer.ts');
 const {auditSequence}=await server.ssrLoadModule('/pages/runway-walk/sequence-audit.ts');
 const {MOTION_LIMITS}=await server.ssrLoadModule('/pages/runway-walk/motion-quality.ts');
 const data=JSON.parse(fs.readFileSync('pages/runway-walk/angles.json')),poses=JSON.parse(fs.readFileSync('pages/runway-walk/debug-poses.json')),planner=new ReferenceSequencer(data.frames),reports=[];
 for(let yaw=-90;yaw<=90;yaw+=5){
  try{const r=auditSequence(planner,data.frames,yaw,1200,poses.frames),displayed=r.indices.map(i=>data.frames[i]);reports.push({yaw,...r.quality,displayedPhotos:new Set(displayed.map(f=>`${f.source}:${f.sourceFrame}`)).size,displayedOutfits:new Set(displayed.map(f=>f.look??f.clip)).size,upperBody:r.upperBody,worst:r.transitions.sort((a,b)=>b.footResidual-a.footResidual).slice(0,10)});}
  catch(error){reports.push({yaw,pass:false,error:String(error)});}
 }
 console.table(reports.map(({worst,upperBody,...row})=>({...row,upperBodyPass:upperBody?.pass,faceWithinP95:upperBody?.withinP95,faceCutP95:upperBody?.cutP95})));
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({assetVersion:data.assetVersion,limits:MOTION_LIMITS,reports},null,2)+'\n');
 const failed=reports.filter(r=>!r.pass);console.log(`${37-failed.length}/37 angles meet the fixed motion gates`);if(failed.length)process.exitCode=1;
 const fullyQualified=reports.filter(r=>r.pass&&r.upperBody?.pass);console.log(`${fullyQualified.length}/37 angles also meet the accepted profile's face stability gates`);if(fullyQualified.length<37)process.exitCode=1;
}finally{await server.close();}
