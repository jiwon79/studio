"""Resume the authorized +45° quality edit through the Higgsfield CLI.

Authentication remains in the CLI. Native outputs and job receipts stay in the
ignored cache; the published manifest records provenance and optimized assets.
"""
import argparse
import concurrent.futures
import hashlib
import importlib.util
import json
import subprocess
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / 'pages/runway-walk'
CACHE = ROOT / '.cache/runway-walk/higgsfield-45'
DEST = PAGE / 'assets/higgsfield-quality-45'
PROMPT = (
    'Restore only the supplied runway photograph: improve photographic clarity, '
    'remove compression noise, recover fabric and hair detail conservatively, '
    'and clean the transparent cutout edges. This is a precisely timed walking '
    'animation frame, not a new pose or camera angle. Preserve the exact original '
    'silhouette, body lean, head location and size, face orientation, shoulders, '
    'hips, hands, knees, ankles, heels and toe positions in normalized image '
    'coordinates. Preserve anatomical left/right identity, leg overlap, depth '
    'order and shoe orientation. Do not extend or shorten legs, move shoes, '
    'invent hidden limbs, straighten the body, or alter the walking phase. '
    'Keep the identical outfit, colors, garment shape, hairstyle, accessories '
    'and lighting shown in THIS photograph. Preserve all empty margins and the '
    'same person scale and framing. Genuine transparent background and accurate '
    'alpha, no scenery, floor, cast shadow, halo, border, text or checkerboard. '
    'Output one portrait 2:3 photograph. Quality restoration only.'
)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def library():
    data = json.loads((PAGE / 'angles.json').read_text())
    schedule = json.loads((PAGE / 'reference-schedule.json').read_text())['directions']['45']
    triples = [([e, e + 1, e + 2] if isinstance(e, int) else e) for e in schedule]
    return data, triples, list(dict.fromkeys(i for entry in triples for i in entry))


def source(data, index):
    path = CACHE / 'input' / f'{index}.png'
    path.parent.mkdir(parents=True, exist_ok=True)
    row = data['frames'][index]
    x = row['tile'] % data['columns'] * data['tileWidth']
    y = row['tile'] // data['columns'] * data['tileHeight']
    with Image.open(PAGE / 'media/angles' / data['atlases'][row['atlas']]) as image:
        image.crop((x, y, x + data['tileWidth'], y + data['tileHeight'])).save(path)
    return path


def job(index):
    receipt = CACHE / f'{index}-job.json'
    if not receipt.exists() or not receipt.stat().st_size:
        return None
    value = json.loads(receipt.read_text())
    row = value[0] if isinstance(value, list) else value
    return row if row.get('status') == 'completed' and row.get('result_url') else None


def generate(data, index):
    original = source(data, index)
    fingerprint = CACHE / f'{index}-input.json'
    expected = dict(assetVersion=data['assetVersion'], originalSha256=sha(original))
    if fingerprint.exists() and json.loads(fingerprint.read_text()) != expected:
        raise ValueError(f'{index}: source changed; do not reuse or overwrite its generation')
    # The three initial trial jobs predate this queue; validate their provenance.
    old = json.loads((DEST / 'manifest.json').read_text())
    existing = next((r for r in old['frames'] if r['index'] == index), None)
    if not fingerprint.exists() and existing:
        if old['assetVersion'] != data['assetVersion'] or existing['originalInputSha256'] != sha(original):
            raise ValueError(f'{index}: trial source differs')
    fingerprint.write_text(json.dumps(expected))
    if not job(index):
        receipt = CACHE / f'{index}-job.json'
        if receipt.exists() and receipt.stat().st_size:
            raise ValueError(f'{index}: inspect non-completed receipt before retrying')
        errors_path = CACHE / f'{index}-error.log'
        if receipt.exists() and not (errors_path.exists() and 'failed to PUT media bytes' in errors_path.read_text()):
            raise ValueError(f'{index}: recover any submitted job before retrying an empty receipt')
        with receipt.open('w') as output, (CACHE / f'{index}-error.log').open('w') as errors:
            subprocess.run([
                'higgsfield', 'generate', 'create', 'gpt_image_2_5',
                '--image', str(original), '--prompt', PROMPT,
                '--aspect_ratio', '2:3', '--background', 'transparent',
                '--quality', 'high', '--resolution', '2k',
                '--wait', '--wait-timeout', '20m', '--json',
            ], stdout=output, stderr=errors, check=True, timeout=1300)
    result = job(index)
    if not result:
        raise ValueError(f'{index}: generation did not complete')
    native = CACHE / f'{index}.png'
    if not native.exists():
        temporary = native.with_suffix('.part')
        urllib.request.urlretrieve(result['result_url'], temporary)
        temporary.replace(native)
    with Image.open(native) as image:
        if image.mode != 'RGBA' or image.getchannel('A').getextrema()[0] != 0:
            raise ValueError(f'{index}: missing transparent alpha')
        if not image.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox():
            raise ValueError(f'{index}: empty person')
    return index


