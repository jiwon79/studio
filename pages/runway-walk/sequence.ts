import data from './angles.json';
import poses from './debug-poses.json';
import {applyPhotoTransform,transformPhotoPoint} from './photo-registration';
import {reviewSequence,reviewTick,type ReviewFrame} from './sequence-model';
import {snapYaw} from './direction-step';
import {frameKey,categories,type Feedback} from './review-model';

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const angle=$<HTMLSelectElement>('angle'),density=$<HTMLSelectElement>('density');
const joints=$<HTMLInputElement>('joints'),detailJoints=$<HTMLInputElement>('detail-joints');
const dialog=$<HTMLDialogElement>('detail'),source=$<HTMLImageElement>('source-photo');
const original=$<HTMLDetailsElement>('original'),share=$<HTMLInputElement>('share');
const params=new URL(location.href).searchParams;
const requestedAngle=Number(params.get('angle')??-25);
let target=Number.isFinite(requestedAngle)?snapYaw(requestedAngle):-25;
let rows:ReviewFrame[]=[],selected=0,generation=0,detailGeneration=0;
let feedback:Feedback[]=[];
const poseByKey=new Map(poses.frames.map(p=>[p.key,p]));
const compressed=new Map<number,Promise<Blob>>();
type Tile={row:ReviewFrame;photo:HTMLCanvasElement;bones:HTMLCanvasElement;button:HTMLButtonElement};
let tiles:Tile[]=[];
const signed=(n:number,digits=0)=>`${n>0?'+':n<0?'−':''}${Math.abs(n).toFixed(digits)}°`;
function element<K extends keyof HTMLElementTagNameMap>(tag:K,text=''){
 const node=document.createElement(tag);node.textContent=text;return node;
}
function pageURL(file:string,tick?:number){
 const url=new URL(file,location.href);url.searchParams.set('v','47');url.searchParams.set('angle',String(target));
 if(tick!==undefined)url.searchParams.set('tick',String(tick));return url;
}
function updateURL(detail=false){
 const url=pageURL('./sequence.html',detail?selected:undefined);
 if(density.value==='first')url.searchParams.set('view','first');
 history.replaceState(null,'',url);
}
function blob(index:number){
 let promise=compressed.get(index);
 if(!promise){
  promise=fetch(new URL(`./media/angles/${data.atlases[index]}`,import.meta.url)).then(r=>{
   if(!r.ok)throw Error('사진을 불러오지 못했어요.');return r.blob();
  });
  compressed.set(index,promise);
  const current=promise;void promise.catch(()=>{if(compressed.get(index)===current)compressed.delete(index);});
 }
 return promise;
}
function canvases(row:ReviewFrame,width:number){
 const box=element('div');box.className='photo';
 const photo=element('canvas'),bones=element('canvas');
 for(const canvas of [photo,bones]){canvas.width=width;canvas.height=width*1.5;canvas.setAttribute('aria-hidden','true');}
 bones.className='bones';box.append(photo,bones);drawBones(bones,row);return {box,photo,bones};
}
function drawBones(canvas:HTMLCanvasElement,row:ReviewFrame){
 const pose=poseByKey.get(frameKey(data.frames[row.index]));if(!pose)return;
 const ctx=canvas.getContext('2d')!,points=pose.points.map(p=>transformPhotoPoint(p,row.transform));
 const color=(index:number,confidence:number)=>confidence<.5?'#ffb86c':index%2?'#6ef0cf':'#79beff';
 ctx.lineWidth=canvas.width/160;
 for(const [a,b] of poses.connections){
  const p=points[a],q=points[b];ctx.strokeStyle=color(a,Math.min(p[2],q[2]));
  ctx.beginPath();ctx.moveTo(p[0]*canvas.width,p[1]*canvas.height);ctx.lineTo(q[0]*canvas.width,q[1]*canvas.height);ctx.stroke();
 }
 points.forEach((p,i)=>{ctx.beginPath();ctx.arc(p[0]*canvas.width,p[1]*canvas.height,canvas.width/100,0,Math.PI*2);ctx.fillStyle=color(i,p[2]);ctx.fill();ctx.strokeStyle='#244557';ctx.lineWidth=canvas.width/320;ctx.stroke();});
 canvas.dataset.joints=String(points.length);
}
function drawPhoto(canvas:HTMLCanvasElement,row:ReviewFrame,image:ImageBitmap){
 const f=data.frames[row.index],ctx=canvas.getContext('2d')!;
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.scale(canvas.width/512,canvas.height/768);
 applyPhotoTransform(ctx,row.transform);
 ctx.drawImage(image,f.tile%data.columns*512,Math.floor(f.tile/data.columns)*768,512,768,0,0,512,768);ctx.restore();
}
function highlight(tick:number){
 selected=reviewTick(tick,rows.length);$<HTMLInputElement>('order').value=String(selected+1);
 for(const t of tiles)t.button.setAttribute('aria-current',String(t.row.tick===selected));
}
function updateLinks(){
 $<HTMLAnchorElement>('artwork').href=pageURL('./angle.html').href;
 $<HTMLAnchorElement>('debug').href=pageURL('./debug.html',selected).href;
}
function frameReviews(index:number){
 const key=frameKey(data.frames[index]);
 return feedback.filter(r=>r.frameKey===key&&(r.category!=='angle'||r.target===target));
}
function renderReviewNotes(){
 const notes=frameReviews(rows[selected].index),root=$('review-notes');root.replaceChildren();
 for(const row of notes){
  const article=element('article');article.className='review-note';
  article.append(element('b',`${row.author==='codex'?'Codex':'사용자'} · ${categories[row.category]} · ${signed(row.target)}`),element('p',row.note||categories[row.category]));root.append(article);
 }
}
function updateReviewBadges(){
 let count=0;
 for(const tile of tiles){
  tile.button.querySelector('.review-badge')?.remove();
  const notes=frameReviews(tile.row.index);if(!notes.length)continue;count++;
  const badge=element('small',notes.some(r=>r.author==='codex')?'Codex 검토 의견':'사용자 의견');badge.className='review-badge';tile.button.querySelector('.frame-text')!.append(badge);
 }
 $('review-status').textContent=`검토 의견이 있는 순번 ${count}개 · 표시가 없다고 검토를 통과한 것은 아닙니다.`;
 if(dialog.open)renderReviewNotes();
}
async function refreshReviews(){
 try{const response=await fetch('/api/runway-walk/feedback',{cache:'no-store'});if(!response.ok)throw Error();
  const body=await response.json();if(!Array.isArray(body.records))throw Error();feedback=body.records;updateReviewBadges();
 }catch{$('review-status').textContent='검토 의견을 불러오지 못했어요. 사진과 관절은 계속 볼 수 있습니다.';}
}
function showLoadState(){
 const loaded=tiles.filter(t=>t.button.dataset.loaded==='true').length,failed=tiles.filter(t=>t.button.dataset.error==='true').length;
 $('loaded').textContent=`사진 ${loaded} / ${rows.length}장 준비됨${failed?` · ${failed}장 로딩 실패`:loaded===rows.length?' · 전체 순서 준비 완료':''}`;
 $('sequence').setAttribute('aria-busy',String(loaded+failed<rows.length));$('retry').hidden=!failed;
}
async function loadTiles(epoch:number){
 const groups=new Map<number,Tile[]>();
 for(const t of tiles){if(t.button.dataset.loaded==='true')continue;delete t.button.dataset.error;
  const atlas=data.frames[t.row.index].atlas;groups.set(atlas,[...(groups.get(atlas)??[]),t]);}
 const queue=[...groups];showLoadState();
 // Decode only two atlas pages at once. Close each immediately after drawing
 // all occurrences; keeping hundreds of decoded atlas images exhausts phones.
 async function worker(){
  while(queue.length&&epoch===generation){
   const [atlas,group]=queue.shift()!;let image:ImageBitmap|undefined;
   try{
    const contents=await blob(atlas);if(epoch!==generation)return;
    image=await createImageBitmap(contents);if(epoch!==generation)return;
    for(const t of group){drawPhoto(t.photo,t.row,image);t.button.dataset.loaded='true';}
   }catch{if(epoch===generation)for(const t of group)t.button.dataset.error='true';}
   finally{image?.close();}
   if(epoch===generation)showLoadState();
  }
 }
 await Promise.all([worker(),worker()]);
}
function renderAngle(){
 const epoch=++generation;++detailGeneration;dialog.close();compressed.clear();
 rows=reviewSequence(data.frames,target);tiles=[];selected=0;
 angle.value=String(target);$<HTMLButtonElement>('angle-minus').disabled=target===-90;$<HTMLButtonElement>('angle-plus').disabled=target===90;
 document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.angle)===target)));
 const unique=new Set(rows.map(r=>r.index)),looks=new Set(rows.map(r=>data.frames[r.index].look));
 $('summary').textContent=`재생 ${signed(target)} · ${rows.length}프레임 / ${(rows.length/data.fps).toFixed(0)}초 · 서로 다른 사진 ${unique.size}장 · ${looks.size}착장`;
 const fragment=document.createDocumentFragment();let group:HTMLElement|undefined,frames:HTMLElement|undefined;
 for(const row of rows){
  const f=data.frames[row.index];
  if(row.offset===0){
   group=element('section');group.className='cut';group.dataset.cut=String(row.cut);
   const heading=element('h2',`묶음 ${row.cut+1}`);heading.append(element('span',`${(row.tick/data.fps).toFixed(2)}초 · ${row.tick+1}–${Math.min(row.tick+3,rows.length)}번`));
   frames=element('div');frames.className='frames';const label=element('p',f.clip);label.className='cut-source';
   group.append(heading,frames,label);fragment.append(group);
  }
  const button=element('button');button.type='button';button.className='frame';
  Object.assign(button.dataset,{tick:String(row.tick),index:String(row.index),offset:String(row.offset),frameKey:frameKey(f),yaw:String(f.yaw),transform:JSON.stringify(row.transform)});
  button.setAttribute('aria-label',`${row.tick+1}번 · 추정 ${signed(f.yaw,1)} · ${frameKey(f)} · 앞뒤 비교`);
  const {box,photo,bones}=canvases(row,160),text=element('span');text.className='frame-text';
  text.append(element('b',`${row.tick+1}번`),element('span',`추정 ${signed(f.yaw,1)}`),element('small',`원본 #${f.sourceFrame}`));
  button.append(box,text);button.onclick=()=>void showDetail(row.tick);frames!.append(button);tiles.push({row,photo,bones,button});
 }
 $('sequence').replaceChildren(fragment);highlight(0);updateLinks();updateURL();updateReviewBadges();void loadTiles(epoch);
}
async function showDetail(tick:number){
 highlight(tick);updateLinks();updateURL(true);const epoch=++detailGeneration,angleEpoch=generation;
 const row=rows[selected],f=data.frames[row.index];
 $('detail-title').textContent=`${signed(target)} · ${selected+1} / ${rows.length}번`;
 $('detail-meta').textContent=`묶음 ${row.cut+1}의 ${row.offset+1}번째 · 추정 ${signed(f.yaw,1)} · ${f.clip} · ${frameKey(f)}`;
 $('detail-state').textContent='앞뒤 사진을 불러오는 중';$<HTMLAnchorElement>('feedback-link').href=pageURL('./debug.html',selected).href;
 share.value=pageURL('./sequence.html',selected).href;$('copy').textContent='이 사진 링크 복사';
 const list=[-1,0,1].map((offset,i)=>{
  const neighbor=rows[reviewTick(selected+offset,rows.length)],frame=data.frames[neighbor.index],figure=element('figure');
  if(offset===0)figure.className='current';const {box,photo}=canvases(neighbor,384);
  figure.append(box,element('figcaption',`${['이전','선택','다음'][i]} ${neighbor.tick+1}번 · 추정 ${signed(frame.yaw,1)}`));
  figure.dataset.tick=String(neighbor.tick);return {neighbor,figure,photo};
 });
 $('neighbors').replaceChildren(...list.map(t=>t.figure));source.hidden=true;source.removeAttribute('src');$('source-state').textContent='';
 if(!dialog.open)dialog.showModal();renderReviewNotes();if(original.open)loadOriginal();
 let failures=0;
 for(const t of list){let image:ImageBitmap|undefined;
  try{const contents=await blob(data.frames[t.neighbor.index].atlas);if(epoch!==detailGeneration||angleEpoch!==generation)return;
   image=await createImageBitmap(contents);if(epoch!==detailGeneration||angleEpoch!==generation)return;drawPhoto(t.photo,t.neighbor,image);
  }catch{failures++;}finally{image?.close();}
 }
 if(epoch===detailGeneration&&angleEpoch===generation)$('detail-state').textContent=failures?'일부 사진을 불러오지 못했어요. 이전/다음 버튼으로 다시 선택해 주세요.':'';
}
function loadOriginal(){
 const key=frameKey(data.frames[rows[selected].index]);source.hidden=true;$('source-state').textContent='원본 영상에서 사진을 가져오는 중';
 source.onload=()=>{source.hidden=false;$('source-state').textContent=`원본 ${key}`;};
 source.onerror=()=>{$('source-state').textContent='원본을 불러오지 못했어요. 원본 보기를 닫았다가 다시 열어 주세요.';};
 source.src=`/api/runway-walk/source?frame=${encodeURIComponent(key)}`;
}
function setAngle(value:number){target=snapYaw(value);renderAngle();window.scrollTo(0,0);}
function setJoints(checked:boolean){joints.checked=detailJoints.checked=checked;document.body.dataset.joints=checked?'on':'off';}
for(let yaw=-90;yaw<=90;yaw+=5)angle.add(new Option(signed(yaw),String(yaw)));
angle.onchange=()=>setAngle(Number(angle.value));$('angle-minus').onclick=()=>setAngle(target-5);$('angle-plus').onclick=()=>setAngle(target+5);
document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(b=>b.onclick=()=>setAngle(Number(b.dataset.angle)));
joints.onchange=()=>setJoints(joints.checked);detailJoints.onchange=()=>setJoints(detailJoints.checked);
density.value=params.get('view')==='first'?'first':'all';document.body.dataset.density=density.value;
density.onchange=()=>{document.body.dataset.density=density.value;updateURL(dialog.open);};
$('jump').onsubmit=event=>{event.preventDefault();const tick=reviewTick(Number($<HTMLInputElement>('order').value)-1,rows.length);tiles[tick].button.closest('.cut')!.scrollIntoView({block:'start'});void showDetail(tick);};
$('retry').onclick=()=>{++generation;void loadTiles(generation);};
$('previous').onclick=()=>void showDetail(selected-1);$('next').onclick=()=>void showDetail(selected+1);
$('close').onclick=()=>dialog.close();dialog.onclose=()=>{if(dialog.open)return;++detailGeneration;updateURL();};
dialog.addEventListener('keydown',event=>{if(event.target instanceof HTMLInputElement)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();void showDetail(selected+(event.key==='ArrowLeft'?-1:1));}});
original.ontoggle=()=>{if(original.open&&dialog.open)loadOriginal();};
$('copy').onclick=async()=>{
 try{if(navigator.clipboard)await navigator.clipboard.writeText(share.value);else{share.select();if(!document.execCommand('copy'))throw Error();}$('copy').textContent='복사했어요';}
 catch{$('copy').textContent='아래 링크를 길게 눌러 복사해 주세요';share.focus();share.select();}
};
setJoints(true);renderAngle();
if(params.has('tick'))void showDetail(Number(params.get('tick')));
void refreshReviews();window.addEventListener('focus',()=>void refreshReviews());
