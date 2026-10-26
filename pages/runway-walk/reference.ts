import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import data from './angles.json';
import poses from './debug-poses.json';
import referenceMatches from './reference-matches.json';
import motion from './reference-motion.json';
import {createWalkState,clockPhase,CYCLE_FRAMES} from './reference-clock';
import {ReferenceSequencer,type ReferenceCut} from './reference-sequencer';
import {referencePose,REFERENCE_HEIGHT} from './gait-reference';
import {AtlasPool} from './atlas-pool';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const angle=$<HTMLSelectElement>('angle'),phase=$<HTMLInputElement>('phase'),playButton=$<HTMLButtonElement>('play');
const sourcePoses=new Map(poses.frames.map(row=>[row.key,row.points]));
const planner=new ReferenceSequencer(data.frames);
let yaw=Number(new URL(location.href).searchParams.get('angle')??10);
if(!Number.isFinite(yaw))yaw=10;
yaw=Math.max(-90,Math.min(90,Math.round(yaw/5)*5));
for(let value=-90;value<=90;value+=5)angle.add(new Option(`${value>0?'+':''}${value}°`,String(value)));
angle.value=String(yaw);
type Photo={index:number;cut:ReferenceCut};
let requestedTick=Math.max(0,Math.floor(Number(new URL(location.href).searchParams.get('tick')??0)))||0;
let path:Photo[]=[],tick=0,playing=false,epoch=0,drawing=0,transport=0;
const blobs=new Map<number,Promise<Blob>>();
function blob(index:number){let pending=blobs.get(index);if(!pending){pending=fetch(new URL(`./media/angles/${data.atlases[index]}`,import.meta.url)).then(r=>{if(!r.ok)throw Error('사진 로딩 실패');return r.blob();}).catch(error=>{blobs.delete(index);throw error;});blobs.set(index,pending);}return pending;}
const images=new AtlasPool(async(index)=>createImageBitmap(await blob(index)),12);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(512,768,false);$('model').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#adb6ba');
const scale=660/REFERENCE_HEIGHT,viewHeight=768/scale,viewWidth=512/scale,center=(720-384)/scale;
const camera=new THREE.OrthographicCamera(-viewWidth/2,viewWidth/2,viewHeight/2,-viewHeight/2,.1,20);
camera.position.set(0,center,5);camera.lookAt(0,center,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x485767,2));
const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(2,4,3);scene.add(light);
const pivot=new THREE.Group();scene.add(pivot);
let mixer:THREE.AnimationMixer|undefined;
const imported=new GLTFLoader().loadAsync(new URL('./media/reference/quaternius-formal-walk.glb',import.meta.url).href).then(gltf=>{
    const clip=gltf.animations.find(a=>a.name===motion.clip);
    if(!clip||Math.abs(clip.duration-motion.duration)>1e-6)throw Error('기준 동작 파일이 맞지 않아요. 새로고침해 주세요.');
    // Use the downloaded skinned mesh and clip unchanged. Only yaw and one
    // constant floor registration are applied, exactly as in sampled landmarks.
    gltf.scene.position.y=-motion.floor;pivot.add(gltf.scene);
    mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(clip).play();
    renderer.domElement.dataset.modelHash=motion.modelHash;
    renderer.domElement.dataset.clip=clip.name;
});
const sphere=new THREE.SphereGeometry(.023,12,8);
const colors=[new THREE.MeshBasicMaterial({color:0x32c0ff}),new THREE.MeshBasicMaterial({color:0xff995b})];
const markers=[27,28,29,30,31,32].map((joint,i)=>{const mesh=new THREE.Mesh(sphere,colors[i%2]);scene.add(mesh);return{joint,mesh};});
const floor=new THREE.GridHelper(2,10,0x66787f,0x98a5aa);floor.position.y=-.006;scene.add(floor);
function model(){
    const gait=clockPhase(tick),pose=referencePose(gait,yaw);
    mixer!.setTime(gait*motion.duration);pivot.rotation.y=yaw*Math.PI/180;pivot.updateMatrixWorld(true);
    const show=$<HTMLInputElement>('joints').checked;
    markers.forEach(({joint,mesh})=>{mesh.position.set(...pose.points[joint]);mesh.visible=show;});
    renderer.render(scene,camera);
    renderer.domElement.dataset.phase=String(gait);renderer.domElement.dataset.yaw=String(yaw);
    const front=referencePose(gait),leading=front.points[27][2]>front.points[28][2]?'왼발 L':'오른발 R';
    $('support').textContent=`앞발: ${leading} · 지지발: ${pose.leftSupport&&pose.rightSupport?'양발':pose.leftSupport?'왼발 L':pose.rightSupport?'오른발 R':'전환 중'}`;
}
function skeleton(index:number){
    const svg=$('new-pose');svg.replaceChildren();if(!$<HTMLInputElement>('joints').checked)return;
    const frame=data.frames[index],p=sourcePoses.get(`${frame.source}:${frame.sourceFrame}`)!;
    for(const [ids,color,label] of [[[23,25,27,29,31],'#32c0ff','L'],[[24,26,28,30,32],'#ff995b','R']] as const){
        const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');
        line.setAttribute('points',ids.map(j=>`${p[j][0]*512},${p[j][1]*768}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke',color);line.setAttribute('stroke-width','3');
        const uncertain=referenceMatches.frames[index].uncertain||ids.some(j=>p[j][2]<.5);
        if(uncertain){line.setAttribute('stroke-dasharray','7 5');line.setAttribute('stroke-opacity','.6');}svg.append(line);
        const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.setAttribute('x',String(p[ids[2]][0]*512+8));text.setAttribute('y',String(p[ids[2]][1]*768-8));text.setAttribute('fill',color);text.setAttribute('font-size','24');text.setAttribute('font-weight','800');text.textContent=label+(uncertain?'?':'');svg.append(text);
    }
}
function retain(){images.retain(path.slice(tick,tick+10).map(row=>data.frames[row.index].atlas));}
async function draw(){
    const current=epoch,render=++drawing,frameTick=tick,row=path[tick];if(!row)return;
    const frame=data.frames[row.index];retain();const image=await images.load(frame.atlas);
    if(current!==epoch||render!==drawing||frameTick!==tick)return;
    // Change both views together, after the photograph has decoded.
    model();phase.value=String(Math.round(clockPhase(tick)*119));$('phase-value').textContent=`${Math.round(clockPhase(tick)*100)}%`;
    const canvas=$<HTMLCanvasElement>('new'),ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,512,768);
    ctx.drawImage(image,frame.tile%data.columns*512,Math.floor(frame.tile/data.columns)*768,512,768,0,0,512,768);skeleton(row.index);
    canvas.dataset.frame=`${frame.source}:${frame.sourceFrame}`;canvas.dataset.tick=String(tick);canvas.dataset.swapped='false';canvas.dataset.reference=motion.version;
    const error=planner.inspect(row.index,tick,yaw);
    $('new-info').textContent=`${frame.source}:${frame.sourceFrame} · 사진 ${frame.yaw.toFixed(1)}°\n관절 오차 ${error.direct.toFixed(3)} · 좌우 대응 고정`;
    const params=new URLSearchParams({angle:String(yaw),frame:`${frame.source}:${frame.sourceFrame}`});const previous=path[tick-1];
    if(previous){const f=data.frames[previous.index];params.set('previous',`${f.source}:${f.sourceFrame}`);}
    $<HTMLAnchorElement>('new-link').href=`./debug.html?${params}`;
    if(!playing)shareState();
    for(const row of path.slice(tick+1,tick+10))void images.load(data.frames[row.index].atlas).catch(()=>{});
}
function shareState(){const url=new URL(location.href);url.searchParams.set('angle',String(yaw));url.searchParams.set('tick',String(tick));history.replaceState(null,'',url);}
function pause(){transport++;playing=false;playButton.textContent='재생';if(path.length)shareState();}
function controls(enabled:boolean){playButton.disabled=!enabled;$<HTMLButtonElement>('previous').disabled=!enabled;$<HTMLButtonElement>('next').disabled=!enabled;phase.disabled=!enabled;}
async function prepare(){
    pause();epoch++;const current=epoch;tick=0;path=[];$('state').textContent='모델과 사진 준비 중…';$('state').className='';controls(false);
    let state=createWalkState();
    try{
        for(let i=0;i<120;i++){const cut=planner.plan(yaw,state);for(let j=0;j<cut.count;j++)path.push({index:cut.start+j,cut});state=cut.after;}
        const pages=[...new Set(path.map(row=>data.frames[row.index].atlas))];let index=0;
        await Promise.all([imported,...Array.from({length:6},async()=>{while(index<pages.length)await blob(pages[index++]);})]);
        if(current!==epoch)return;
        tick=Math.min(requestedTick,path.length-1);requestedTick=0;await draw();
        $('state').textContent=`${path.length}프레임 준비됨 · 원본 클립 ${motion.duration.toFixed(2)}초 / 한 주기 · 모델과 사진이 같은 시점으로 재생됩니다.`;controls(true);
    }catch(error){if(current!==epoch)return;$('state').textContent=error instanceof Error?error.message:'준비 실패';$('state').className='warning';}
}
async function play(){
    if(playing){pause();return;}if(!path.length)return;
    if(tick>=path.length-1){tick=0;await draw();}playing=true;playButton.textContent='정지';const current=epoch,run=++transport;
    while(playing&&current===epoch&&run===transport&&tick+1<path.length){const start=performance.now();tick++;await draw();await new Promise(resolve=>setTimeout(resolve,Math.max(0,1000/data.fps/Number($<HTMLSelectElement>('speed').value)-(performance.now()-start))));}
    if(current===epoch&&run===transport)pause();
}
angle.addEventListener('change',()=>{yaw=Number(angle.value);void prepare();});playButton.addEventListener('click',()=>void play());
$('previous').addEventListener('click',()=>{pause();tick=Math.max(0,tick-1);void draw();});$('next').addEventListener('click',()=>{pause();tick=Math.min(path.length-1,tick+1);void draw();});
phase.addEventListener('input',()=>{pause();tick=Math.min(path.length-1,Math.round(Number(phase.value)/120*CYCLE_FRAMES));void draw();});$('joints').addEventListener('change',()=>void draw());
$('scan').addEventListener('click',async()=>{
    pause();const button=$<HTMLButtonElement>('scan');button.disabled=true;$('scan-results').replaceChildren();let wrong=0,completed=0;
    for(let direction=-90;direction<=90;direction+=5){let next=createWalkState(),cuts=0,maxError=0;
        try{for(;cuts<120;cuts++){const cut=planner.plan(direction,next);maxError=Math.max(maxError,cut.referenceError);for(let i=0;i<cut.count;i++)if(planner.inspect(cut.start+i,next.tick+i,direction).oppositeFits)wrong++;next=cut.after;}completed++;}catch{/* Visible missing coverage. */}
        const link=document.createElement('a');link.href=`?angle=${direction}`;link.textContent=`${direction>0?'+':''}${direction}° · ${cuts}/120구간 · 최대 ${maxError.toFixed(2)}`;if(cuts<120)link.className='warning';$('scan-results').append(link);$('scan-state').textContent=`${(direction+90)/5+1}/37 방향 검사 중`;await new Promise(resolve=>setTimeout(resolve,0));
    }
    $('scan-state').textContent=`${completed}/37 방향 완료 · 반대 발 대응이 더 유리한 선택 ${wrong}건. 실제 사진의 좌우 추정과 전환 품질은 별도 확인이 필요합니다.`;button.disabled=false;
});
void prepare();
