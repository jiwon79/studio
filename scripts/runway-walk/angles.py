"""Extract source-indexed alpha atlases for the angle-controlled walking study.

Angles are approximate, manually reviewed camera-relative shot annotations, not
calibrated camera measurements. World landmarks estimate a common gait clock.
"""
import argparse,json,hashlib
from pathlib import Path
import cv2, mediapipe as mp, numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter1d

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
shots=json.loads(Path(__file__).with_name('angle-shots.json').read_text())
root=args.cache/'angles';root.mkdir(exist_ok=True)
media=args.output/'media'/'angles';media.mkdir(parents=True,exist_ok=True)
sources={'lv':args.cache/'source.mp4','prada':args.cache/'prada-ss26.mp4','fw':args.cache/'prada-fw26.mp4'}
opts=mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(args.cache/'pose.task')),num_poses=3,output_segmentation_masks=True,min_pose_detection_confidence=.45)
all_rows=[];clip_info=[]
with mp.tasks.vision.PoseLandmarker.create_from_options(opts) as model:
 for shot in shots:
  folder=root/shot['id'];folder.mkdir(exist_ok=True)
  key=hashlib.sha256((json.dumps({k:v for k,v in shot.items() if k not in ['yaw','yawKeys']},sort_keys=True)+'registration-v2').encode()).hexdigest()
  rows=[]
  if (folder/'rows.json').exists():
   stored=json.loads((folder/'rows.json').read_text())
   if stored['key']==key: rows=stored['rows']
  if not rows:
   cap=cv2.VideoCapture(str(sources[shot['source']]));fps=cap.get(cv2.CAP_PROP_FPS);start=round(shot['start']*fps);cap.set(cv2.CAP_PROP_POS_FRAMES,start)
   for source_frame in range(start,round(shot['end']*fps)):
    ok,source=cap.read()
    if not ok:break
    x,y,w,h=shot['roi'];crop=source[y:y+h,x:x+w]
    small=cv2.resize(crop,(round(w/h*720),720));sw=small.shape[1]
    result=model.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(small,cv2.COLOR_BGR2RGB)))
    candidates=[]
    for j,landmarks in enumerate(result.pose_landmarks):
     p=np.array([[a.x,a.y,a.z,a.visibility] for a in landmarks]);hip=p[[23,24],:2].mean(axis=0)
     height=p[[27,28,29,30,31,32],1].max()-p[0,1]
     if p[0,1]<.025 or p[[27,28,29,30,31,32],1].max()>.985 or height<.32 or abs(hip[0]-.5)>.38:continue
     candidates.append((height-.6*abs(hip[0]-.5),j,p))
    if not candidates:continue
    _,j,p=max(candidates,key=lambda c:c[0]);world=np.array([[a.x,a.y,a.z] for a in result.pose_world_landmarks[j]])
    mask=result.segmentation_masks[j].numpy_view().squeeze();alpha=np.clip((mask-.12)/.76,0,1)
    _,labels,_,_=cv2.connectedComponentsWithStats((alpha>.4).astype('uint8'))
    hip=p[[23,24],:2].mean(axis=0);label=labels[min(719,max(0,int(hip[1]*720))),min(sw-1,max(0,int(hip[0]*sw)))]
    if label==0:continue
    alpha*=cv2.dilate((labels==label).astype('uint8'),np.ones((5,5),np.uint8))
    alpha=cv2.resize(alpha,(w,h));xy=p[:,:2]*[w,h]
    leg=sum(np.linalg.norm(xy[a]-xy[b]) for a,b in [(23,25),(25,27),(24,26),(26,28)])/2
    # Uniform registration; preserve original texture and silhouette.
    ys,xs=np.where(alpha>.4)
    if not len(ys):continue
    scale=min(138/max(leg,1),350/max(ys.max()-ys.min(),1),240/max(xs.max()-xs.min(),1))
    hp=hip*[w,h];floor=float(np.max(xy[[29,30,31,32],1]));matrix=np.float32([[scale,0,128-hp[0]*scale],[0,scale,360-floor*scale]])
    rgba=np.dstack((crop.astype('float32')*alpha[:,:,None],alpha*255))
    warped=cv2.warpAffine(rgba,matrix,(256,384),flags=cv2.INTER_LANCZOS4)
    a=np.clip(warped[:,:,3],0,255);rgb=np.clip(warped[:,:,:3]*255/np.maximum(a[:,:,None],1),0,255)
    out=np.dstack((rgb,a)).astype('uint8');name=f'{source_frame}.png';cv2.imwrite(str(folder/name),out)
    shoulder=world[11]-world[12];forward=np.array([-shoulder[2],0,shoulder[0]]);forward/=max(np.linalg.norm(forward),1e-6)
    signal=float(np.dot(world[27]-world[28],forward))
    rows.append({'sourceFrame':source_frame,'file':name,'signal':signal,'pose':p.tolist()})
   cap.release();(folder/'rows.json').write_text(json.dumps({'key':key,'rows':rows}))
  print(shot['id'],len(rows),flush=True)
  if len(rows)<12:continue
  t=np.array([r['sourceFrame']/25 for r in rows]);signal=gaussian_filter1d(np.array([r['signal'] for r in rows]),1)
  best=None
  for freq in np.linspace(.65,1.25,121):
   theta=(t-t[0])*2*np.pi*freq;basis=np.stack([np.sin(theta),np.cos(theta),np.ones(len(t))],axis=1);coef=np.linalg.lstsq(basis,signal,rcond=None)[0];err=float(np.mean((basis@coef-signal)**2))
   if best is None or err<best[0]:best=(err,freq,coef)
  err,freq,coef=best
  for r in rows:
   r.update(clip=shot['id'],source=shot['source'],yaw=float(np.interp(r['sourceFrame']/25,*np.array(shot['yawKeys']).T)) if 'yawKeys' in shot else shot['yaw'],phase=float(((r['sourceFrame']/25-t[0])*freq+np.arctan2(coef[1],coef[0])/(2*np.pi))%1),path=str(folder/r['file']))
   all_rows.append(r)
  clip_info.append({**shot,'frames':len(rows),'frequency':float(freq),'phaseFitError':err})
