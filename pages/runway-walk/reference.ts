import * as THREE from 'three';
import data from './angles.json';
import poses from './debug-poses.json';
import referenceMatches from './reference-matches.json';
import { WalkSequencer as PreviousSequencer, createWalkState } from './walk-sequencer';
import { ReferenceSequencer, type ReferenceCut } from './reference-sequencer';
import { referencePose, REFERENCE_HEIGHT } from './gait-reference';
import { AtlasPool } from './atlas-pool';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const angle = $<HTMLSelectElement>('angle'), phase = $<HTMLInputElement>('phase'), playButton = $<HTMLButtonElement>('play');
const sourcePoses = new Map(poses.frames.map(row => [row.key, row.points]));
const oldPlanner = new PreviousSequencer(data.frames), planner = new ReferenceSequencer(data.frames);
let yaw = Number(new URL(location.href).searchParams.get('angle') ?? 10);
if (!Number.isFinite(yaw))
    yaw = 10;
yaw = Math.max(-90, Math.min(90, Math.round(yaw / 5) * 5));
for (let value = -90; value <= 90; value += 5)
    angle.add(new Option(`${value > 0 ? '+' : ''}${value}°`, String(value)));
angle.value = String(yaw);
type Photo = {
    index: number;
    cut?: ReferenceCut;
    swapped: boolean;
    halfCycle: boolean;
};
let requestedTick = Math.max(0, Math.floor(Number(new URL(location.href).searchParams.get('tick') ?? 0))) || 0;
let oldPath: Photo[] = [], newPath: Photo[] = [], tick = 0, playing = false, epoch = 0, drawing = 0, transport = 0;
const blobs = new Map<number, Promise<Blob>>();
function blob(index: number) { let pending = blobs.get(index); if (!pending) {
    pending = fetch(new URL(`./media/angles/${data.atlases[index]}`, import.meta.url)).then(r => { if (!r.ok)
        throw Error('사진 로딩 실패'); return r.blob(); });
    blobs.set(index, pending);
} return pending; }
const images = new AtlasPool(async (index) => createImageBitmap(await blob(index)), 12);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(512, 768, false);
$('model').append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#adb6ba');
const scale = 660 / REFERENCE_HEIGHT, viewHeight = 768 / scale, viewWidth = 512 / scale, center = (720 - 384) / scale;
const camera = new THREE.OrthographicCamera(-viewWidth / 2, viewWidth / 2, viewHeight / 2, -viewHeight / 2, .1, 20);
camera.position.set(0, center, 5);
camera.lookAt(0, center, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x485767, 2));
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(2, 4, 3);
scene.add(light);
const grey = new THREE.MeshStandardMaterial({ color: 0xd8e0e2, roughness: .8 }), left = new THREE.MeshStandardMaterial({ color: 0x34baff }), right = new THREE.MeshStandardMaterial({ color: 0xff9252 });
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12), sphere = new THREE.SphereGeometry(1, 16, 12), up = new THREE.Vector3(0, 1, 0);
const boneRows = [[11, 13, .038, grey], [13, 15, .032, grey], [12, 14, .038, grey], [14, 16, .032, grey], [23, 25, .066, grey], [25, 27, .047, grey], [24, 26, .066, grey], [26, 28, .047, grey], [29, 31, .033, left], [30, 32, .033, right]] as const;
const bones = boneRows.map(() => { const mesh = new THREE.Mesh(cylinder, grey); scene.add(mesh); return mesh; });
const neck = new THREE.Mesh(cylinder, grey);
neck.position.set(0, 1.46, 0);
neck.scale.set(.045, .18, .045);
scene.add(neck);
const nose = new THREE.Mesh(sphere, grey);
nose.scale.set(.027, .027, .045);
scene.add(nose);
const torso = new THREE.Mesh(sphere, grey);
scene.add(torso);
const head = new THREE.Mesh(sphere, grey);
scene.add(head);
const markers = [27, 28, 29, 30, 31, 32].map((joint, i) => { const mesh = new THREE.Mesh(sphere, i % 2 ? right : left); scene.add(mesh); return { joint, mesh }; });
const floor = new THREE.GridHelper(2, 10, 0x66787f, 0x98a5aa);
floor.position.y = -.006;
scene.add(floor);
function model() {
    const pose = referencePose(tick / 30, yaw), points = pose.points;
    boneRows.forEach(([a, b, r, material], i) => { const av = new THREE.Vector3(...points[a]), bv = new THREE.Vector3(...points[b]), d = bv.clone().sub(av); bones[i].material = material; bones[i].position.copy(av).add(bv).multiplyScalar(.5); bones[i].quaternion.setFromUnitVectors(up, d.clone().normalize()); bones[i].scale.set(r, d.length(), r); });
    torso.position.set((points[23][0] + points[24][0]) / 2, 1.12, 0);
    torso.scale.set(.18, .27, .12);
    torso.rotation.y = yaw * Math.PI / 180;
    head.position.set((points[7][0] + points[8][0]) / 2, 1.61, (points[7][2] + points[8][2]) / 2);
    head.scale.set(.105, .14, .105);
    nose.position.set(...points[0]);
    neck.position.x = (points[7][0] + points[8][0]) / 2;
    markers.forEach(({ joint, mesh }) => { mesh.position.set(...points[joint]); mesh.scale.setScalar(joint < 29 ? .025 : .022); });
    renderer.render(scene, camera);
    const straight = referencePose(tick / 30);
    const leading = straight.points[27][2] > straight.points[28][2] ? '왼발 L' : '오른발 R';
    $('support').textContent = `앞발: ${leading} · 지지발: ${pose.leftSupport && pose.rightSupport ? '양발' : pose.leftSupport ? '왼발 L' : '오른발 R'}`;
}
function skeleton(id: string, index: number) {
    const svg = $(id);
    svg.replaceChildren();
    if (!$<HTMLInputElement>('joints').checked)
        return;
    const frame = data.frames[index], p = sourcePoses.get(`${frame.source}:${frame.sourceFrame}`)!;
    for (const [ids, color, label] of [[[23, 25, 27, 29, 31], '#32c0ff', 'L'], [[24, 26, 28, 30, 32], '#ff995b', 'R']] as const) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        path.setAttribute('points', ids.map(j => `${p[j][0] * 512},${p[j][1] * 768}`).join(' '));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '3');
        const uncertain=referenceMatches.frames[index].uncertain||ids.some(j=>p[j][2]<.5);
        if(uncertain){path.setAttribute('stroke-dasharray','7 5');path.setAttribute('stroke-opacity','.6');}
        svg.append(path);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(p[ids[2]][0] * 512 + 8));
        text.setAttribute('y', String(p[ids[2]][1] * 768 - 8));
        text.setAttribute('fill', color);
        text.setAttribute('font-size', '24');
        text.setAttribute('font-weight', '800');
        text.textContent = label+(uncertain?'?':'');
        svg.append(text);
    }
}
function retain() { images.retain([...oldPath.slice(tick, tick + 7), ...newPath.slice(tick, tick + 7)].map(row => data.frames[row.index].atlas)); }
async function draw() {
    const current = epoch, render = ++drawing, frameTick = tick;
    model();
    phase.value = String(tick % 30);
    $('phase-value').textContent = `${tick % 30} / 30`;
    const rows = [oldPath[tick], newPath[tick]];
    retain();
    await Promise.all(rows.map(async (row, i) => {
        if (!row)
            return;
        const frame = data.frames[row.index], image = await images.load(frame.atlas);
        if (current !== epoch || render !== drawing || frameTick !== tick)
            return;
        const id = i ? 'new' : 'old', canvas = $<HTMLCanvasElement>(id), ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, 512, 768);
        ctx.drawImage(image, frame.tile % 2 * 512, Math.floor(frame.tile / 2) * 768, 512, 768, 0, 0, 512, 768);
        skeleton(`${id}-pose`, row.index);
        canvas.dataset.frame = `${frame.source}:${frame.sourceFrame}`;
        canvas.dataset.tick = String(tick);
        canvas.dataset.swapped = String(row.swapped);
        const error = i ? planner.inspect(row.index, tick, yaw) : undefined;
        $(`${id}-info`).textContent = `${frame.source}:${frame.sourceFrame} · 사진 ${frame.yaw.toFixed(1)}°\n${i ? `3D 오차 ${error!.direct.toFixed(3)} · 좌우 대응 고정` : `이전 발 대응: ${row.swapped ? '교환' : '원래'} · 반주기 ${row.halfCycle ? '변경' : '유지'}`}`;
        const link = $<HTMLAnchorElement>(`${id}-link`);
        const params = new URLSearchParams({ angle: String(yaw), frame: `${frame.source}:${frame.sourceFrame}` });
        const previous = (i ? newPath : oldPath)[tick - 1];
        if (previous) {
            const f = data.frames[previous.index];
            params.set('previous', `${f.source}:${f.sourceFrame}`);
        }
        link.href = `./debug.html?${params}`;
    }));
    if (!playing)
        shareState();
    for (const row of [...oldPath.slice(tick + 1, tick + 7), ...newPath.slice(tick + 1, tick + 7)])
        void images.load(data.frames[row.index].atlas).catch(() => { });
}
function shareState() { const url = new URL(location.href); url.searchParams.set('angle', String(yaw)); url.searchParams.set('tick', String(tick)); history.replaceState(null, '', url); }
function pause() { transport++; playing = false; playButton.textContent = '재생'; if (newPath.length)
    shareState(); }
