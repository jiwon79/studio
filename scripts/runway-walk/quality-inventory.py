"""Deduplicate the selected photographs across API and built-in GPT results."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / 'pages/runway-walk'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--angle', type=int)
    parser.add_argument('--limit', type=int, default=12)
    args = parser.parse_args()
    data = json.loads((PAGE / 'angles.json').read_text())
    raw = json.loads((PAGE / 'reference-schedule.json').read_text())['directions']
    directions = {int(a): list(dict.fromkeys(i for e in rows for i in ([e, e + 1, e + 2] if isinstance(e, int) else e))) for a, rows in raw.items()}
    generated = set()
    for folder in ['higgsfield-quality-45', 'higgsfield-quality', 'gpt-quality']:
        library = json.loads((PAGE / 'assets' / folder / 'manifest.json').read_text())
        if library['assetVersion'] != data['assetVersion']:
            raise ValueError(f'Outdated quality library: {folder}')
        generated.update(r['index'] for r in library['frames'])
    order = sorted(directions, key=lambda a: (abs(a - 45), a))
    selected = directions[args.angle] if args.angle is not None else list(dict.fromkeys(i for a in order for i in directions[a]))
    pending = [i for i in selected if i not in generated]
    failures = ROOT / '.cache/runway-walk/gpt-quality/failures'
    blocked = {row['index'] for file in failures.glob('*.json')
               if (row := json.loads(file.read_text())).get('assetVersion') == data['assetVersion']
               and row.get('status') == 'moderation_blocked'}
    originals = json.loads((PAGE / 'quality-originals.json').read_text())
    if originals['assetVersion'] == data['assetVersion']:
        blocked.update(originals['frames'])
    actionable = [i for i in pending if i not in blocked]
    total = set(i for photos in directions.values() for i in photos)
    summary = dict(total=len(total), generated=len(total & generated), remaining=len(total - generated),
                   completePhotoCoverage=sorted(a for a, ids in directions.items() if all(i in generated for i in ids)),
                   selectedAngle=args.angle, selectedRemaining=len(pending),
                   selectedBlocked=[i for i in pending if i in blocked],
                   blocked=len(total & blocked), next=actionable[:args.limit])
    target = ROOT / '.cache/runway-walk/gpt-quality/combined-inventory.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({**summary, 'pending': actionable}, indent=2) + '\n')
    print(json.dumps(summary))


if __name__ == '__main__':
    main()
