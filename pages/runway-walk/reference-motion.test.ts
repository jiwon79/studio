import {expect,test} from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import motion from './reference-motion.json';
import fits from './reference-matches.json';
import {referencePose,REFERENCE_VERSION} from './gait-reference';
import {CYCLE_FRAMES,MIN_REUSE_FRAMES,clockPhase} from './reference-clock';
const file=new URL('./media/reference/quaternius-formal-walk.glb',import.meta.url);
test('the reference comes from the downloaded skinned mannequin and an existing walk clip',async()=>{
    const bytes=fs.readFileSync(file);
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(motion.modelHash);
    expect(motion.sourceHash).toBe('69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997');
    expect(fits.referenceModelHash).toBe(motion.modelHash);expect(fits.referenceDuration).toBe(motion.duration);
    expect(motion.license).toBe('CC0-1.0');expect(REFERENCE_VERSION).toBe('quaternius-formal-walk-v1');
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    expect(gltf.animations.map(a=>a.name)).toEqual(['Walk_Formal_Loop']);
    const clip=gltf.animations[0],root=gltf.scene,mixer=new THREE.AnimationMixer(root);mixer.clipAction(clip).play();
    expect(clip.duration).toBeCloseTo(motion.duration,8);let skinned=0;root.traverse(o=>{if(o instanceof THREE.SkinnedMesh)skinned++;});expect(skinned).toBeGreaterThan(0);
    for(const i of [0,13,30,45,60,90,119]){
        mixer.setTime(i/120*clip.duration);root.updateMatrixWorld(true);const actual=referencePose(i/120);
        for(const [joint,name] of Object.entries(motion.boneMap)){
            const p=root.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());p.y-=motion.floor;
            p.toArray().forEach((v,k)=>expect(actual.points[Number(joint)][k]).toBeCloseTo(v,5));
        }
        for(const [joint,name] of [[29,'heel_l'],[30,'heel_r'],[31,'toe_l'],[32,'toe_r']] as const){
            const anchors=motion.soleVertices[name],sum=new THREE.Vector3();
            for(const row of anchors){const mesh=root.getObjectByName(row.mesh) as THREE.SkinnedMesh;sum.add(mesh.localToWorld(mesh.getVertexPosition(row.index,new THREE.Vector3())));}
            sum.multiplyScalar(1/anchors.length);sum.y-=motion.floor;sum.toArray().forEach((v,k)=>expect(actual.points[joint][k]).toBeCloseTo(v,5));
        }
    }
});
test('sampling wraps continuously and turns the imported gait without exchanging legs',()=>{
    const end=referencePose(1-1e-6),start=referencePose(0);
    for(let j=0;j<33;j++)expect(new THREE.Vector3(...end.points[j]).distanceTo(new THREE.Vector3(...start.points[j]))).toBeLessThan(.001);
    const a=referencePose(.25),b=referencePose(.25,90),c=referencePose(.25,-90);
    for(const j of [25,26,27,28,29,30,31,32]){expect(b.points[j][0]).toBeCloseTo(a.points[j][2],6);expect(c.points[j][0]).toBeCloseTo(-a.points[j][2],6);expect(b.points[j][1]).toBe(a.points[j][1]);}
    expect(CYCLE_FRAMES/25).toBeCloseTo(motion.duration,8);expect(clockPhase(CYCLE_FRAMES)).toBeCloseTo(0,8);
});

test('photo reuse uses the nearest sampled gait return without rounding the animation clock',()=>{
 const error=(ticks:number)=>Math.abs(ticks-CYCLE_FRAMES);
 expect(MIN_REUSE_FRAMES).toBe(33);
 expect(error(MIN_REUSE_FRAMES)).toBeLessThan(error(MIN_REUSE_FRAMES-1));
 expect(error(MIN_REUSE_FRAMES)).toBeLessThan(error(MIN_REUSE_FRAMES+1));
 expect(error(MIN_REUSE_FRAMES)).toBeLessThanOrEqual(.5);
 expect(clockPhase(MIN_REUSE_FRAMES)).not.toBe(0);
 // The imported float duration closes within 0.000001 cycle at 300 ticks.
 expect(Math.min(clockPhase(300),1-clockPhase(300))).toBeLessThan(1e-6);
});
