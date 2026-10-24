"""Segment every native frame directly, normalize stature, and export alpha tiles."""
import argparse, hashlib, json
from pathlib import Path
import cv2
import numpy as np
import mediapipe as mp
from PIL import Image
from scipy.ndimage import gaussian_filter1d
from matting import MatteModel

VERSION = 'biref-direct-v8-screen-joints'
TARGET_HEIGHT = 660
GROUND = 720

def selected_component(alpha, pose):
    """Keep the selected body and handheld islands, including detached straps."""
    h,w = alpha.shape
    hip = pose[[23,24],:2].mean(axis=0)*[w,h]
    count,labels,stats,_ = cv2.connectedComponentsWithStats((alpha>.35).astype('uint8'))
    hx,hy = np.clip(np.round(hip).astype(int),[0,0],[w-1,h-1])
    label = labels[hy,hx]
    if not label:
        patch = labels[max(0,hy-8):hy+9,max(0,hx-8):hx+9]
        ids,n = np.unique(patch[patch>0],return_counts=True)
        if not len(ids): raise ValueError('Selected pelvis is absent from the matte')
        label = ids[n.argmax()]
    support = labels==label
    # Clothing, a head or a carried bag can be disconnected by a narrow gap.
    # Require support near actual landmarks, rather than a component's rectangle.
    seeds=np.zeros((h,w),np.uint8)
    for k in [0,2,5,7,8,11,12,13,14,15,16,19,20,23,24,25,26,27,28,29,30,31,32]:
        if pose[k,3]<.5:continue
        px,py=np.round(pose[k,:2]*[w,h]).astype(int)
        cv2.circle(seeds,(px,py),max(6,round(h*(.03 if k in [15,16,19,20] else .012))),1,-1)
    for j in range(1,count):
        if j==label or stats[j,cv2.CC_STAT_AREA]<12: continue
        island=labels==j
        if stats[j,cv2.CC_STAT_AREA]<stats[label,cv2.CC_STAT_AREA]*.4 and np.any(seeds[island]):support |= island
    support=cv2.dilate(support.astype('uint8'),np.ones((5,5),np.uint8))
    return np.clip((alpha-.015)/.97,0,1)*support

def bounds(alpha):
    yy,xx=np.where(alpha>.65)
    if not len(yy): raise ValueError('Empty matte')
    counts=np.bincount(yy,minlength=alpha.shape[0]); rows=np.flatnonzero(counts>=3)
    return float(rows[0]),float(rows[-1]),float(xx.min()),float(xx.max())

def complete_body(alpha,pose):
    """A missed head or visible limb must never become a normalized whole body."""
    h,w=alpha.shape
    for k in [0,25,26,27,28]:
        if pose[k,3]<.65:continue
        x,y=np.round(pose[k,:2]*[w,h]).astype(int);r=max(6,round(h*.018))
        patch=alpha[max(0,y-r):min(h,y+r+1),max(0,x-r):min(w,x+r+1)]
        if not patch.size or np.count_nonzero(patch>.5)<max(3,patch.size*.02):return False
    return True

def remove_wrist_backdrop(alpha,rgb,pose):
    """Reviewed cyan-shirt shot: the neutral runway edge touches a bare hand.

    Only this bag-free shot opts in. Its cyan cloth and brown skin are chromatic;
    its trousers are darker than the neutral backdrop in this small wrist area.
    """
    h,w=alpha.shape;zone=np.zeros((h,w),np.uint8)
    for k in [15,16]:
        if pose[k,3]>.5:cv2.circle(zone,tuple(np.round(pose[k,:2]*[w,h]).astype(int)),round(h*.09),1,-1)
    high=rgb.max(axis=2).astype(np.float32);low=rgb.min(axis=2).astype(np.float32)
    neutral=np.clip((.2-(high-low)/np.maximum(high,1))/.04,0,1)*np.clip((low-80)/15,0,1)
    return alpha*(1-neutral*zone)