async function prepare() {
    pause();
    epoch++;
    const current = epoch;
    tick = 0;
    oldPath = [];
    newPath = [];
    $('state').textContent = '사진 준비 중…';
    playButton.disabled = true;
    let a = createWalkState(), b = createWalkState();
    try {
        for (let i = 0; i < 120; i++) {
            const old = oldPlanner.plan(yaw, a);
            for (let j = 0; j < 3; j++)
                oldPath.push({ index: old.start + j, swapped: old.swapped, halfCycle: old.halfCycle });
            a = old.after;
            const next = planner.plan(yaw, b);
            for (let j = 0; j < next.count; j++)
                newPath.push({ index: next.start + j, cut: next, swapped: false, halfCycle: false });
            b = next.after;
        }
        const pages = [...new Set([...oldPath, ...newPath].map(row => data.frames[row.index].atlas))];
        let index = 0;
        await Promise.all(Array.from({ length: 6 }, async () => { while (index < pages.length)
            await blob(pages[index++]); }));
        if (current !== epoch)
            return;
        tick = Math.min(requestedTick, Math.min(oldPath.length, newPath.length) - 1);
        requestedTick = 0;
        await draw();
        $('state').textContent = `${Math.min(oldPath.length, newPath.length)}프레임 준비됨 · 같은 3D 보행 시점으로 비교합니다.`;
        playButton.disabled = false;
    }
    catch (error) {
        $('state').textContent = error instanceof Error ? error.message : '준비 실패';
        $('state').className = 'warning';
    }
    const url = new URL(location.href);
    url.searchParams.set('angle', String(yaw));
    history.replaceState(null, '', url);
}
async function play() {
    if (playing) { pause(); return; }
    const length = Math.min(oldPath.length, newPath.length);
    if (!length) return;
    if (tick >= length - 1) { tick = 0; await draw(); }
    playing = true;
    playButton.textContent = '정지';
    const current = epoch, run = ++transport;
    // A paused/resumed loop cannot wake up alongside its replacement. The
    // finite comparison ends rather than rewinding to an unrelated first cut.
    while (playing && current === epoch && run === transport && tick + 1 < length) {
        const start = performance.now();
        tick++;
        await draw();
        await new Promise(resolve => setTimeout(resolve, Math.max(0, 1000 / 25 / Number($<HTMLSelectElement>('speed').value) - (performance.now() - start))));
    }
    if (current === epoch && run === transport) pause();
}
angle.addEventListener('change', () => { yaw = Number(angle.value); void prepare(); });
playButton.addEventListener('click', () => void play());
$('previous').addEventListener('click', () => { pause(); tick = Math.max(0, tick - 1); void draw(); });
$('next').addEventListener('click', () => { pause(); tick = Math.min(Math.min(oldPath.length, newPath.length) - 1, tick + 1); void draw(); });
phase.addEventListener('input', () => { pause(); tick = Number(phase.value); void draw(); });
$('joints').addEventListener('change', () => void draw());
$('scan').addEventListener('click', async () => {
    pause();
    const button = $<HTMLButtonElement>('scan');
    button.disabled = true;
    $('scan-results').replaceChildren();
    let switches = 0, wrong = 0, completed = 0;
    for (let direction = -90; direction <= 90; direction += 5) {
        let old = createWalkState(), next = createWalkState(), cuts = 0;
        try {
            for (; cuts < 120; cuts++) {
                const a = oldPlanner.plan(direction, old), b = planner.plan(direction, next);
                if (old.last && old.last.swapped !== a.swapped)
                    switches++;
                for (let i = 0; i < b.count; i++)
                    if (planner.inspect(b.start + i, next.tick + i, direction).oppositeFits)
                        wrong++;
                old = a.after;
                next = b.after;
            }
            completed++;
        }
        catch { /* Incomplete directions stay visible. */ }
        const link = document.createElement('a');
        link.href = `?angle=${direction}`;
        link.textContent = `${direction > 0 ? '+' : ''}${direction}° · ${cuts}/120구간`;
        if (cuts < 120)
            link.className = 'warning';
        $('scan-results').append(link);
        $('scan-state').textContent = `${(direction + 90) / 5 + 1}/37 방향 검사 중`;
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    $('scan-state').textContent = `${completed}/37 방향 완료 · 이전 발 대응 변경 ${switches}건 · 3D에서 반대 발이 더 잘 맞는 선택 ${wrong}건. 실제 관절 추정과 보행 품질의 최종 판단은 사진으로 확인하세요.`;
    button.disabled = false;
});
void prepare();
