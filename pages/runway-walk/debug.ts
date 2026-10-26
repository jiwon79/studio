import data from './angles.json';
import poses from './debug-poses.json';
import './debug.css';
import { buildBlocks, chooseCandidate, directionCandidates } from './angle-match';
import { AtlasPool } from './atlas-pool';
import { snapYaw } from './direction-step';
import { audits, frameAudits, heldForTarget } from './review-policy';
import { categories, frameKey, validateFeedback, type Feedback } from './review-model';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const angleInput = $<HTMLSelectElement>('angle'), scopeInput = $<HTMLSelectElement>('scope');
const search = $<HTMLInputElement>('search'), note = $<HTMLTextAreaElement>('note');
const category = $<HTMLSelectElement>('category'), jointInput = $<HTMLSelectElement>('joint');
const suggestion = $<HTMLInputElement>('suggested-yaw');
const canvas = $<HTMLCanvasElement>('photo'), context = canvas.getContext('2d')!;
const skeleton = $<HTMLInputElement>('skeleton'), numbers = $<HTMLInputElement>('numbers');
const ghost = $<HTMLInputElement>('ghost'), original = $<HTMLDetailsElement>('original');
const sourceImage = $<HTMLImageElement>('source-photo');
const blocks = buildBlocks(data.frames, data.holdFrames);
const keys = new Set(data.frames.map(frameKey));
const poseByKey = new Map(poses.frames.map(row => [row.key,row]));
const params = new URL(location.href).searchParams;
let target = snapYaw(Number(params.get('angle') ?? 10));
if (!Number.isFinite(target)) target = 10;
let selected = Math.max(0,data.frames.findIndex(f => frameKey(f)===params.get('frame')));
let previous: number | undefined, joint: number | null = null;
let galleryRows: number[] = [], page = 0, generation = 0, galleryGeneration = 0;
let feedback: Feedback[] = [], connected = false, saving = false;
let draftClientId: string | undefined;
let playing = false, walk: number[] = [], cursor = 0, playbackEpoch = 0;
const pageSize = 24;
const compressed = new Map<number,Promise<Blob>>();
function blob(index: number) {
  let result = compressed.get(index);
  if (!result) {
    result = fetch(new URL(`./media/angles/${data.atlases[index]}`,import.meta.url)).then(response => {
      if (!response.ok) throw new Error('사진을 불러오지 못했어요.');
      return response.blob();
    }).catch(error => { compressed.delete(index); throw error; });
    compressed.set(index,result);
  }
  return result;
}
const images = new AtlasPool(async index => createImageBitmap(await blob(index)),6);
const signed = (value: number, digits = 0) => `${value>0?'+':value<0?'−':''}${Math.abs(value).toFixed(digits)}°`;
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '') {
  const node = document.createElement(tag); node.textContent = text; return node;
}
for (let yaw=-90;yaw<=90;yaw+=5) angleInput.add(new Option(signed(yaw),String(yaw)));
angleInput.value = String(target);
for (const [key,name] of Object.entries(categories)) category.add(new Option(name,key));
poses.names.forEach((name,index) => jointInput.add(new Option(`${index} ${name}`,String(index))));

