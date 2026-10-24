"""Segment reviewed native frames, normalize stature, and export alpha tiles.

BiRefNet key masks are transported over at most three source frames with optical
flow. Both neighboring keys are evaluated in the current frame's coordinates;
RGB is always the current original frame, never an average of moving people.
"""
import argparse, hashlib, json
from pathlib import Path
import cv2
import numpy as np
import onnxruntime as ort
import mediapipe as mp
from PIL import Image
from scipy.ndimage import gaussian_filter1d

VERSION = 'biref-flow-v6-current-head-support'
KEY_SPACING = 6
TARGET_HEIGHT = 660
GROUND = 720

def selected_component(alpha, pose):
    """Remove other models without cutting off disconnected hands or shoes."""
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
    # A cuff/shoe can be separated by a few pixels. Keep only small islands
    # touching a visible hand or foot, never arbitrary background fragments.
    for j in range(1,count):
        if j==label or stats[j,cv2.CC_STAT_AREA]<12: continue
        x,y,cw,ch,area=stats[j]
        for k in [15,16,19,20,27,28,29,30,31,32]:
            px,py=pose[k,:2]*[w,h]
            if x-8<=px<=x+cw+8 and y-8<=py<=y+ch+8 and area<stats[label,cv2.CC_STAT_AREA]*.12:
                support |= labels==j; break
    support=cv2.dilate(support.astype('uint8'),np.ones((5,5),np.uint8))
    return np.clip((alpha-.015)/.97,0,1)*support

def infer_mask(session,rgb,pose):
    small=cv2.resize(rgb,(1024,1024),interpolation=cv2.INTER_AREA).astype(np.float32)/255
    tensor=((small-np.array([.485,.456,.406],np.float32))/np.array([.229,.224,.225],np.float32)).transpose(2,0,1)[None]
    logits=session.run(None,{session.get_inputs()[0].name:tensor})[0][0,0]
    mask=1/(1+np.exp(-np.clip(logits,-40,40)))
    mask=cv2.resize(mask,(rgb.shape[1],rgb.shape[0]),interpolation=cv2.INTER_LINEAR)
    return selected_component(mask,pose)

