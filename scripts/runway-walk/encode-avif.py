"""Build smaller AVIF and WebP deliveries from the same high-quality input.

All files are staged and validated before installation. Native generation
receipts and original pixels remain in cache/Git. Requires Pillow + avifenc.
"""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import argparse
import json
import shutil
import subprocess
import tempfile
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'pages/runway-walk/assets/quality'
DEST = ROOT / 'pages/runway-walk/assets/quality-avif'


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    pending = path.with_suffix('.pending')
    pending.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    pending.replace(path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-ref')
    parser.add_argument('--cleanup-ref', help='Git ref containing the cleaned photographs')
    parser.add_argument('--width', type=int, default=640)
    args = parser.parse_args()
    if args.width < 256 or args.width > 768 or args.width % 2:
        parser.error('Width must be an even number from 256 to 768')
    size = (args.width, args.width * 3 // 2)
    recipe = dict(format='avif', colorQuality=50, alphaQuality=100, alphaStep=8,
                  speed=5, subsampling='444', resize=True, width=size[0], height=size[1],
                  resample='lanczos', fallbackQuality=80, fallbackMethod=4)
    original = json.loads((SOURCE / 'manifest.json').read_text())
    previous = json.loads((DEST / 'manifest.json').read_text())
    provenance = json.loads((SOURCE / 'provenance.json').read_text())
    cleaned = {r['index'] for r in provenance if r.get('cleanup')}
    sources = {r['index']: r for r in original['frames']}
    if previous.get('recipe') == recipe and original.get('deliveryResize', {}).get('recipe') == recipe:
        intact = len(previous['frames']) == len(sources) and all(
            r['fallbackSha256'] == sources[r['index']]['sha256']
            and digest(DEST / r['file']) == r['sha256']
            and digest(SOURCE / sources[r['index']]['file']) == r['fallbackSha256']
            for r in previous['frames'])
        if intact:
            print('This resolution is already installed; no repeated compression')
            return
    for reference in {args.source_ref, args.cleanup_ref} - {None}:
        referenced = json.loads(subprocess.check_output(
            ['git', 'show', f'{reference}:pages/runway-walk/assets/quality/manifest.json'], cwd=ROOT))
        if referenced['assetVersion'] != original['assetVersion']:
            raise ValueError('Git input belongs to a different photograph library')
    if args.cleanup_ref:
        records = json.loads(subprocess.check_output(
            ['git', 'show', f'{args.cleanup_ref}:pages/runway-walk/assets/quality/provenance.json'], cwd=ROOT))
        available = {r['index'] for r in records if r.get('cleanup')}
        if not cleaned.issubset(available):
            raise ValueError('The cleanup ref would restore previously removed objects')
    DEST.mkdir(exist_ok=True)
    cache = ROOT / f'.cache/runway-walk/delivery-{args.width}'
    cache.mkdir(parents=True, exist_ok=True)
    baseline = cache / 'baseline.json'
    if not baseline.exists():
        write_json(baseline, dict(webpBytes=sum((SOURCE / r['file']).stat().st_size for r in original['frames']),
                                  avifBytes=previous['bytes']))

    def encode(row):
        receipt = cache / f"{row['index']}.json"
        old = json.loads(receipt.read_text()) if receipt.exists() else {}
        current = SOURCE / row['file']
        current_sha = digest(current)
        if current_sha not in {row['sha256'], old.get('fallbackSha256')}:
            raise ValueError(f"Unexpected fallback photo {row['index']}")
        reference = args.cleanup_ref if row['index'] in cleaned else args.source_ref
        if reference:
            source_bytes = subprocess.check_output(['git', 'show', f"{reference}:pages/runway-walk/assets/quality/{row['file']}"], cwd=ROOT)
        else:
            source_bytes = current.read_bytes()
        input_sha = sha256(source_bytes).hexdigest()
        avif = cache / f"{row['index']}.avif"
        webp = cache / row['file']
        if (old.get('recipe') == recipe and old.get('inputSha256') == input_sha and avif.exists() and webp.exists()
                and digest(avif) == old.get('sha256') and digest(webp) == old.get('fallbackSha256')):
            return old
        with Image.open(BytesIO(source_bytes)) as source:
            source_size = source.size
            if source.width < size[0] or source.height < size[1]:
                raise ValueError('Do not enlarge a low-resolution source')
            # The renderer already uses a canonical 2:3 portrait rectangle.
            image = source.convert('RGBA').resize(size, Image.Resampling.LANCZOS)
            alpha = image.getchannel('A')
            image.save(webp, 'WEBP', quality=recipe['fallbackQuality'], method=recipe['fallbackMethod'], exact=True)
            with Image.open(webp) as result:
                if result.size != size or result.getchannel('A').tobytes() != alpha.tobytes():
                    raise ValueError('WebP changed the resized alpha')
            step = recipe['alphaStep']
            image.putalpha(alpha.point([min(255, round(a / step) * step) for a in range(256)]))
            with tempfile.TemporaryDirectory(dir=cache) as directory:
                png = Path(directory) / 'input.png'
                encoded = Path(directory) / 'output.avif'
                image.save(png)
                subprocess.run(['avifenc', '-s', str(recipe['speed']), '-j', '1',
                                '--qcolor', str(recipe['colorQuality']), '--qalpha', str(recipe['alphaQuality']),
                                '-y', recipe['subsampling'], '--cicp', '1/13/6', str(png), str(encoded)],
                               check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                with Image.open(encoded) as result:
                    if result.size != size:
                        raise ValueError('AVIF dimensions do not match the selected delivery')
                    error = ImageChops.difference(alpha, result.getchannel('A')).getextrema()[1]
                    if error > step // 2 or result.getchannel('A').tobytes() != image.getchannel('A').tobytes():
                        raise ValueError('AVIF alpha error exceeds the rounding bound')
                encoded.replace(avif)
            saved = dict(index=row['index'], file=avif.name, sha256=digest(avif), fallbackSha256=digest(webp),
                         inputSha256=input_sha, inputReference=reference, sourceWidth=source_size[0], sourceHeight=source_size[1],
                         width=size[0], height=size[1], alphaMaxError=error, bytes=avif.stat().st_size, recipe=recipe)
            write_json(receipt, saved)
            return saved

    rows = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for done, row in enumerate(pool.map(encode, original['frames']), 1):
            rows.append(row)
            if done % 250 == 0:
                print(f'{done}/{len(original["frames"])} validated; {sum(r["bytes"] for r in rows):,} AVIF bytes', flush=True)
    # Keep staged copies for safe resume if installation is interrupted.
    for row in rows:
        for staged, target in [(cache / row['file'], DEST / row['file']),
                               (cache / sources[row['index']]['file'], SOURCE / sources[row['index']]['file'])]:
            pending = target.with_suffix('.pending')
            shutil.copyfile(staged, pending)
            pending.replace(target)
        sources[row['index']]['sha256'] = row['fallbackSha256']
    webp_bytes = sum((SOURCE / r['file']).stat().st_size for r in original['frames'])
    avif_bytes = sum(r['bytes'] for r in rows)
    original['deliveryResize'] = dict(recipe=recipe, before=json.loads(baseline.read_text()), webpBytes=webp_bytes, avifBytes=avif_bytes)
    write_json(SOURCE / 'manifest.json', original)
    write_json(DEST / 'manifest.json', dict(assetVersion=original['assetVersion'], recipe=recipe,
                                          bytes=avif_bytes, fallbackBytes=webp_bytes, frames=rows))
    print(f'Installed {size[0]}x{size[1]}: AVIF {avif_bytes:,}; WebP {webp_bytes:,} bytes', flush=True)


if __name__ == '__main__':
    main()
