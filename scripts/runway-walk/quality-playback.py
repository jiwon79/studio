"""Prepare compact playback derivatives without replacing native GPT edits."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
FOLDERS = [ROOT / 'pages/runway-walk/assets' / name for name in
           ['higgsfield-quality-45', 'higgsfield-quality', 'gpt-quality']]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare_library(folder):
    path = folder / 'manifest.json'
    manifest = json.loads(path.read_text())
    def prepare(row):
        source = folder / row['edited']
        if sha(source) != row['editedSha256']:
            raise ValueError(f"Changed source: {row['index']}")
        name = source.stem + '-playback-768.webp'
        target = folder / name
        if not (target.exists() and sha(target) == row.get('playbackSha256')):
            with Image.open(source) as image:
                image.thumbnail((768, 1152), Image.Resampling.LANCZOS)
                image.save(target, quality=92, method=4, exact=True)
        return {**row, 'playback': name, 'playbackSha256': sha(target)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        manifest['frames'] = list(pool.map(prepare, manifest['frames']))
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)
    print(f"Prepared {len(manifest['frames'])} playback photographs in {folder.name}")


def main():
    for folder in FOLDERS:
        prepare_library(folder)


if __name__ == '__main__':
    main()
