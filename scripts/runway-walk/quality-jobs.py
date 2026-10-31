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
    parser.add_argument('command', choices=['inventory', 'extract', 'record', 'reject'])
    parser.add_argument('indices', type=int, nargs='*')
    parser.add_argument('--output', type=Path, help='Native built-in generation output to record')
    parser.add_argument('--prompt-file', type=Path, help='Exact prompt used for this result')
    parser.add_argument('--reason', help='Required rejection reason')
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
    (CACHE / 'inventory.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({state: sum(j['status'] == state for j in plan['jobs'])
                      for state in ['existing-zero', 'generated-unreviewed', 'rejected', 'pending']}))


if __name__ == '__main__':
    main()