# Lossy WebP RGB with preserved alpha, 6x6 tiles per sheet.
atlases=[];frames=[]
for start in range(0,len(all_rows),36):
 batch=all_rows[start:start+36];sheet=Image.new('RGBA',(256*6,384*6));atlas=len(atlases);filename=f'angle-{atlas:02}.webp'
 for i,row in enumerate(batch):
  im=Image.open(row['path']).convert('RGBA');sheet.paste(im,((i%6)*256,(i//6)*384))
  frames.append({k:row[k] for k in ['clip','source','sourceFrame','yaw','phase']}|{'atlas':atlas,'tile':i})
 sheet.save(media/filename,'WEBP',quality=88,method=4);atlases.append(filename)
manifest={'fps':25,'holdFrames':3,'tileWidth':256,'tileHeight':384,'columns':6,'angleType':'approximate camera-relative shot annotation','sources':[{'id':'lv','url':'https://www.youtube.com/watch?v=qcE5NeDUvIk','title':"Louis Vuitton Men's Spring-Summer 2027"},{'id':'prada','url':'https://www.youtube.com/watch?v=SAjtxnyXu8U','title':'Prada Spring/Summer 2026 Menswear'},{'id':'fw','url':'https://www.youtube.com/watch?v=J1GCDcbYIRI','title':'Prada Fall/Winter 2026 Menswear'}],'clips':clip_info,'atlases':atlases,'frames':frames}
(args.output/'angles.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
print('Exported',len(frames),'frames /',len(atlases),'atlases',flush=True)
