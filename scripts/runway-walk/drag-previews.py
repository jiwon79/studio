"""Build a small, fully resident direction/phase library for network-free dragging.

Run after refine-angles.py, against the final manifest (not its raw pose input).
Only original, reviewed, consecutive three-frame blocks can supply a preview.
"""
import argparse, hashlib, json, math
from pathlib import Path
from PIL import Image

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
manifest=json.loads((args.output/'angles.json').read_text())
frames=manifest['frames'];hold=manifest['holdFrames'];phases=8
width,height,columns,rows=160,240,6,8
blocks=[]
for i,f in enumerate(frames):
    block=frames[i:i+hold]
    if len(block)==hold and all(r['clip']==f['clip'] and r['sourceFrame']==f['sourceFrame']+j for j,r in enumerate(block)):
        blocks.append((i,min(r['yaw'] for r in block),max(r['yaw'] for r in block),sum(r['yaw'] for r in block)/hold))
lookup=[];selected=[];indices={}
for yaw in range(manifest['yawRange'][0],manifest['yawRange'][1]+1):
    candidates=[b for b in blocks if max(abs(b[1]-yaw),abs(b[2]-yaw))<=5]
    if not candidates:raise ValueError(f'No reviewed preview for {yaw}')
    direction=[]
    for phase in range(phases):
        def score(b):
            delta=abs(frames[b[0]]['phase']-phase/phases)%1
            return min(delta,1-delta)*2+abs(b[3]-yaw)/90
        index=min(candidates,key=score)[0]
        if index not in indices:indices[index]=len(selected);selected.append(index)
        direction.append(indices[index])
    lookup.append(direction)
media=args.output/'media/angles';atlases=[];tiles=[]
for start in range(0,len(selected),columns*rows):
    sheet=Image.new('RGBA',(width*columns,height*rows));pages={}
    for tile,index in enumerate(selected[start:start+columns*rows]):
        f=frames[index]
        if f['atlas'] not in pages:pages[f['atlas']]=Image.open(media/manifest['atlases'][f['atlas']]).convert('RGBA')
        x=f['tile']%manifest['columns']*manifest['tileWidth'];y=f['tile']//manifest['columns']*manifest['tileHeight']
        crop=pages[f['atlas']].crop((x,y,x+manifest['tileWidth'],y+manifest['tileHeight']))
        # Pillow's RGBA resize filters premultiplied colors to avoid dark halos.
        crop=crop.resize((width,height),Image.Resampling.LANCZOS)
        sheet.paste(crop,(tile%columns*width,tile//columns*height))
        tiles.append({'frame':index,'atlas':len(atlases),'tile':tile})
    name=f'drag-{len(atlases):02}.webp';sheet.save(media/name,'WEBP',quality=92,method=4);atlases.append(name)
asset_version=hashlib.sha256(b''.join((media/name).read_bytes() for name in atlases)).hexdigest()[:12]
result={'sourceAssetVersion':manifest['assetVersion'],'assetVersion':asset_version,'tileWidth':width,'tileHeight':height,'columns':columns,'rows':rows,'phases':phases,'yawRange':manifest['yawRange'],'atlases':atlases,'tiles':tiles,'lookup':lookup}
(args.output/'drag.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print(len(tiles),'preview frames;',len(atlases),'pages;',sum((media/n).stat().st_size for n in atlases),'bytes;',len(atlases)*width*columns*height*rows*4,'decoded bytes')
