"""Restore the selected pre-enhancement photographs without changing pixels."""
from pathlib import Path
from hashlib import sha256
import json
import subprocess

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / 'pages/runway-walk'
REFERENCE = 'c8d352ef'

def main():
    current = json.loads((PAGE / 'assets/quality/manifest.json').read_text())
    sources = {}
    for folder in ['higgsfield-quality-45', 'higgsfield-quality', 'gpt-quality']:
        prefix = f'pages/runway-walk/assets/{folder}/'
        old = json.loads(subprocess.check_output(['git', 'show', REFERENCE + ':' + prefix + 'manifest.json'], cwd=ROOT))
        if old['assetVersion'] != current['assetVersion']:
            raise ValueError('Original library is from a different source collection')
        for row in old['frames']:
            sources[row['index']] = prefix + row['original']
    if any(row['index'] not in sources for row in current['frames']):
        raise ValueError('Missing pre-enhancement photographs')
    destination = PAGE / 'assets/quality-original'
    destination.mkdir(exist_ok=True)
    rows = []
    process = subprocess.Popen(['git', 'cat-file', '--batch'], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    try:
        for row in current['frames']:
            path = sources[row['index']]
            process.stdin.write((REFERENCE + ':' + path + '\n').encode()); process.stdin.flush()
            header = process.stdout.readline().decode().split()
            if len(header) != 3 or header[1] != 'blob':
                raise ValueError(f'Original blob missing: {path}')
            content = process.stdout.read(int(header[2]))
            if process.stdout.read(1) != b'\n':
                raise ValueError('Invalid Git blob boundary')
            filename = f"{row['index']}.webp"
            (destination / filename).write_bytes(content)
            rows.append(dict(index=row['index'], file=filename, sha256=sha256(content).hexdigest(),
                             originRef=REFERENCE, originPath=path, bytes=len(content)))
    finally:
        process.stdin.close(); process.wait()
    (destination / 'manifest.json').write_text(json.dumps(dict(assetVersion=current['assetVersion'],
        purpose='Unmodified pre-enhancement photographs for frame-matched comparison',
        bytes=sum(row['bytes'] for row in rows), frames=rows), indent=2) + '\n')
    print('Restored', len(rows), 'original photos;', sum(row['bytes'] for row in rows), 'bytes')

if __name__ == '__main__':
    main()
