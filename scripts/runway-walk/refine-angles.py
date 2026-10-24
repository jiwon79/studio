"""Re-matte the existing angle timeline at native 1080p; export 512x768 alpha tiles.

Preserves the reviewed source/pose/angle selection exactly. RVM recurrent states
advance through consecutive ORIGINAL frames, including frames absent from the
pose selection. Model and source files remain in the ignored local cache.
"""
import argparse, hashlib, json
from pathlib import Path
import cv2
import numpy as np
import onnxruntime as ort
import mediapipe as mp
from PIL import Image
from scipy.ndimage import gaussian_filter1d


def polish_rgba(rgba):
    # Keep a narrow antialiased boundary around confident foreground. This removes
    # translucent runway smears connected to bags without blurring clothing RGB.
    alpha = rgba[:,:,3].astype(np.float32)/255
    support = cv2.dilate((alpha > .65).astype(np.uint8),np.ones((3,3),np.uint8)).astype(np.float32)
    support = cv2.GaussianBlur(support,(0,0),.35)
    rgba[:,:,3] = (alpha*support*255).round().astype(np.uint8)
    rgba[rgba[:,:,3]==0,:3] = 0
    return rgba

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
manifest_path = args.output / 'angles.json'
manifest = json.loads(manifest_path.read_text())
source_catalog = {s['id']:s for s in json.loads(Path(__file__).with_name('angle-sources.json').read_text())}
source_paths = {key:args.cache/value['file'] for key,value in source_catalog.items()}
source_hashes = {}
model_path = args.cache/'rvm-mobilenetv3.onnx'
model_hash = hashlib.sha256(model_path.read_bytes()).hexdigest()
root = args.cache/'matted-hd'; root.mkdir(exist_ok=True)
media = args.output/'media/angles'; media.mkdir(parents=True, exist_ok=True)
options = ort.SessionOptions(); options.intra_op_num_threads = 4
session = ort.InferenceSession(str(model_path), sess_options=options, providers=['CPUExecutionProvider'])
foot_options = mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(args.cache/'pose.task')), num_poses=3, output_segmentation_masks=True, min_pose_detection_confidence=.45)
foot_model = mp.tasks.vision.PoseLandmarker.create_from_options(foot_options)
all_rows = []
for clip in manifest['clips']:
    selected = [f for f in manifest['frames'] if f['clip'] == clip['id']]
    source = source_paths[clip['source']]
    if source not in source_hashes: source_hashes[source] = hashlib.sha256(source.read_bytes()).hexdigest()
    source_hash = source_hashes[source]
    folder = root/clip['id']; folder.mkdir(exist_ok=True)
    fingerprint = {'source':source_hash,'model':model_hash,'version':'rvm-hd-v3-confident-edge','frames':[r['sourceFrame'] for r in selected]}
    key = folder/'input.json'
    if key.exists():
        previous = json.loads(key.read_text())
        if previous.get('version') == 'rvm-hd-v2-foot-support' and {k:v for k,v in previous.items() if k!='version'} == {k:v for k,v in fingerprint.items() if k!='version'}:
            for row in selected:
                path = folder/f"{row['sourceFrame']}.png"
                Image.fromarray(polish_rgba(np.array(Image.open(path)))).save(path)
            key.write_text(json.dumps(fingerprint))
    if key.exists() and json.loads(key.read_text()) == fingerprint and all((folder/f"{r['sourceFrame']}.png").exists() for r in selected):
        all_rows.extend((row,folder/f"{row['sourceFrame']}.png") for row in selected)
        print(clip['id'],len(selected),'cached',flush=True); continue
    pose_rows = json.loads((args.cache/'angles'/clip['id']/'rows.json').read_text())['rows']
    poses = {r['sourceFrame']:np.array(r['pose']) for r in pose_rows}
    cap = cv2.VideoCapture(str(source))
    assert (cap.get(cv2.CAP_PROP_FRAME_WIDTH),cap.get(cv2.CAP_PROP_FRAME_HEIGHT),cap.get(cv2.CAP_PROP_FPS)) == (1920,1080,25)
    # Original Prada annotations used 720p coordinates; use the native 1080p crop.
    factor = source_catalog[clip['source']]['roiScale']
    x,y,w,h = [round(v*factor) for v in clip['roi']]
    rec = {f'r{i}i':np.zeros((1,1,1,1),np.float32) for i in range(1,5)}
    selection = {r['sourceFrame']:r for r in selected}
    first,last = min(selection),max(selection)
    cap.set(cv2.CAP_PROP_POS_FRAMES,first)
    decoded = []
    for frame in range(first,last+1):
        ok,original = cap.read()
        if not ok:raise RuntimeError(f'Cannot read {source} frame {frame}')
        crop = original[y:y+h,x:x+w]
        rgb = cv2.cvtColor(crop,cv2.COLOR_BGR2RGB).astype(np.float32)/255
        out = session.run(None,{'src':rgb.transpose(2,0,1)[None],**rec,'downsample_ratio':np.array([.5],np.float32)})
        rec = {f'r{i}i':out[i+1] for i in range(1,5)}
        if frame not in selection:continue
        p = poses[frame]; alpha = np.clip(out[1][0,0],0,1)
        hip = p[[23,24],:2].mean(axis=0)*[w,h]
        # Keep the person at the reviewed pelvis, removing audience/island noise.
        _,labels,stats,_ = cv2.connectedComponentsWithStats((alpha>.12).astype('uint8'))
        label = labels[min(h-1,max(0,int(hip[1]))),min(w-1,max(0,int(hip[0])))]
        if label==0:raise RuntimeError(f'Matting lost the selected pelvis: {clip["id"]}:{frame}')
        support = cv2.dilate((labels==label).astype('uint8'),np.ones((5,5),np.uint8)).astype(np.float32)
        alpha *= support
        # Remove low-opacity haze while retaining a soft, subpixel boundary.
        alpha = np.clip((alpha-.025)/.95,0,1)
        # RVM can mistake white shoes for the bright runway. Restore only the
        # small annotated foot regions from the independent pose segmentation.
        if clip['id'] == 'lv-front-276':
            small = cv2.resize(crop,(round(w/h*720),720))
            result = foot_model.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(small,cv2.COLOR_BGR2RGB)))
            if result.pose_landmarks:
                distances = [np.linalg.norm(np.mean([[a.x,a.y] for a in landmarks[23:25]],axis=0)-p[[23,24],:2].mean(axis=0)) for landmarks in result.pose_landmarks]
                j = int(np.argmin(distances))
                coarse = cv2.resize(result.segmentation_masks[j].numpy_view().squeeze(),(w,h))
                coarse = np.clip((coarse-.2)/.6,0,1)
                zone = np.zeros((h,w),np.uint8)
                for points in [[27,29,31],[28,30,32]]:
                    hull = cv2.convexHull((p[points,:2]*[w,h]).astype(np.int32))
                    cv2.fillConvexPoly(zone,hull,1)
                zone = cv2.dilate(zone,np.ones((21,21),np.uint8)).astype(np.float32)
                zone = cv2.GaussianBlur(zone,(0,0),1)
                alpha = np.maximum(alpha,coarse*zone)
        # Use the actual source texture in opaque areas; decontaminate only edges.
        predicted = out[0][0].transpose(1,2,0)
        edge = np.clip((.99-alpha)/.25,0,1)[:,:,None]
        fg = rgb*(1-edge)+predicted*edge
        xy = p[:,:2]*[w,h]
        legs = sum(np.linalg.norm(xy[a]-xy[b]) for a,b in [(23,25),(25,27),(24,26),(26,28)])/2
        ys,xs = np.where(alpha>.4)
        if not len(ys):raise RuntimeError(f'Empty matte: {clip["id"]}:{frame}')
        scale = min(276/max(legs,1),700/max(ys.max()-ys.min(),1),480/max(xs.max()-xs.min(),1))
        floor = float(np.max(xy[[29,30,31,32],1]))
        decoded.append((frame,fg,alpha,hip,floor,scale))
    cap.release()
    # Stabilize detector jitter; never average texture or alpha across moving limbs.
    values = np.array([[d[3][0],d[3][1],d[4],d[5]] for d in decoded])
    # Smooth only within uninterrupted original source sequences.
    cuts = [0]+[i for i in range(1,len(decoded)) if decoded[i][0]!=decoded[i-1][0]+1]+[len(decoded)]
    smooth = values.copy()
    for a,b in zip(cuts[:-1],cuts[1:]): smooth[a:b] = gaussian_filter1d(values[a:b],1,axis=0,mode='nearest')
    for i,(frame,fg,alpha,hip,floor,scale) in enumerate(decoded):
        sx,_,sf,ss = smooth[i]; ss = min(ss,scale)
        transform = np.float32([[ss,0,256-sx*ss],[0,ss,720-sf*ss]])
        premult = np.dstack((fg*alpha[:,:,None],alpha))
        warped = cv2.warpAffine(premult,transform,(512,768),flags=cv2.INTER_LANCZOS4)
        a = np.clip(warped[:,:,3],0,1)
        rgb_out = np.clip(warped[:,:,:3]/np.maximum(a[:,:,None],1/255),0,1)
        rgba = np.dstack((rgb_out,a)); path = folder/f'{frame}.png'
        Image.fromarray(polish_rgba((rgba*255).round().astype('uint8'))).save(path)
        all_rows.append((selection[frame],path))
    key.write_text(json.dumps(fingerprint)); print(clip['id'],len(decoded),'refined',flush=True)
foot_model.close()
# Four frames/page: decode a few pages at a time on mobile instead of the full set.
atlases = []; frames = []
for start in range(0,len(all_rows),4):
    sheet = Image.new('RGBA',(1024,1536))
    for tile,(row,path) in enumerate(all_rows[start:start+4]):
        sheet.paste(Image.open(path).convert('RGBA'),((tile%2)*512,(tile//2)*768))
        frames.append({**row,'atlas':len(atlases),'tile':tile})
    name = f'hd-{len(atlases):02}.webp'
    sheet.save(media/name,'WEBP',quality=96,method=4)
    atlases.append(name)
manifest.update(tileWidth=512,tileHeight=768,columns=2,rows=2,atlases=atlases,frames=frames,quality={'sourceResolution':[1920,1080],'matting':'RVM mobilenetv3 recurrent ONNX','modelSha256':model_hash,'webpQuality':96,'atlasDecodeLimit':5})
manifest_path.write_text(json.dumps(manifest,separators=(',',':'))+'\n')
print('Exported',len(frames),'HD frames in',len(atlases),'pages',flush=True)
