/** Fixed visual regression gate. The optional report path is local QA output. */
import fs from 'node:fs';import {createServer} from 'vite';
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true},server:{middlewareMode:true}});
try{
 const {ReferenceSequencer}=await server.ssrLoadModule('/pages/runway-walk/reference-sequencer.ts');
 const {auditSequence}=await server.ssrLoadModule('/pages/runway-walk/sequence-audit.ts');
 const {MOTION_LIMITS}=await server.ssrLoadModule('/pages/runway-walk/motion-quality.ts');
 const schedule=JSON.parse(fs.readFileSync('pages/runway-walk/reference-schedule.json'));
 const data=JSON.parse(fs.readFileSync('pages/runway-walk/angles.json')),poses=JSON.parse(fs.readFileSync('pages/runway-walk/debug-poses.json')),planner=new ReferenceSequencer(data.frames),reports=[];
 for(let yaw=-90;yaw<=90;yaw+=5){
  try{const r=auditSequence(planner,data.frames,yaw,1200,poses.frames),displayed=r.indices.map(i=>data.frames[i]);reports.push({yaw,...r.quality,displayedPhotos:new Set(displayed.map(f=>`${f.source}:${f.sourceFrame}`)).size,displayedOutfits:new Set(displayed.map(f=>f.look??f.clip)).size,upperBody:r.upperBody,progress:r.progress,progressWarnings:r.appearances.filter(a=>['reverse','stall','unmeasurable'].includes(a.status)),worst:r.transitions.sort((a,b)=>b.footResidual-a.footResidual).slice(0,10)});}
  catch(error){reports.push({yaw,pass:false,error:String(error)});}
 }
 console.table(reports.map(({worst,upperBody,progressWarnings,progress,...row})=>({...row,upperBodyPass:upperBody?.pass,reverse:progress?.reverse,stall:progress?.stall,uncertainFeet:progress?.unmeasurable})));
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({assetVersion:data.assetVersion,limits:MOTION_LIMITS,reports},null,2)+'\n');
 const failed=reports.filter(r=>!r.pass);console.log(`${37-failed.length}/37 angles meet the fixed motion gates`);if(failed.length)process.exitCode=1;
 const fullyQualified=reports.filter(r=>r.pass&&r.upperBody?.pass);console.log(`${fullyQualified.length}/37 angles also meet the accepted profile's face stability gates`);if(fullyQualified.length<37)process.exitCode=1;
 const progressFailed=reports.filter(r=>schedule.progressReview?.yaws.includes(r.yaw)&&(!r.progress||r.progress.reverse||r.progress.stall||r.progress.unmeasurable));
 console.log(`Appearance progress review: ${schedule.progressReview?.yaws.length??0} qualified views, ${progressFailed.length} regressions; other views retain diagnostic warnings.`);if(progressFailed.length)process.exitCode=1;
}finally{await server.close();}