def guard_person(alpha,rgb,pose,path,full_body=False,head_envelope=False):
    """Reject attached scenery; full-body support is for reviewed bag-free shots."""
    global head_model
    h,w=alpha.shape
    if path.exists():coarse=np.array(Image.open(path)).astype(np.float32)/255
    else:
        if head_model is None:
            opts=mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(args.cache/'pose.task')),num_poses=3,output_segmentation_masks=True,min_pose_detection_confidence=.45)
            head_model=mp.tasks.vision.PoseLandmarker.create_from_options(opts)
        small=cv2.resize(rgb,(round(w/h*720),720))
        result=head_model.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=small))
        if not result.pose_landmarks:raise ValueError('No person for head support')
        hip=pose[[23,24],:2].mean(axis=0)
        distances=[np.linalg.norm(np.mean([[p.x,p.y] for p in landmarks[23:25]],axis=0)-hip) for landmarks in result.pose_landmarks]
        coarse=cv2.resize(result.segmentation_masks[int(np.argmin(distances))].numpy_view().squeeze(),(w,h))
        Image.fromarray((coarse*255).round().astype('uint8')).save(path)
    support=cv2.dilate((coarse>.45).astype('uint8'),np.ones((7,7),np.uint8)).astype(np.float32)
    support=cv2.GaussianBlur(support,(0,0),.5)
    if full_body:
        # These shots need support around the torso, where spectators overlap.
        # The coarse person mask can truncate hair; keep the direct head matte.
        neck=min(pose[11,1],pose[12,1])*h-h*.03
        body=np.clip((np.arange(h)-neck)/(h*.02),0,1)[:,None]
        head=np.ones((h,w),np.float32)
        if head_envelope:
            # This reviewed hat-free shot crosses spectators' dark heads. Keep
            # the direct matte inside a generous envelope around the face;
            # the coarse semantic mask alone also includes the touching heads.
            xy=pose[:,:2]*[w,h];width=np.linalg.norm(xy[7]-xy[8])
            center=(round((xy[7,0]+xy[8,0])/2),round(xy[0,1]-width*.1))
            head=np.zeros((h,w),np.float32)
            rx,ry=head_envelope
            cv2.ellipse(head,center,(max(10,round(width*rx)),max(15,round(width*ry))),0,0,360,1,-1)
            head=cv2.GaussianBlur(head,(0,0),.8)
        guarded=alpha*np.maximum(support,1-body)
        if head_envelope:
            # End the head restriction at ear/face height. Never fade a coat's
            # shoulders while transitioning from a narrow head to a wider torso.
            release=np.clip((np.arange(h)-xy[[7,8],1].mean())/(h*.02),0,1)[:,None]
            guarded*=np.maximum(head,release)
        return guarded
    shoulder=max(pose[11,1],pose[12,1])*h;transition=h*.025
    body=np.clip((np.arange(h)-shoulder+transition)/transition,0,1)[:,None]
    return alpha*np.maximum(support,body)

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--engine',choices=['onnx','mps'],default='onnx')
args=parser.parse_args()
manifest_path=args.output/'angles.json'; manifest=json.loads(manifest_path.read_text())
catalog={s['id']:s for s in json.loads(Path(__file__).with_name('angle-sources.json').read_text())}
model=MatteModel(args.cache,args.engine);model_hash=model.fingerprint
root=args.cache/'matted-fit';root.mkdir(exist_ok=True)
mask_root=args.cache/'biref-raw-masks';mask_root.mkdir(exist_ok=True)
head_root=args.cache/'head-masks';head_root.mkdir(exist_ok=True)
pose_hash=hashlib.sha256((args.cache/'pose.task').read_bytes()).hexdigest()
media=args.output/'media/angles';media.mkdir(parents=True,exist_ok=True)
head_model=None
cv2.setNumThreads(2)
source_hashes={};all_rows=[]
for clip in manifest['clips']:
    selected=[f for f in manifest['frames'] if f['clip']==clip['id']]
    selected_by_frame={row['sourceFrame']:row for row in selected}
    assert len(selected_by_frame)==len(selected),f'Duplicate source frame in {clip["id"]}; rerun angles.py'
    source=args.cache/catalog[clip['source']]['file']
    if source not in source_hashes:source_hashes[source]=hashlib.sha256(source.read_bytes()).hexdigest()
    fingerprint={'version':VERSION,'source':source_hashes[source],'model':model_hash,'roi':clip['roi'],'frames':[r['sourceFrame'] for r in selected]}
    if clip.get('personGuard'):fingerprint.update(personGuard=clip['personGuard'],personGuardVersion=4)
    if clip.get('excludedFrames'):fingerprint['excludedFrames']=clip['excludedFrames']
    if clip.get('reviewedFrames'):fingerprint['reviewedFrames']=clip['reviewedFrames']
    if clip.get('headEnvelope'):fingerprint['headEnvelope']=clip['headEnvelope']
    if clip.get('neutralWristBackdrop'):fingerprint['neutralWristBackdrop']=True
    folder=root/clip['id'];folder.mkdir(exist_ok=True);key=folder/'input.json';metadata=folder/'registration.json'
    if key.exists() and json.loads(key.read_text())==fingerprint and metadata.exists():
        registered=json.loads(metadata.read_text())
        if all((folder/f'{f}.png').exists() for f in registered):
            all_rows.extend(({**r,**registered[str(r['sourceFrame'])]},folder/f'{r["sourceFrame"]}.png') for r in selected if str(r['sourceFrame']) in registered)
            print(clip['id'],len(registered),'cached',flush=True);continue
    pose_rows=json.loads((args.cache/'angles'/clip['id']/'rows.json').read_text())['rows']
    begin,end=min(r['sourceFrame'] for r in selected),max(r['sourceFrame'] for r in selected)
    poses={r['sourceFrame']:np.array(r['pose']) for r in pose_rows if begin<=r['sourceFrame']<=end}
    cap=cv2.VideoCapture(str(source));assert(cap.get(cv2.CAP_PROP_FRAME_WIDTH),cap.get(cv2.CAP_PROP_FRAME_HEIGHT),cap.get(cv2.CAP_PROP_FPS))==(1920,1080,25)
    factor=catalog[clip['source']]['roiScale'];x,y,w,h=[round(v*factor) for v in clip['roi']]
    first,last=min(poses),max(poses); cap.set(cv2.CAP_PROP_POS_FRAMES,first)
    originals={}
    for frame in range(first,last+1):
        ok,original=cap.read()
        if not ok:raise RuntimeError(f'Cannot read {source}:{frame}')
        crop=cv2.cvtColor(original[y:y+h,x:x+w],cv2.COLOR_BGR2RGB)
        originals[frame]=crop
    cap.release()
    decoded=[];rejected=[]
    for row in selected:
        frame=row['sourceFrame'];pose=poses[frame]
        if clip.get('reviewedFrames') and frame not in clip['reviewedFrames']:rejected.append(frame);continue
        if frame in clip.get('excludedFrames',[]):rejected.append(frame);continue
        mask_key=hashlib.sha256((source_hashes[source]+model_hash+str((x,y,w,h,frame))).encode()).hexdigest()[:20]
        path=mask_root/f'{mask_key}.png'
        if path.exists():mask=np.array(Image.open(path)).astype(np.float32)/65535
        else:
            mask=model.infer(originals[frame])
            Image.fromarray((mask*65535).round().astype('uint16')).save(path)
        try:alpha=selected_component(mask,pose)
        except ValueError:rejected.append(frame);continue
        if clip['source']=='lv' or clip.get('personGuard')=='body':
            head_key=hashlib.sha256((source_hashes[source]+pose_hash+str((x,y,w,h,frame))).encode()).hexdigest()[:20]
            alpha=guard_person(alpha,originals[frame],pose,head_root/f'{head_key}.png',clip.get('personGuard')=='body',clip.get('headEnvelope',False))
        if clip.get('neutralWristBackdrop'):alpha=remove_wrist_backdrop(alpha,originals[frame],pose)
        if not complete_body(alpha,pose):rejected.append(frame);continue
        top,floor,left,right=bounds(alpha)
        hip=pose[[23,24],:2].mean(axis=0)*[w,h]
        decoded.append((frame,originals[frame],alpha,hip,top,floor,left,right))
    # Use each complete silhouette's head and sole for exact registration.
    # Smooth the horizontal pelvis only; a smoothed floor makes feet float.
    if not decoded:raise ValueError(f'No complete frames in {clip["id"]}')
    smooth=gaussian_filter1d(np.array([d[3][0] for d in decoded]),2,mode='nearest')
    registered={}
    for i,(frame,rgb,alpha,hip,top,floor,left,right) in enumerate(decoded):
        sx=smooth[i];sf=floor;scale=TARGET_HEIGHT/max(floor-top,1)
        # Keep hats, bags and stride tips inside the tile; never stretch x/y separately.
        scale=min(scale,480/max(right-left,1),710/max(floor-top,1))
        transform=np.float32([[scale,0,256-sx*scale],[0,scale,GROUND-sf*scale]])
        premult=np.dstack((rgb.astype(np.float32)/255*alpha[:,:,None],alpha))
        warped=cv2.warpAffine(premult,transform,(512,768),flags=cv2.INTER_LANCZOS4)
        a=np.clip(warped[:,:,3],0,1);color=np.clip(warped[:,:,:3]/np.maximum(a[:,:,None],1/255),0,1)
        rgba=np.dstack((color,a));rgba[a<1/255]=0
        path=folder/f'{frame}.png';Image.fromarray((rgba*255).round().astype('uint8')).save(path)
        # Match the joints where they actually appear on the canvas. Subtracting
        # each pelvis would hide the rendered hip-height differences and penalize
        # different leg proportions even when their planted feet already align.
        origin=np.array([256-sx*scale,GROUND-sf*scale])
        gait=((poses[frame][[25,26,27,28],:2]*[w,h]*scale+origin)/[512,768]).round(5).flatten().tolist()
        reg={'height':round((floor-top)*scale,2),'ground':round(GROUND+(floor-sf)*scale,2),'hipX':round(256+(hip[0]-sx)*scale,2),'hipY':round(hip[1]*scale+origin[1],2)}
        registered[str(frame)]={'gait':gait,'registration':reg}
        all_rows.append(({**selected_by_frame[frame],**registered[str(frame)]},path))
    metadata.write_text(json.dumps(registered));key.write_text(json.dumps(fingerprint));print(clip['id'],len(decoded),'direct frames; rejected',rejected,flush=True)