function candidates() { return directionCandidates(blocks,target); }
function eligibleIndices() {
  return new Set(candidates().flatMap(b => Array.from({length:data.holdFrames},(_,i) => b.start+i)));
}
function hasFeedback(index: number) {
  return frameAudits(data.frames[index]).length>0 || feedback.some(row => row.frameKey===frameKey(data.frames[index]));
}
function updateCoverage() {
  const indices = eligibleIndices();
  const outfits = new Set([...indices].map(i => data.frames[i].look));
  $('coverage').textContent = `실제 재생 ${indices.size}장 · ${outfits.size}착장 / 목록 ${galleryRows.length}장`;
}
function updateRows(keep = false) {
  const query = search.value.trim().toLowerCase();
  galleryRows = data.frames.flatMap((frame,index) => {
    const included = scopeInput.value==='all' || (scopeInput.value==='feedback' ? hasFeedback(index) : Math.abs(frame.yaw-target)<=5);
    return included && (!query || `${frame.clip} ${frameKey(frame)}`.toLowerCase().includes(query)) ? [index] : [];
  });
  if (!keep) page = Math.max(0,Math.floor(galleryRows.indexOf(selected)/pageSize));
  page = Math.min(page,Math.max(0,Math.ceil(galleryRows.length/pageSize)-1));
  updateCoverage(); void renderGallery(); updatePosition();
}
function updatePosition() {
  $('position').textContent = walk.length ? `연결 ${cursor+1} / ${walk.length}` : `${Math.max(0,galleryRows.indexOf(selected)+1)} / ${galleryRows.length}`;
  $('previous').setAttribute('aria-label',walk.length?'이전 연결 프레임':'이전 사진');
  $('next').setAttribute('aria-label',walk.length?'다음 연결 프레임':'다음 사진');
}
function retain() {
  images.retain([selected, ...(ghost.checked && previous!==undefined ? [previous] : []), ...walk.slice(cursor,cursor+12)].map(i => data.frames[i].atlas));
}
function drawTile(image: ImageBitmap, index: number, ctx: CanvasRenderingContext2D, width = 512, height = 768) {
  const frame = data.frames[index];
  ctx.drawImage(image, frame.tile%data.columns*512, Math.floor(frame.tile/data.columns)*768,512,768,0,0,width,height);
}
async function renderPhoto(index: number) {
  const epoch = ++generation;
  if (index!==selected) { previous=selected; selected=index; }
  $('stage').setAttribute('aria-busy','true');
  for (const input of [category,note,suggestion,jointInput]) input.disabled=true;
  $<HTMLButtonElement>('save').disabled=true;
  $('loading-photo').hidden = false;
  $('loading-photo').textContent = '사진 로딩 중';
  retain();
  try {
    const image = await images.load(data.frames[index].atlas);
    const prior = ghost.checked && previous!==undefined ? await images.load(data.frames[previous].atlas) : undefined;
    if (epoch!==generation) return;
    context.clearRect(0,0,512,768);
    if (prior && previous!==undefined) { context.globalAlpha=.28; drawTile(prior,previous,context); context.globalAlpha=1; }
    drawTile(image,index,context);
    const row = data.frames[index];
    canvas.dataset.frameKey = frameKey(row); canvas.dataset.actualYaw=String(row.yaw); canvas.dataset.target=String(target);
    canvas.dataset.joints = String(poseByKey.get(frameKey(row))?.points.length ?? 0);
    $('loading-photo').hidden = true;
    $('stage').setAttribute('aria-busy','false');
    renderMetadata(); renderPose(); renderReviews(); restoreDraft(); updatePosition(); updateURL();
    for (const input of [category,note,suggestion,jointInput]) input.disabled=false;
    $<HTMLButtonElement>('save').disabled=saving;
    if (original.open) loadOriginal();
    document.querySelectorAll<HTMLButtonElement>('.thumb').forEach(button => button.setAttribute('aria-pressed',String(Number(button.dataset.index)===selected)));
  } catch (error) {
    if (epoch!==generation) return;
    pause(); $('loading-photo').textContent = error instanceof Error ? `${error.message} 다른 사진을 선택하거나 새로고침해 주세요.` : '사진 오류';
  }
}
function renderMetadata() {
  const frame = data.frames[selected], used = eligibleIndices().has(selected);
  $('actual-angle').textContent = signed(frame.yaw,1);
  const state = $('photo-state');
  state.textContent = `사진 ${signed(frame.yaw,1)} · 재생 ${signed(target)} · ${heldForTarget(frame,target)?'보류':used?'후보':'미사용'}`;
  state.className = heldForTarget(frame,target)?'held':'';
  const metadata = $('metadata'); metadata.replaceChildren();
  const values = { '사진 ID':frameKey(frame), '착장':frame.clip, '재생 각도':signed(target), '각도 차이':`${Math.abs(frame.yaw-target).toFixed(1)}°`, '보행 위상':frame.phase.toFixed(3), '관절':joint===null?'선택 안 함':`${joint} ${poses.names[joint]}`, '이전 사진':previous===undefined?'—':frameKey(data.frames[previous]) };
  Object.entries(values).forEach(([key,value]) => metadata.append(element('dt',key),element('dd',value)));
  $('feedback-photo').textContent = `저장 대상: ${frameKey(frame)} · ${signed(target)}`;
  const source = data.sources.find(s => s.id===frame.source)!;
  const link = new URL(source.url); link.searchParams.set('t',String(Math.floor(source.sourceOffset+frame.sourceFrame/data.fps)));
  $<HTMLAnchorElement>('source-link').href = link.href;
}
function svgNode(tag: string, attributes: Record<string,string|number>) {
  const node = document.createElementNS('http://www.w3.org/2000/svg',tag);
  Object.entries(attributes).forEach(([key,value]) => node.setAttribute(key,String(value)));
  return node;
}
function skeletonNodes(svg: HTMLElement | SVGElement, points: number[][], width: number, height: number, interactive: boolean) {
  svg.replaceChildren();
  if (!skeleton.checked) return;
  for (const [a,b] of poses.connections) {
    const confidence = Math.min(points[a][2],points[b][2]);
    svg.append(svgNode('line',{ x1:points[a][0]*width,y1:points[a][1]*height,x2:points[b][0]*width,y2:points[b][1]*height,
      stroke:confidence<.5?'#ffb86c':a%2?'#6ef0cf':'#79beff','stroke-width':interactive?2:4,'stroke-opacity':confidence<.5?.45:.9,'stroke-dasharray':confidence<.5?'5 5':'none' }));
  }
  points.forEach(([x,y,confidence],index) => {
    const circle = svgNode('circle',{cx:x*width,cy:y*height,r:index===joint?7:interactive?3.5:6,fill:index===joint?'#fff59c':confidence<.5?'#ffb86c':index%2?'#6ef0cf':'#79beff',stroke:'#14222b','stroke-width':1,'fill-opacity':confidence<.5?.55:1});
    const title = svgNode('title',{}); title.textContent=`${index} ${poses.names[index]} · 신뢰도 ${Math.round(confidence*100)}%`; circle.append(title);
    if (interactive) circle.addEventListener('click',() => { pause(); joint=index; jointInput.value=String(index); storeDraft(); renderPose(); renderMetadata(); });
    svg.append(circle);
    if (interactive && (numbers.checked || index===joint)) {
      const text = svgNode('text',{x:x*width+6,y:y*height-5}); text.textContent=String(index); svg.append(text);
    }
  });
}
function renderPose() {
  const pose = poseByKey.get(frameKey(data.frames[selected]))!;
  skeletonNodes($('pose'),pose.points,512,768,true);
  const table = $('joint-table'); table.replaceChildren();
  pose.points.forEach(([x,y,v],index) => {
    const tr = element('tr'); tr.className=index===joint?'selected':'';
    [`${index} ${poses.names[index]}`,(x*512).toFixed(1),(y*768).toFixed(1),`${(v*100).toFixed(0)}%`].forEach(value => tr.append(element('td',value)));
    table.append(tr);
  });
  const [scale,tx,ty] = pose.transform;
  const points = pose.points.map(([x,y,v]) => [((x*512-tx)/scale+pose.roi[0])/1920,((y*768-ty)/scale+pose.roi[1])/1080,v]);
  skeletonNodes($('source-pose'),points,1920,1080,false);
}
function loadOriginal() {
  const key = frameKey(data.frames[selected]);
  if (sourceImage.dataset.frameKey===key) return;
  $('source-state').textContent = '원본 프레임 로딩 중…';
  sourceImage.hidden=true; $('source-pose').style.visibility='hidden';
  sourceImage.dataset.frameKey=key;
  sourceImage.onload=() => { if (sourceImage.dataset.frameKey===key) { sourceImage.hidden=false; $('source-pose').style.visibility='visible'; $('source-state').textContent=`원본 ${key} · 같은 관절을 원본 위치에 표시`; } };
  sourceImage.onerror=() => { $('source-state').textContent='원본 파일을 불러오지 못했어요. 아래 영상 링크로 확인해 주세요.'; };
  sourceImage.src=`/api/runway-walk/source?frame=${encodeURIComponent(key)}`;
}
function draftKey() { return `runway-review-draft:${frameKey(data.frames[selected])}:${target}`; }
function storeDraft(resetIdentity = true) {
  if (resetIdentity) draftClientId=undefined;
  try { localStorage.setItem(draftKey(),JSON.stringify({category:category.value,note:note.value,suggestedYaw:suggestion.value,joint:jointInput.value,clientId:draftClientId})); } catch { /* Input remains in the form. */ }
}
function restoreDraft() {
  let draft: Record<string,string> = {};
  try { const stored=JSON.parse(localStorage.getItem(draftKey()) ?? '{}'); if (stored && typeof stored==='object') draft=stored; } catch { /* Optional draft. */ }
  draftClientId=draft.clientId;
  category.value=draft.category ?? 'angle'; note.value=draft.note ?? ''; suggestion.value=draft.suggestedYaw ?? ''; jointInput.value=draft.joint ?? '';
  joint=jointInput.value===''?null:Number(jointInput.value);
  $('save-state').textContent='';
  renderPose(); renderMetadata();
}
function renderReviews() {
  const list=$('review-list'); list.replaceChildren();
  for (const audit of frameAudits(data.frames[selected])) {
    const article=element('article'); article.className='review';
    article.append(element('b',`Codex · ${categories[audit.category as keyof typeof categories]} · 재생 보류 ${audit.targets.map(t=>signed(t)).join(' / ')}`),element('span',audit.note),element('time',`${audit.reviewedAt} · 검토 범위 #${audit.fromFrame}–${audit.toFrame}`)); list.append(article);
  }
  for (const row of feedback.filter(row=>row.frameKey===frameKey(data.frames[selected]))) {
    const article=element('article'); article.className='review user';
    article.append(element('b',`사용자 · ${categories[row.category]} · 재생 ${signed(row.target)}`),element('span',row.note || categories[row.category]));
    if (row.suggestedYaw!==null) article.append(element('p',`각도 제안 ${signed(row.suggestedYaw)}`));
    if (row.joint!==null) article.append(element('p',`관련 관절 ${row.joint} ${poses.names[row.joint]}`));
    if (row.comparedTo) article.append(element('p',`이전 사진 ${row.comparedTo}`));
    article.append(element('time',new Date(row.createdAt).toLocaleString('ko-KR'))); list.append(article);
  }
  if (!list.children.length) { const empty=element('p','아직 개별 의견이 없어요. 검토 완료를 뜻하지는 않습니다.'); empty.className='empty'; list.append(empty); }
}
async function refreshFeedback() {
  try {
    const response=await fetch('/api/runway-walk/feedback',{cache:'no-store'});
    if (!response.ok) throw new Error('Unavailable');
    const rows = await response.json();
    const changed = JSON.stringify(feedback)!==JSON.stringify(rows.records);
    feedback=rows.records; connected=true; $('connection').textContent='공유 의견 연결됨';
    if (changed) { renderReviews(); updateRows(true); }
  } catch { connected=false; $('connection').textContent='의견 서버 연결 안 됨 · 입력은 임시 보관'; }
}
async function renderGallery() {
  const epoch=++galleryGeneration, root=$('gallery'); root.replaceChildren();
  const rows=galleryRows.slice(page*pageSize,(page+1)*pageSize);
  const canvases = new Map<number,HTMLCanvasElement>();
  for (const index of rows) {
    const frame=data.frames[index], button=element('button'); button.type='button'; button.className='thumb'; button.dataset.index=String(index); button.setAttribute('aria-pressed',String(index===selected)); button.setAttribute('aria-label',`${frameKey(frame)}, ${signed(frame.yaw,1)}, ${frame.clip}`);
    const thumb=element('canvas'); thumb.width=128; thumb.height=192; canvases.set(index,thumb);
    button.append(thumb,element('span',`${signed(frame.yaw,1)} · #${frame.sourceFrame}\n${frame.clip}`));
    if (hasFeedback(index)) button.append(element('i'));
    if (heldForTarget(frame,target)) button.append(element('em','재생 보류'));
    button.addEventListener('click',() => { pause(); walk=[]; void renderPhoto(index); }); root.append(button);
  }
  $('page-label').textContent=`${galleryRows.length? page+1:0} / ${Math.ceil(galleryRows.length/pageSize)}`;
  $<HTMLButtonElement>('page-previous').disabled=page===0;
  $<HTMLButtonElement>('page-next').disabled=(page+1)*pageSize>=galleryRows.length;
  if (!rows.length) root.append(element('p','조건에 맞는 사진이 없어요.'));
  const pages=[...new Set(rows.map(i=>data.frames[i].atlas))]; let next=0;
  await Promise.all([0,1].map(async () => {
    while (next<pages.length && epoch===galleryGeneration) {
      const atlas=pages[next++]; let image:ImageBitmap|undefined;
      try {
        image=await createImageBitmap(await blob(atlas));
        if (epoch!==galleryGeneration) return;
        for (const index of rows.filter(i=>data.frames[i].atlas===atlas)) drawTile(image,index,canvases.get(index)!.getContext('2d')!,128,192);
      } catch { if (epoch===galleryGeneration) $('connection').textContent='일부 목록 사진 로딩 실패 · 묶음을 다시 열어 주세요'; }
      finally { image?.close(); }
    }
  }));
}
function updateURL() {
  const url=new URL(location.href); url.search=''; url.searchParams.set('angle',String(target)); url.searchParams.set('frame',frameKey(data.frames[selected]));
  history.replaceState(null,'',url); $<HTMLInputElement>('share-url').value=url.href;
}
function pause() { playing=false; playbackEpoch++; $('play').textContent='연결 재생'; $('play').setAttribute('aria-pressed','false'); }
function makeWalk() {
  const eligible=candidates(); let last=data.frames[selected], phase=(last.phase+1/30)%1;
  let recent=[last.look]; walk=[selected]; cursor=0;
  for (let i=0;i<120;i++) {
    const block=chooseCandidate(eligible,target,phase,recent,last.gait,last.gaitVelocity);
    walk.push(...Array.from({length:data.holdFrames},(_,offset)=>block.start+offset));
    recent=[block.look ?? block.clip,...recent].slice(0,4); last=data.frames[block.start+data.holdFrames-1]; phase=(last.phase+1/30)%1;
  }
}
async function play() {
  if (playing) { pause(); return; }
  original.open=false;
  if (!walk.length || cursor>=walk.length-1) makeWalk();
  playing=true; const epoch=++playbackEpoch;
  $('play').textContent='정지'; $('play').setAttribute('aria-pressed','true');
  while (playing && epoch===playbackEpoch && cursor<walk.length-1) {
    const start=performance.now();
    cursor++; retain();
    await renderPhoto(walk[cursor]);
    if (epoch!==playbackEpoch) return;
    for (const index of walk.slice(cursor+1,cursor+10)) void images.load(data.frames[index].atlas).catch(()=>{});
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,1000/data.fps/Number($<HTMLSelectElement>('speed').value)-(performance.now()-start))));
  }
  if (epoch===playbackEpoch) pause();
}
function step(delta: number) {
  pause();
  if (walk.length) { cursor=Math.max(0,Math.min(walk.length-1,cursor+delta)); void renderPhoto(walk[cursor]); }
  else { const index=galleryRows.indexOf(selected); const next=galleryRows[Math.max(0,Math.min(galleryRows.length-1,index+delta))]; if (next!==undefined) { void renderPhoto(next); const nextPage=Math.floor(galleryRows.indexOf(next)/pageSize); if (nextPage!==page) { page=nextPage; void renderGallery(); } } }
}
function changeTarget(value: number) {
  pause(); walk=[]; target=snapYaw(value); angleInput.value=String(target); scopeInput.value='angle'; search.value='';
  const candidate=candidates()[0]; if (candidate) void renderPhoto(candidate.start);
  updateRows();
}
angleInput.addEventListener('change',()=>changeTarget(Number(angleInput.value)));
$('angle-minus').addEventListener('click',()=>changeTarget(target-5)); $('angle-plus').addEventListener('click',()=>changeTarget(target+5));
scopeInput.addEventListener('change',()=>{ pause(); walk=[]; updateRows(); }); search.addEventListener('input',()=>{ pause(); walk=[]; updateRows(); });
$('page-previous').addEventListener('click',()=>{ page--; void renderGallery(); }); $('page-next').addEventListener('click',()=>{ page++; void renderGallery(); });
$('previous').addEventListener('click',()=>step(-1)); $('next').addEventListener('click',()=>step(1)); $('play').addEventListener('click',()=>void play());
skeleton.addEventListener('change',renderPose); numbers.addEventListener('change',renderPose); ghost.addEventListener('change',()=>void renderPhoto(selected));
$('background').addEventListener('change',()=>{ $('stage').dataset.background=$<HTMLSelectElement>('background').value; });
original.addEventListener('toggle',()=>{ if (original.open) { pause(); loadOriginal(); } });
jointInput.addEventListener('change',()=>{ joint=jointInput.value===''?null:Number(jointInput.value); renderPose(); renderMetadata(); });
for (const input of [category,note,suggestion,jointInput]) { input.addEventListener('focus',pause); input.addEventListener('input',()=>storeDraft()); }
document.addEventListener('keydown',event=> {
  if ((event.target as HTMLElement).matches('input,textarea,select,button,summary')) return;
  if (event.code==='Space') { event.preventDefault(); void play(); }
  if (event.code==='ArrowLeft' || event.code==='ArrowRight') { event.preventDefault(); step(event.code==='ArrowLeft'?-1:1); }
});
$('feedback-form').addEventListener('submit',async event=> {
  event.preventDefault(); pause(); if (saving || $('stage').getAttribute('aria-busy')==='true') return;
  const state=$('save-state'); state.className='';
  try {
    draftClientId ??= `review-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const draft=validateFeedback({ clientId:draftClientId,frameKey:frameKey(data.frames[selected]),target,category:category.value,note:note.value,suggestedYaw:suggestion.value===''?null:Number(suggestion.value),joint:jointInput.value===''?null:Number(jointInput.value),comparedTo:previous===undefined?null:frameKey(data.frames[previous]),assetVersion:data.assetVersion },keys);
    storeDraft(false);
    saving=true; $<HTMLButtonElement>('save').disabled=true; state.textContent='서버에 저장 중…';
    const response=await fetch('/api/runway-walk/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)}).catch(()=> { throw new Error('연결이 끊겼어요. 초안은 이 기기에 보관했으니 연결 후 다시 저장해 주세요.'); });
    if (!response.ok) throw new Error('서버 저장 실패. 입력은 이 기기에 임시 보관했어요. 연결 후 다시 저장해 주세요.');
    const saved=await response.json();
    await refreshFeedback();
    if (!connected || !feedback.some(row=>row.id===saved.id)) throw new Error('저장 확인에 실패했어요. 입력을 유지합니다.');
    try {
      const key=`runway-review-draft:${draft.frameKey}:${draft.target}`;
      if (JSON.parse(localStorage.getItem(key) ?? '{}')?.clientId===draft.clientId) localStorage.removeItem(key);
    } catch { /* Server readback already confirmed the save. */ }
    if (frameKey(data.frames[selected])===draft.frameKey && target===draft.target && draftClientId===draft.clientId) { note.value=''; draftClientId=undefined; state.textContent=`저장 확인됨 · ${draft.frameKey}`; }
  } catch(error) { state.className='error'; state.textContent=error instanceof Error?error.message:'저장 실패'; }
  finally { saving=false; $<HTMLButtonElement>('save').disabled=$('stage').getAttribute('aria-busy')==='true'; }
});
$('copy').addEventListener('click',async()=> {
  const input=$<HTMLInputElement>('share-url'); input.select();
  try { if (navigator.clipboard) await navigator.clipboard.writeText(input.value); else if (!document.execCommand('copy')) throw new Error(); $('copy').textContent='복사됨'; }
  catch { $('copy').textContent='위 링크를 선택해 복사'; }
});
$('export').addEventListener('click',async()=> {
  await refreshFeedback();
  const url=URL.createObjectURL(new Blob([JSON.stringify({assetVersion:data.assetVersion,assistant:audits,user:feedback},null,2)],{type:'application/json'}));
  const link=element('a'); link.href=url; link.download='runway-frame-feedback.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('focus',()=>void refreshFeedback());
setInterval(()=>{ if (!document.hidden && !saving) void refreshFeedback(); },5000);
if (!params.has('frame')) selected=candidates()[0]?.start ?? 0;
if (Math.abs(data.frames[selected].yaw-target)>5) scopeInput.value='all';
updateRows(); void renderPhoto(selected); void refreshFeedback();
