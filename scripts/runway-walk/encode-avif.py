"""Resumable full-resolution AVIF derivatives with bounded alpha rounding.

Requires Pillow and libavif's avifenc. WebP remains the compatibility source.
An optional Git source ref avoids transcoding already-compressed RGB twice;
locally cleaned photographs always use their current source pixels.
"""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import argparse
import json
import subprocess
import tempfile
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'pages/runway-walk/assets/quality'
DEST = ROOT / 'pages/runway-walk/assets/quality-avif'
RECIPE = dict(format='avif', colorQuality=50, alphaQuality=100, alphaStep=8,
              speed=5, subsampling='444', resize=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-ref')
    args = parser.parse_args()
    original = json.loads((SOURCE / 'manifest.json').read_text())
    provenance = json.loads((SOURCE / 'provenance.json').read_text())
    cleaned = {r['index'] for r in provenance if r.get('cleanup')}
    DEST.mkdir(exist_ok=True)
    cache = ROOT / '.cache/runway-walk/avif'
    cache.mkdir(parents=True, exist_ok=True)

    def encode(row):
        current_bytes = (SOURCE / row['file']).read_bytes()
        if sha256(current_bytes).hexdigest() != row['sha256']:
            raise ValueError(f"Unexpected fallback photo {row['index']}")
        source_bytes = current_bytes
        if args.source_ref and row['index'] not in cleaned:
            source_bytes = subprocess.check_output(['git', 'show', f"{args.source_ref}:pages/runway-walk/assets/quality/{row['file']}"], cwd=ROOT)
        digest = sha256(source_bytes).hexdigest()
        output = DEST / f"{row['index']}.avif"
        receipt = cache / f"{row['index']}.json"
        if receipt.exists() and output.exists():
            old = json.loads(receipt.read_text())
            if (old.get('recipe') == RECIPE and old.get('inputSha256') == digest
                    and old.get('fallbackSha256') == row['sha256']
                    and old.get('sha256') == sha256(output.read_bytes()).hexdigest()):
                return old
        with Image.open(BytesIO(source_bytes)) as source, Image.open(BytesIO(current_bytes)) as fallback:
            image = source.convert('RGBA')
            if image.size != fallback.size or image.getchannel('A').tobytes() != fallback.getchannel('A').tobytes():
                raise ValueError(f"Prior source does not match final silhouette {row['index']}")
            alpha = image.getchannel('A')
            image.putalpha(alpha.point([min(255, round(a / 8) * 8) for a in range(256)]))
            with tempfile.TemporaryDirectory(dir=cache) as directory:
                png = Path(directory) / 'input.png'
                encoded = Path(directory) / 'output.avif'
                image.save(png)
                subprocess.run(['avifenc', '-s', '5', '-j', '1', '--qcolor', '50', '--qalpha', '100',
                                '-y', '444', '--cicp', '1/13/6', str(png), str(encoded)], check=True,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                with Image.open(encoded) as result:
                    if result.size != image.size:
                        raise ValueError('AVIF resized the photograph')
                    error = ImageChops.difference(alpha, result.getchannel('A')).getextrema()[1]
                    if error > 4:
                        raise ValueError('AVIF alpha error exceeds 4/255')
                    if result.getchannel('A').tobytes() != image.getchannel('A').tobytes():
                        raise ValueError('AVIF did not preserve the rounded alpha losslessly')
                encoded.replace(output)
            saved = dict(index=row['index'], file=output.name, sha256=sha256(output.read_bytes()).hexdigest(),
                         fallbackSha256=row['sha256'], inputSha256=digest, inputReference=args.source_ref if row['index'] not in cleaned else None,
                         width=image.width, height=image.height, alphaMaxError=error,
                         bytes=output.stat().st_size, recipe=RECIPE)
            receipt.write_text(json.dumps(saved, indent=2) + '\n')
            return saved

    rows = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for done, row in enumerate(pool.map(encode, original['frames']), 1):
            rows.append(row)
            if done % 250 == 0:
                print(f'{done}/{len(original["frames"])} validated; {sum(r["bytes"] for r in rows):,} bytes', flush=True)
    manifest = dict(assetVersion=original['assetVersion'], recipe=RECIPE,
                    bytes=sum(r['bytes'] for r in rows), fallbackBytes=sum((SOURCE / r['file']).stat().st_size for r in original['frames']), frames=rows)
    (DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'{manifest["fallbackBytes"]:,} -> {manifest["bytes"]:,} bytes', flush=True)


if __name__ == '__main__':
    main()