if head_model is not None:head_model.close()
by_clip={clip['id']:[r for r,_ in all_rows if r['clip']==clip['id']] for clip in manifest['clips']}
reference=by_clip['lv-front-276']
reference_phase=np.array([r['phase'] for r in reference])
def leg_difference(rows):
    g=np.array([r['gait'] for r in rows])
    return np.stack([g[:,0]-g[:,2],(g[:,1]-g[:,3])*2,g[:,4]-g[:,6],(g[:,5]-g[:,7])*2],axis=1)
reference_legs=leg_difference(reference)
def leg_template(phase):
    distance=np.abs((phase[:,None]-reference_phase[None,:]+.5)%1-.5)
    weights=np.exp(-distance**2/(2*.05**2))
    return weights@reference_legs/np.maximum(weights.sum(axis=1,keepdims=True),1e-9)
for clip in manifest['clips']:
    if not 0<abs(clip['yaw'])<=20:continue
    rows=by_clip[clip['id']];phase=np.array([r['phase'] for r in rows]);legs=leg_difference(rows)
    error,offset=min((float(np.mean((leg_template((phase+offset)%1)-legs)**2)),offset) for offset in np.arange(180)/180)
    for row in rows:row['phase']=float((row['phase']+offset)%1)
    clip['screenPhaseCalibration']={'reference':'lv-front-276','offset':float(offset),'error':error}
