"""Pack original-resolution drag frames for the five-degree direction grid.

Only empty transparent margins are trimmed. Visible pixels are copied from the
published HD pages without resizing and saved as lossless RGBA WebP.
"""
import argparse, functools, hashlib, json, subprocess, tempfile
from pathlib import Path
from PIL import Image

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
manifest=json.loads((args.output/'angles.json').read_text())
frames=manifest['frames']
# Use the same anatomical 3D selector as HD playback. Never select an opposite
# foot just because its screen position is closer, including while dragging.
with tempfile.TemporaryDirectory(prefix='runway-reference-drag-') as temporary:
    selection_path=Path(temporary)/'selection.json'
    subprocess.run(['node',str(Path(__file__).with_name('select-reference-drag.mjs')),str(args.output),str(selection_path)],check=True)
    selection=json.loads(selection_path.read_text())
assert selection['sourceAssetVersion']==manifest['assetVersion']
phases=selection['phases'];step=selection['step'];lookup=[];selected=[];indices={}
for direction in selection['frames']:
    slots=[]
    for index in direction:
        if index not in indices:indices[index]=len(selected);selected.append(index)
        slots.append(indices[index])
    lookup.append(slots)

media=args.output/'media/angles';media.mkdir(parents=True,exist_ok=True)
@functools.lru_cache(maxsize=4)
def source_page(index):
    with Image.open(media/manifest['atlases'][index]) as page:return page.convert('RGBA')

entries=[]
for slot,index in enumerate(selected):
    f=frames[index];w,h=manifest['tileWidth'],manifest['tileHeight']
    x=f['tile']%manifest['columns']*w;y=f['tile']//manifest['columns']*h
    full=source_page(f['atlas']).crop((x,y,x+w,y+h))
    box=full.getchannel('A').getbbox()
    if not box:raise ValueError(f'Empty source frame {index}')
    entries.append({'slot':slot,'frame':index,'image':full.crop(box),'offsetX':box[0],'offsetY':box[1]})

# First-fit decreasing-height shelves keep decoded memory close to the sum of
# trimmed rectangles. Each page is cropped to its actual used dimensions.
limit=2048;padding=2;packed=[];tiles=[None]*len(entries)
for entry in sorted(entries,key=lambda e:(-e['image'].height,-e['image'].width,e['slot'])):
    w,h=entry['image'].size;position=None
    for page_index,page in enumerate(packed):
        for shelf in page['shelves']:
            if h<=shelf['height'] and shelf['x']+w+padding<=limit:
                position=(page_index,shelf);break
        if position:break
        if page['bottom']+h+padding<=limit:
            shelf={'x':padding,'y':page['bottom'],'height':h}
            page['shelves'].append(shelf);page['bottom']+=h+padding
            position=(page_index,shelf);break
    if not position:
        shelf={'x':padding,'y':padding,'height':h}
        packed.append({'shelves':[shelf],'bottom':padding+h+padding,'entries':[]})
        position=(len(packed)-1,shelf)
    page_index,shelf=position;x,y=shelf['x'],shelf['y'];shelf['x']+=w+padding
    packed[page_index]['entries'].append((entry,x,y))
    tiles[entry['slot']]={'frame':entry['frame'],'atlas':page_index,'x':x,'y':y,
                         'width':w,'height':h,'offsetX':entry['offsetX'],'offsetY':entry['offsetY']}

atlases=[];pages=[]
for index,page in enumerate(packed):
    width=max(x+entry['image'].width+padding for entry,x,y in page['entries'])
    height=max(y+entry['image'].height+padding for entry,x,y in page['entries'])
    sheet=Image.new('RGBA',(width,height))
    for entry,x,y in page['entries']:sheet.paste(entry['image'],(x,y))
    name=f'drag-hd-{index:02}.webp'
    sheet.save(media/name,'WEBP',lossless=True,quality=100,method=4,exact=True)
    # Check every visible pixel, including hair and translucent matte edges.
    with Image.open(media/name) as encoded:
        decoded=encoded.convert('RGBA')
        for entry,x,y in page['entries']:
            crop=decoded.crop((x,y,x+entry['image'].width,y+entry['image'].height))
            assert crop.tobytes()==entry['image'].tobytes(),f'Changed pixels in {entry["frame"]}'
    atlases.append(name);pages.append({'width':width,'height':height})
decoded_bytes=sum(p['width']*p['height']*4 for p in pages)
if decoded_bytes>224*1024*1024:raise ValueError(f'Drag library exceeds its decoded budget: {decoded_bytes}')
asset_version=hashlib.sha256(b''.join((media/name).read_bytes() for name in atlases)).hexdigest()[:12]
result={'sourceAssetVersion':manifest['assetVersion'],'assetVersion':asset_version,
        'tileWidth':manifest['tileWidth'],'tileHeight':manifest['tileHeight'],
        'yawStep':step,'phases':phases,'yawRange':manifest['yawRange'],
        'selector':selection['selector'],'referenceMatchVersion':selection['referenceMatchVersion'],
        'quality':'lossless-original-pixels','atlases':atlases,'pages':pages,'tiles':tiles,'lookup':lookup}
(args.output/'drag.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print(len(tiles),'original-resolution frames;',len(atlases),'pages;',
      sum((media/n).stat().st_size for n in atlases),'bytes;',decoded_bytes,'decoded bytes')
