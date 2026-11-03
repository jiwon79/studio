"""Download and verify the pinned official SAM2.1 instance segmentation model."""
import argparse, hashlib, json
from pathlib import Path
from huggingface_hub import snapshot_download
from instance import REPO, REVISION, FILES

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache',type=Path,required=True)
args=parser.parse_args()
root=args.cache/'sam2-tiny'
snapshot_download(REPO,revision=REVISION,local_dir=root,allow_patterns=list(FILES))
for name,checksum in FILES.items():
    assert hashlib.sha256((root/name).read_bytes()).hexdigest()==checksum,name
(root/'provenance.json').write_text(json.dumps({'repo':REPO,'revision':REVISION,'files':FILES}))
print('Verified',REPO,REVISION)