for rows in by_clip.values():
    for i,row in enumerate(rows):
        before=rows[max(0,i-1)];after=rows[min(len(rows)-1,i+1)]
        if row['sourceFrame']-before['sourceFrame']!=1:before=row
        if after['sourceFrame']-row['sourceFrame']!=1:after=row
        distance=after['sourceFrame']-before['sourceFrame']
        row['gaitVelocity']=((np.array(after['gait'])-before['gait'])/max(distance,1)).round(5).tolist()
atlases=[];frames=[]
for start in range(0,len(all_rows),4):
    sheet=Image.new('RGBA',(1024,1536))
    for tile,(row,path) in enumerate(all_rows[start:start+4]):
        sheet.paste(Image.open(path).convert('RGBA'),((tile%2)*512,(tile//2)*768))
        frames.append({**row,'atlas':len(atlases),'tile':tile})
    name=f'hd-{len(atlases):02}.webp';sheet.save(media/name,'WEBP',quality=96,method=4);atlases.append(name)
identity_fields=('clip','source','sourceFrame','yaw','look')
selected_identities={tuple(f.get(k) for k in identity_fields) for f in manifest['frames']}
assert all(tuple(f.get(k) for k in identity_fields) in selected_identities for f in frames), 'Refinement changed a source identity'
for clip in manifest['clips']:
    clip['rejectedFrames']=[f['sourceFrame'] for f in manifest['frames'] if f['clip']==clip['id'] and f['sourceFrame'] not in {r['sourceFrame'] for r in frames if r['clip']==clip['id']}]
    clip['frames']=sum(f['clip']==clip['id'] for f in frames)
asset_version=hashlib.sha256(b''.join(hashlib.sha256((media/name).read_bytes()).digest() for name in atlases)).hexdigest()[:12]
manifest.update(tileWidth=512,tileHeight=768,columns=2,rows=2,atlases=atlases,frames=frames,assetVersion=asset_version,quality={'sourceResolution':[1920,1080],'matting':'BiRefNet lite per-frame + complete-body validation + reviewed person support','engine':args.engine,'modelSha256':model.weights_sha256,'inferenceFingerprint':model_hash,'headSupportModelSha256':pose_hash,'maskKeySpacing':1,'maskMaxDistance':0,'targetHeight':TARGET_HEIGHT,'targetGround':GROUND,'webpQuality':96,'atlasDecodeLimit':5})
manifest_path.write_text(json.dumps(manifest,separators=(',',':'))+'\n');print('Exported',len(frames),'HD frames in',len(atlases),'pages',flush=True)
