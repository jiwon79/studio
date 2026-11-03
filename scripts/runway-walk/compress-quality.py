"""One-time WebP optimization of the final edit, without resizing or alpha loss.

Validate every staged file before replacing runtime photos. Re-running the same
recipe is a no-op to avoid accumulating lossy compression generations.
"""
from concurrent.futures import ProcessPoolExecutor
from hashlib import sha256
from pathlib import Path
import json
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
LIBRARY = ROOT / 'pages/runway-walk/assets/quality'
RECIPE = dict(format='webp', quality=80, method=4, alpha='lossless', resize=False)


def encode(job):
    row, directory = job
    source = LIBRARY / row['file']
    original = source.read_bytes()
    if sha256(original).hexdigest() != row['sha256']:
        raise ValueError(f"Unexpected input: {row['index']}")
    target = Path(directory) / row['file']
    with Image.open(source) as image:
        image.load()
        image.save(target, 'WEBP', quality=RECIPE['quality'], method=RECIPE['method'], exact=True)
        with Image.open(target) as result:
            if result.size != image.size or result.getchannel('A').tobytes() != image.getchannel('A').tobytes():
                raise ValueError(f"Dimensions or alpha changed: {row['index']}")
    optimized = target.read_bytes()
    # Keep an already efficient file rather than increasing its size.
    if len(optimized) >= len(original):
        target.write_bytes(original)
        optimized = original
    return row['index'], sha256(optimized).hexdigest(), len(original), len(optimized)


def main():
    path = LIBRARY / 'manifest.json'
    manifest = json.loads(path.read_text())
    if manifest.get('compression'):
        if manifest['compression']['recipe'] != RECIPE:
            raise ValueError('Start a different recipe from the prior Git version, not recompressed images')
        print('This recipe is already applied; photos left unchanged')
        return
    cache = ROOT / '.cache/runway-walk'
    cache.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='webp-', dir=cache) as staging:
        with ProcessPoolExecutor(max_workers=4) as pool:
            results = []
            for done, result in enumerate(pool.map(encode, ((row, staging) for row in manifest['frames'])), 1):
                results.append(result)
                if done % 250 == 0:
                    print(f'{done}/{len(manifest["frames"])} validated', flush=True)
        by_index = {row['index']: row for row in manifest['frames']}
        before = after = 0
        for index, digest, old_size, new_size in results:
            row = by_index[index]
            (Path(staging) / row['file']).replace(LIBRARY / row['file'])
            row['sha256'] = digest
            before += old_size
            after += new_size
        manifest['compression'] = dict(recipe=RECIPE, beforeBytes=before, afterBytes=after)
        pending = path.with_suffix('.tmp')
        pending.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        pending.replace(path)
        print(f'{before:,} -> {after:,} bytes ({(1-after/before)*100:.1f}% smaller)', flush=True)


if __name__ == '__main__':
    main()