def stage(data, triples, indices, workers=6):
    spec = importlib.util.spec_from_file_location('quality_jobs', ROOT / 'scripts/runway-walk/quality-jobs.py')
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    manifest = dict(assetVersion=data['assetVersion'], tool='Higgsfield API', model='gpt_image_2_5',
                    purpose='quality-only, original photograph only; no pose or angle correction',
                    status='complete +45 degree library; enabled with original comparison toggle',
                    additionalTarget=len(indices), generated=len(indices), frames=[], groups=[])
    def photograph(index):
        result = job(index)
        original = source(data, index)
        native = CACHE / f'{index}.png'
        fingerprint = json.loads((CACHE / f'{index}-input.json').read_text())
        if not result or fingerprint != dict(assetVersion=data['assetVersion'], originalSha256=sha(original)):
            raise ValueError(f'{index}: incomplete or outdated job')
        image = Image.open(native)
        dimensions = list(image.size)
        image.thumbnail((1024, 1536), Image.Resampling.LANCZOS)
        playback = f'{index}-playback.webp'
        image.save(DEST / playback, quality=92, method=4, exact=True)
        Image.open(original).save(DEST / f'{index}-original.webp', lossless=True, exact=True)
        row = data['frames'][index]
        published = dict(
            index=index, group=45, source=row['source'], sourceFrame=row['sourceFrame'],
            original=f'{index}-original.webp', edited=playback,
            originalInputSha256=sha(original), generatedPngSha256=sha(native),
            editedSha256=sha(DEST / playback), qualityRegistration=helper.quality_registration(original, native),
            jobId=result['id'], resultUrl=result['result_url'], dimensions=dimensions,
            playbackDimensions=list(image.size),
            parameters={k: v for k, v in result['params'].items() if k != 'medias'},
        )
        previous = CACHE / 'history' / str(index) / f'{index}-job.json'
        if previous.exists():
            old = json.loads(previous.read_text())[0]
            published['previousVersions'] = [dict(
                jobId=old['id'], resultUrl=old['result_url'],
                generatedPngSha256=sha(previous.parent / f'{index}.png'),
                prompt=old['params']['prompt'], status='superseded after source-framing review',
            )]
        return published
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        manifest['frames'] = list(executor.map(photograph, indices))
    unique = list(dict.fromkeys(tuple(e) for e in triples))
    manifest['groups'] = [dict(id='45' if position == 0 else '45:' + ':'.join(map(str, e)),
                               label=f'+45° · 사진 {", ".join(map(str, e))}', indices=list(e))
                          for position, e in enumerate(unique)]
    path = DEST / 'manifest.json'
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)
    print(f'Staged {len(indices)} photographs', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['generate', 'stage'])
    parser.add_argument('--workers', type=int, default=6)
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    data, triples, indices = library()
    if args.command == 'stage':
        stage(data, triples, indices, args.workers)
        return
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(generate, data, index): index for index in indices}
        for complete, future in enumerate(concurrent.futures.as_completed(futures), 1):
            index = futures[future]
            try:
                future.result()
                print(f'{complete}/{len(indices)} ready: {index}', flush=True)
            except Exception as error:
                failures.append(index)
                print(f'{complete}/{len(indices)} FAILED: {index}: {type(error).__name__}; inspect its error log', flush=True)
    if failures:
        raise SystemExit(f'Inspect failed jobs before retrying: {failures}')


if __name__ == '__main__':
    main()
