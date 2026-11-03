"""Download the pinned official BiRefNet lite model into the ignored cache."""
import argparse,hashlib,urllib.request
from pathlib import Path

REVISION='aa62cd87eafb9cc43056d08ef3615a14628b831d'
FILES={
 'config.json':'9dc8614fccddd40c601aeadc69b9db6dd820598179b2a2198492e6ffa016a824',
 'BiRefNet_config.py':'e7b8c2a74f6cea6a59553d517f71d47f2c1d90e670a13416af17c25fe2f3dc52',
 'birefnet.py':'af8568b5be406bf4d2a68a7ed6d72e40f73b37a1fb6fc9ebd71b5b3cbcd069c9',
 'model.safetensors':'4417d89795250e698c3cb0ae8df15743810065f646f48a694fdfa7ca052d0815',
}
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--cache',type=Path,required=True);args=parser.parse_args()
root=args.cache/'birefnet-torch';root.mkdir(parents=True,exist_ok=True)
for name,expected in FILES.items():
 path=root/name
 if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest()!=expected:
  pending=path.with_suffix(path.suffix+'.partial')
  urllib.request.urlretrieve(f'https://huggingface.co/ZhengPeng7/BiRefNet_lite/resolve/{REVISION}/{name}',pending)
  if hashlib.sha256(pending.read_bytes()).hexdigest()!=expected:raise ValueError(f'Checksum mismatch: {name}')
  pending.replace(path)
 print(name,'verified',flush=True)
