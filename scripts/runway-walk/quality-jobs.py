"""Resumable inventory for the full-angle GPT quality-only restoration.

This does not call an image API or mark generated images as approved. Generation
uses the built-in image tool; each result needs pose/cutout and playback review.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/runway-walk/gpt-quality'
PAGE = ROOT / 'pages/runway-walk'
PROMPT = (
    'Use case: identity-preserve. Edit target: the supplied runway photograph. '
    'Restore image quality only: remove compression blocks, sharpen existing '
    'fabric/hair/shoe details conservatively, and clean transparent cutout edges '
    'without changing the person silhouette. Preserve exact normalized head, '
    'shoulder, hip, knee, ankle and toe positions; body lean; camera viewpoint '
    'and facing angle; anatomical left/right identity; shoe orientation and '
    'overlap/occlusion. Same 2:3 portrait framing, person scale, outfit and colors. '
    'Do not correct posture or gait, invent hidden limbs, change depth, or add '
    'accessories. No mannequin or pose reference. Genuine transparent alpha '
    'background, no floor, shadow, text. Photographic restoration only.'
)


def inventory():
    data = json.loads((PAGE / 'angles.json').read_text())
    schedule = json.loads((PAGE / 'reference-schedule.json').read_text())['directions']
    restored = json.loads((PAGE / 'assets/gpt-zero/manifest.json').read_text())
    if restored['assetVersion'] != data['assetVersion']:
        raise ValueError('Existing restoration uses an outdated photo library')
    done = {r['index']: r for r in restored['frames']}
    uses = {}
    for angle, entries in schedule.items():
        for entry in entries:
            for index in ([entry, entry + 1, entry + 2] if isinstance(entry, int) else entry):
                uses.setdefault(index, set()).add(int(angle))
    jobs = []
    for index in sorted(uses):
        row = data['frames'][index]
        receipt = CACHE / 'jobs' / f'{index}.json'
        saved = json.loads(receipt.read_text()) if receipt.exists() else {}
        valid = saved.get('assetVersion') == data['assetVersion'] and saved.get('sourceFrame') == row['sourceFrame']
        jobs.append(dict(index=index, angles=sorted(uses[index]), source=row['source'],
                         sourceFrame=row['sourceFrame'], atlas=data['atlases'][row['atlas']],
                         tile=row['tile'], status='existing-zero' if index in done else
                         saved.get('status', 'generated-unreviewed') if valid else 'pending',
                         existing=done.get(index, {}).get('edited')))
    return data, dict(assetVersion=data['assetVersion'], scope='all selected photos in 37 angles',
                      tool='built-in GPT image editing', purpose='quality-only; no pose or angle edit',
                      prompt=PROMPT, jobs=jobs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['inventory', 'extract', 'record', 'reject', 'stage'])
    parser.add_argument('indices', type=int, nargs='*')
    parser.add_argument('--output', type=Path, help='Native built-in generation output to record')
    parser.add_argument('--prompt-file', type=Path, help='Exact prompt used for this result')
    parser.add_argument('--reason', help='Required rejection reason')
    parser.add_argument('--angle', type=int, help='Review group direction; stage only')
    args = parser.parse_args()
    data, plan = inventory()
    CACHE.mkdir(parents=True, exist_ok=True)
    if args.command == 'extract':
        from PIL import Image
        for index in args.indices:
            if index not in {job['index'] for job in plan['jobs']}:
                raise ValueError(f'Photo {index} is not used by the current edit')
            row = data['frames'][index]
            x = row['tile'] % data['columns'] * data['tileWidth']
            y = row['tile'] // data['columns'] * data['tileHeight']
            target = CACHE / 'input' / f'{index}.png'
            target.parent.mkdir(exist_ok=True)
            with Image.open(PAGE / 'media/angles' / data['atlases'][row['atlas']]) as im:
                im.crop((x, y, x + data['tileWidth'], y + data['tileHeight'])).save(target)
            print(target)
    elif args.command == 'record':
        if len(args.indices) != 1 or not args.output or not args.output.is_file():
            parser.error('record requires one index and a real --output file')
        index = args.indices[0]
        source = CACHE / 'input' / f'{index}.png'
        row = next(r for r in plan['jobs'] if r['index'] == index)
        receipt = {**row, 'assetVersion': data['assetVersion'], 'status': 'generated-unreviewed', 'nativeOutput': str(args.output.resolve()),
                   'originalSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                   'generatedSha256': hashlib.sha256(args.output.read_bytes()).hexdigest(),
                   'prompt': args.prompt_file.read_text() if args.prompt_file else PROMPT}
        target = CACHE / 'jobs' / f'{index}.json'
        target.parent.mkdir(exist_ok=True)
        if target.exists():
            prior = json.loads(target.read_text())
            if prior.get('generatedSha256') != receipt['generatedSha256']:
                history = CACHE / 'history' / f"{index}-{prior['generatedSha256'][:12]}.json"
                history.parent.mkdir(exist_ok=True)
                history.write_text(json.dumps(prior, ensure_ascii=False, indent=2) + '\n')
        target.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
        _, plan = inventory()
    elif args.command == 'reject':
        if len(args.indices) != 1 or not args.reason:
            parser.error('reject requires one index and --reason')
        target = CACHE / 'jobs' / f'{args.indices[0]}.json'
        receipt = json.loads(target.read_text())
        receipt.update(status='rejected', reason=args.reason)
        target.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
        _, plan = inventory()
    elif args.command == 'stage':
        if not args.indices or args.angle is None:
            parser.error('stage requires photo indices and --angle')
        from PIL import Image
        folder = PAGE / 'assets/gpt-quality'
        folder.mkdir(parents=True, exist_ok=True)
        metadata = json.loads((folder / 'manifest.json').read_text())
        if metadata['assetVersion'] != data['assetVersion']:
            raise ValueError('Review assets use an outdated photo library')
        frames = {r['index']: r for r in metadata['frames']}
        prompts = {r['index']: r for r in json.loads((folder / 'prompts.json').read_text())}
        if 'groups' not in metadata:
            metadata['groups'] = [dict(id=str(a), label=f'{a:+d}° · 첫 구간',
                                      indices=[r['index'] for r in frames.values() if r['group'] == a])
                                  for a in dict.fromkeys(r['group'] for r in frames.values())]
        for index in args.indices:
            row = json.loads((CACHE / 'jobs' / f'{index}.json').read_text())
            if row['assetVersion'] != data['assetVersion'] or row['status'] != 'generated-unreviewed':
                raise ValueError(f'Photo {index} has no current, reviewable generation')
            original = CACHE / 'input' / f'{index}.png'
            generated = Path(row['nativeOutput'])
            for file, expected in [(original, row['originalSha256']), (generated, row['generatedSha256'])]:
                if hashlib.sha256(file.read_bytes()).hexdigest() != expected:
                    raise ValueError(f'Input/result changed after generation: {file}')
            if index in frames and frames[index]['generatedPngSha256'] == row['generatedSha256']:
                continue
            edited_name = f'{index}.webp' if index not in frames else f"{index}-{row['generatedSha256'][:12]}.webp"
            for src, name in [(original, f'{index}-original.webp'), (generated, edited_name)]:
                with Image.open(src) as im:
                    if im.mode != 'RGBA' or im.getchannel('A').getextrema()[0] != 0:
                        raise ValueError(f'Expected genuine transparent RGBA: {src}')
                    im.save(folder / name, format='WEBP', lossless=True, exact=True)
            prior_versions = frames.get(index, {}).get('previousVersions', [])
            if index in frames:
                prior_versions = [*prior_versions, dict(file=frames[index]['edited'], generatedPngSha256=frames[index]['generatedPngSha256'], prompt=prompts[index]['prompt'])]
            frames[index] = dict(index=index, group=args.angle, source=row['source'],
                                 sourceFrame=row['sourceFrame'], original=f'{index}-original.webp', edited=edited_name,
                                 originalInputSha256=row['originalSha256'], generatedPngSha256=row['generatedSha256'],
                                 editedSha256=hashlib.sha256((folder / edited_name).read_bytes()).hexdigest())
            if prior_versions:
                frames[index]['previousVersions'] = prior_versions
            prompts[index] = dict(index=index, prompt=row['prompt'])
        key = f'{args.angle}:{args.indices[0]}'
        if not any(g['id'] == key for g in metadata['groups']):
            metadata['groups'].append(dict(id=key, label=f'{args.angle:+d}° · 사진 {args.indices[0]}', indices=args.indices))
        metadata.update(frames=list(frames.values()), generated=len(frames), status='partial; not applied to main artwork')
        (folder / 'manifest.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
        (folder / 'prompts.json').write_text(json.dumps(list(prompts.values()), ensure_ascii=False, indent=2) + '\n')
    (CACHE / 'inventory.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({state: sum(j['status'] == state for j in plan['jobs'])
                      for state in ['existing-zero', 'generated-unreviewed', 'rejected', 'pending']}))


if __name__ == '__main__':
    main()