def transport(mask,current_gray,key_gray):
    # Backward flow: for every CURRENT pixel, locate its pixel in the key mask.
    flow=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM).calc(current_gray,key_gray,None)
    h,w=flow.shape[:2]; xx,yy=np.meshgrid(np.arange(w,dtype=np.float32),np.arange(h,dtype=np.float32))
    # High-resolution contour follows the flow without upscaling the RGB.
    full_flow=cv2.resize(flow,(mask.shape[1],mask.shape[0]))
    full_flow[:,:,0]*=mask.shape[1]/w; full_flow[:,:,1]*=mask.shape[0]/h
    fx,fy=np.meshgrid(np.arange(mask.shape[1],dtype=np.float32),np.arange(mask.shape[0],dtype=np.float32))
    full=cv2.remap(mask,fx+full_flow[:,:,0],fy+full_flow[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    # photometric consistency weights competing keys near moving boundaries.
    key_luma=cv2.remap(key_gray,xx+flow[:,:,0],yy+flow[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
    error=cv2.resize(np.abs(current_gray.astype(np.float32)-key_luma.astype(np.float32)),(mask.shape[1],mask.shape[0]))
    return full, np.exp(-error/12)+.02

def bounds(alpha):
    yy,xx=np.where(alpha>.65)
    if not len(yy): raise ValueError('Empty matte')
    counts=np.bincount(yy,minlength=alpha.shape[0]); rows=np.flatnonzero(counts>=3)
    return float(rows[0]),float(rows[-1]),float(xx.min()),float(xx.max())

def clean_floor(alpha,pose):
    """Discard attached ground smears below both ankles, preserving shoe tips."""
    if pose[[27,28,29,30,31,32],3].min()<.5:return alpha
    h,w=alpha.shape;top,floor,_,_=bounds(alpha);height=floor-top
    xy=pose[:,:2]*[w,h];lower=round(max(xy[27,1],xy[28,1])+height*.01)
    zone=np.zeros((h,w),np.uint8)
    for points in [[27,29,31],[28,30,32]]:
        cv2.fillConvexPoly(zone,cv2.convexHull(xy[points].round().astype(np.int32)),1)
    radius=max(3,round(height*.018));zone=cv2.dilate(zone,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(radius*2+1,radius*2+1)))
    zone=cv2.GaussianBlur(zone.astype(np.float32),(0,0),.6)
    alpha=alpha.copy();alpha[max(0,lower):]*=zone[max(0,lower):]
    return alpha

def guard_head(alpha,rgb,pose,path):
    """The wave backdrop can be salient to BiRefNet; use person semantics here."""
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
    shoulder=max(pose[11,1],pose[12,1])*h;transition=h*.025
    body=np.clip((np.arange(h)-shoulder+transition)/transition,0,1)[:,None]
    return alpha*np.maximum(support,body)

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
manifest_path=args.output/'angles.json'; manifest=json.loads(manifest_path.read_text())
catalog={s['id']:s for s in json.loads(Path(__file__).with_name('angle-sources.json').read_text())}
model=args.cache/'birefnet-lite.onnx'; model_hash=hashlib.sha256(model.read_bytes()).hexdigest()
root=args.cache/'matted-fit';root.mkdir(exist_ok=True)
mask_root=args.cache/'biref-masks';mask_root.mkdir(exist_ok=True)
head_root=args.cache/'head-masks';head_root.mkdir(exist_ok=True)
pose_hash=hashlib.sha256((args.cache/'pose.task').read_bytes()).hexdigest()
media=args.output/'media/angles';media.mkdir(parents=True,exist_ok=True)
options=ort.SessionOptions();options.intra_op_num_threads=4
session=None
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
    folder=root/clip['id'];folder.mkdir(exist_ok=True);key=folder/'input.json';metadata=folder/'registration.json'
    if key.exists() and json.loads(key.read_text())==fingerprint and metadata.exists():
        registered=json.loads(metadata.read_text())
        if all((folder/f'{r["sourceFrame"]}.png').exists() for r in selected):
            all_rows.extend(({**r,**registered[str(r['sourceFrame'])]},folder/f'{r["sourceFrame"]}.png') for r in selected)
            print(clip['id'],len(selected),'cached',flush=True);continue
    pose_rows=json.loads((args.cache/'angles'/clip['id']/'rows.json').read_text())['rows']
    begin,end=min(r['sourceFrame'] for r in selected),max(r['sourceFrame'] for r in selected)
    poses={r['sourceFrame']:np.array(r['pose']) for r in pose_rows if begin<=r['sourceFrame']<=end}
    cap=cv2.VideoCapture(str(source));assert(cap.get(cv2.CAP_PROP_FRAME_WIDTH),cap.get(cv2.CAP_PROP_FRAME_HEIGHT),cap.get(cv2.CAP_PROP_FPS))==(1920,1080,25)
    factor=catalog[clip['source']]['roiScale'];x,y,w,h=[round(v*factor) for v in clip['roi']]
    first,last=min(poses),max(poses); cap.set(cv2.CAP_PROP_POS_FRAMES,first)
    originals={};grays={}
    for frame in range(first,last+1):
        ok,original=cap.read()
        if not ok:raise RuntimeError(f'Cannot read {source}:{frame}')
        crop=cv2.cvtColor(original[y:y+h,x:x+w],cv2.COLOR_BGR2RGB)
        originals[frame]=crop
        grays[frame]=cv2.cvtColor(cv2.resize(crop,(round(w/h*540),540)),cv2.COLOR_RGB2GRAY)
    cap.release()
    valid=sorted(poses); keys=sorted(set([valid[0],valid[-1]]+[f for f in valid if f%KEY_SPACING==0]))
    # Missing pose detections must not leave a long propagation interval.
    for row in selected:
        if min(abs(row['sourceFrame']-f) for f in keys)>KEY_SPACING//2:keys.append(row['sourceFrame'])
    keys.sort()
    masks={}
    for frame in keys:
        mask_key=hashlib.sha256((source_hashes[source]+model_hash+str((x,y,w,h,frame))).encode()).hexdigest()[:20]
        path=mask_root/f'{mask_key}.png'
        if path.exists():mask=np.array(Image.open(path)).astype(np.float32)/65535
        else:
            if session is None:session=ort.InferenceSession(str(model),sess_options=options,providers=['CPUExecutionProvider'])
            try:mask=infer_mask(session,originals[frame],poses[frame])
            except ValueError as error:raise RuntimeError(f'{clip["id"]}:{frame}: {error}') from error
            Image.fromarray((mask*65535).round().astype('uint16')).save(path)
        masks[frame]=mask
    decoded=[]
    for row in selected:
        frame=row['sourceFrame'];pose=poses[frame]
        if frame in masks:alpha=masks[frame]
        else:
            nearby=[f for f in keys if abs(f-frame)<=KEY_SPACING//2]
            numerator=np.zeros((h,w),np.float32);denominator=np.zeros((h,w),np.float32)
            for neighbor in nearby:
                warped,weight=transport(masks[neighbor],grays[frame],grays[neighbor])
                weight/=abs(neighbor-frame);numerator+=warped*weight;denominator+=weight
            alpha=numerator/np.maximum(denominator,1e-6)
            alpha=selected_component(alpha,pose)
        if clip['source']=='lv':
            head_key=hashlib.sha256((source_hashes[source]+pose_hash+str((x,y,w,h,frame))).encode()).hexdigest()[:20]
            alpha=guard_head(alpha,originals[frame],pose,head_root/f'{head_key}.png')
        alpha=clean_floor(alpha,pose)
        top,floor,left,right=bounds(alpha)
        hip=pose[[23,24],:2].mean(axis=0)*[w,h]
        decoded.append((frame,originals[frame],alpha,hip,top,floor,left,right))
    # Use each complete silhouette's head and sole for exact registration.
    # Smooth the horizontal pelvis only; a smoothed floor makes feet float.
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
        # Match knees and ankles in the common, registered body coordinates.
        gait=((poses[frame][[25,26,27,28],:2]*[w,h]-hip)*scale/[512,768]).round(5).flatten().tolist()
        reg={'height':round((floor-top)*scale,2),'ground':round(GROUND+(floor-sf)*scale,2),'hipX':round(256+(hip[0]-sx)*scale,2)}
        registered[str(frame)]={'gait':gait,'registration':reg}
        all_rows.append(({**selected_by_frame[frame],**registered[str(frame)]},path))
    metadata.write_text(json.dumps(registered));key.write_text(json.dumps(fingerprint));print(clip['id'],len(selected),'refined',len(keys),'key masks',flush=True)

if head_model is not None:head_model.close()
atlases=[];frames=[]
for start in range(0,len(all_rows),4):
    sheet=Image.new('RGBA',(1024,1536))
    for tile,(row,path) in enumerate(all_rows[start:start+4]):
        sheet.paste(Image.open(path).convert('RGBA'),((tile%2)*512,(tile//2)*768))
        frames.append({**row,'atlas':len(atlases),'tile':tile})
    name=f'hd-{len(atlases):02}.webp';sheet.save(media/name,'WEBP',quality=96,method=4);atlases.append(name)
identity_fields=('clip','source','sourceFrame','yaw','phase','look')
assert [tuple(f.get(k) for k in identity_fields) for f in frames]==[tuple(f.get(k) for k in identity_fields) for f in manifest['frames']], 'Refinement changed the selected source sequence'
manifest.update(tileWidth=512,tileHeight=768,columns=2,rows=2,atlases=atlases,frames=frames,quality={'sourceResolution':[1920,1080],'matting':'BiRefNet general lite + optical flow + LV semantic head support','modelSha256':model_hash,'headSupportModelSha256':pose_hash,'maskKeySpacing':KEY_SPACING,'maskMaxDistance':KEY_SPACING//2,'targetHeight':TARGET_HEIGHT,'targetGround':GROUND,'webpQuality':96,'atlasDecodeLimit':5})
manifest_path.write_text(json.dumps(manifest,separators=(',',':'))+'\n');print('Exported',len(frames),'HD frames in',len(atlases),'pages',flush=True)
