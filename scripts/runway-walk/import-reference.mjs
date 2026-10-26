/** Import the existing CC0 Quaternius mannequin and its unchanged formal walk.
 * Usage: node scripts/runway-walk/import-reference.mjs path/to/UAL1_Standard.glb
 * The full upstream archive stays in .cache; only the mesh and selected clip ship.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const input=process.argv[2]??'.cache/runway-walk/reference/UAL1_Standard.glb';
const output=path.resolve(process.argv[3]??'pages/runway-walk');
const bytes=fs.readFileSync(input), hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceHash=hash(bytes),jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength));
const sourceBin=bytes.subarray(28+jsonLength),clipName='Walk_Formal_Loop';
if(json.extensionsRequired?.length)throw Error('Review upstream extensions before importing');
json.animations=json.animations.filter(a=>a.name===clipName);
if(json.animations.length!==1)throw Error('Expected the official formal walking clip');
// Remove unreferenced animation data while preserving all mesh, rig and clip bytes.
const accessors=new Set();
for(const mesh of json.meshes)for(const p of mesh.primitives){Object.values(p.attributes).forEach(i=>accessors.add(i));if(p.indices!==undefined)accessors.add(p.indices);}
for(const skin of json.skins)if(skin.inverseBindMatrices!==undefined)accessors.add(skin.inverseBindMatrices);
for(const animation of json.animations)for(const s of animation.samplers){accessors.add(s.input);accessors.add(s.output);}
const remap=new Map([...accessors].sort((a,b)=>a-b).map((i,j)=>[i,j]));
for(const mesh of json.meshes)for(const p of mesh.primitives){for(const name in p.attributes)p.attributes[name]=remap.get(p.attributes[name]);if(p.indices!==undefined)p.indices=remap.get(p.indices);}
for(const skin of json.skins)if(skin.inverseBindMatrices!==undefined)skin.inverseBindMatrices=remap.get(skin.inverseBindMatrices);
for(const animation of json.animations)for(const s of animation.samplers){s.input=remap.get(s.input);s.output=remap.get(s.output);}
json.accessors=[...remap.keys()].map(i=>json.accessors[i]);
const views=[...new Set(json.accessors.map(a=>a.bufferView))].sort((a,b)=>a-b),viewMap=new Map(views.map((v,i)=>[v,i]));
let offset=0;const chunks=[];
json.bufferViews=views.map(i=>{const v=json.bufferViews[i],body=sourceBin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength),start=offset;chunks.push(body);offset+=body.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return {...v,buffer:0,byteOffset:start};});
for(const a of json.accessors)a.bufferView=viewMap.get(a.bufferView);
const bin=Buffer.concat(chunks);json.buffers=[{byteLength:bin.length}];
const encoded=Buffer.from(JSON.stringify(json)),padded=Buffer.concat([encoded,Buffer.alloc((4-encoded.length%4)%4,32)]),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+bin.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(bin.length,0);binHeader.writeUInt32LE(0x004e4942,4);
const slim=Buffer.concat([header,padded,binHeader,bin]);
const gltf=await new GLTFLoader().parseAsync(slim.buffer.slice(slim.byteOffset,slim.byteOffset+slim.byteLength),'');
const root=gltf.scene,mixer=new THREE.AnimationMixer(root),clip=gltf.animations[0];root.updateMatrixWorld(true);
const meshes=[];root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
const world=(mesh,index)=>mesh.localToWorld(mesh.getVertexPosition(index,new THREE.Vector3()));
const rest=[];
for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++)rest.push({mesh,index:i,p:world(mesh,i)});
const bounds=new THREE.Box3().setFromPoints(rest.map(v=>v.p));
// Sole attachments come from the downloaded mesh, not invented heel motion.
const sole={};
for(const side of ['l','r']){
 const vertices=rest.filter(v=>{const joints=v.mesh.geometry.attributes.skinIndex,weights=v.mesh.geometry.attributes.skinWeight;let w=0;for(let k=0;k<4;k++)if([`foot_${side}`,`ball_${side}`].includes(v.mesh.skeleton.bones[joints.getComponent(v.index,k)].name))w+=weights.getComponent(v.index,k);return w>.5;});
 const box=new THREE.Box3().setFromPoints(vertices.map(v=>v.p)),size=box.getSize(new THREE.Vector3());
 for(const [name,front] of [['heel',false],['toe',true]]){
  const group=vertices.filter(v=>v.p.y<box.min.y+size.y*.28&&(front?v.p.z>box.max.z-size.z*.17:v.p.z<box.min.z+size.z*.17));
  if(!group.length)throw Error(`No source mesh sole attachment: ${side}/${name}`);
  sole[`${name}_${side}`]=group;
 }
}
const boneMap={0:'Head',1:'Head',2:'Head',3:'Head',4:'Head',5:'Head',6:'Head',7:'Head',8:'Head',9:'Head',10:'Head',11:'upperarm_l',12:'upperarm_r',13:'lowerarm_l',14:'lowerarm_r',15:'hand_l',16:'hand_r',17:'pinky_01_l',18:'pinky_01_r',19:'index_01_l',20:'index_01_r',21:'thumb_01_l',22:'thumb_01_r',23:'thigh_l',24:'thigh_r',25:'calf_l',26:'calf_r',27:'foot_l',28:'foot_r'};
const action=mixer.clipAction(clip);action.play();
const samples=[],crown=rest.filter(v=>v.p.y>bounds.max.y-.05);let animatedTop=-Infinity;
for(let i=0;i<120;i++){
 mixer.setTime(i/120*clip.duration);root.updateMatrixWorld(true);
 for(const v of crown)animatedTop=Math.max(animatedTop,world(v.mesh,v.index).y);
 const points=Array.from({length:33},(_,j)=>boneMap[j]?root.getObjectByName(boneMap[j]).getWorldPosition(new THREE.Vector3()):new THREE.Vector3());
 for(const [j,name] of [[29,'heel_l'],[30,'heel_r'],[31,'toe_l'],[32,'toe_r']]){const group=sole[name];points[j]=group.reduce((sum,v)=>sum.add(world(v.mesh,v.index)),new THREE.Vector3()).multiplyScalar(1/group.length);}
 samples.push(points.map(p=>p.toArray()));
}
const floor=Math.min(...samples.flatMap(p=>[p[29][1],p[30][1],p[31][1],p[32][1]]));
const height=animatedTop-floor;
for(const points of samples)for(const p of points){p[1]-=floor;for(let k=0;k<3;k++)p[k]=+p[k].toFixed(7);}
const metadata={version:'quaternius-formal-walk-v1',source:'https://quaternius.com/packs/universalanimationlibrary.html',download:'https://quaternius.itch.io/universal-animation-library',author:'Quaternius / Gonzalo Furnier',license:'CC0-1.0',upstreamFile:'Unreal-Godot/UAL1_Standard.glb',sourceHash,modelHash:hash(slim),clip:clipName,duration:clip.duration,height,floor,sampleCount:120,phaseOffset:0,phaseConvention:'0 original clip start, left forward heel contact; anatomical IDs unchanged',boneMap,soleVertices:Object.fromEntries(Object.entries(sole).map(([key,rows])=>[key,rows.map(v=>({mesh:v.mesh.name,index:v.index}))])),samples};
const dir=path.join(output,'media/reference');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'quaternius-formal-walk.glb'),slim);fs.writeFileSync(path.join(output,'reference-motion.json'),JSON.stringify(metadata)+'\n');
console.log({clip:clipName,duration:clip.duration,height,floor,sourceBytes:bytes.length,outputBytes:slim.length,sourceHash,modelHash:metadata.modelHash});
