"""Generate the remaining angle library with resumable Higgsfield CLI jobs.

Only complete directions are promoted. A billing/authentication failure stops
the queue before more requests are sent; this script never purchases credits.
"""
import argparse
import concurrent.futures
import importlib.util
import json
import threading
import time
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / 'pages/runway-walk'
CACHE = ROOT / '.cache/runway-walk/higgsfield-quality'
DEST = PAGE / 'assets/higgsfield-quality'
LEGACY = PAGE / 'assets/higgsfield-quality-45/manifest.json'


def module():
    spec = importlib.util.spec_from_file_location('higgsfield_single_direction', ROOT / 'scripts/runway-walk/higgsfield-quality.py')
    worker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(worker)
    worker.CACHE = CACHE
    worker.DEST = DEST
    return worker


def inventory():
    data = json.loads((PAGE / 'angles.json').read_text())
    raw = json.loads((PAGE / 'reference-schedule.json').read_text())['directions']
    directions = {int(a): [([e, e + 1, e + 2] if isinstance(e, int) else e) for e in entries] for a, entries in raw.items()}
    old = json.loads(LEGACY.read_text())
    if old['assetVersion'] != data['assetVersion']:
        raise ValueError('Existing Higgsfield photographs use an outdated library')
    done = {r['index'] for r in old['frames']}
    # Finish the default front view first; then expand out from the already
    # approved +45 view before processing the remaining directions.
    order = [0] + sorted((a for a in directions if a != 0), key=lambda a: (abs(a - 45), a))
    indices = list(dict.fromkeys(i for a in order for entry in directions[a] for i in entry if i not in done))
    return data, directions, indices


def setup(data):
    CACHE.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    path = DEST / 'manifest.json'
    if not path.exists():
        path.write_text(json.dumps(dict(assetVersion=data['assetVersion'], tool='Higgsfield API', model='gpt_image_2_5',
                                       generated=0, additionalTarget=2876, completeDirections=[], frames=[], groups=[]), indent=2) + '\n')


def generate(data, indices, workers):
    worker = module()
    queue = deque(indices)
    lock = threading.Lock()
    stopped = threading.Event()
    failures = []
    results = []
    reason = []
    def run():
        while not stopped.is_set():
            with lock:
                if not queue or stopped.is_set():
                    return
                index = queue.popleft()
            try:
                for attempt in range(3):
                    try:
                        worker.generate(data, index)
                        break
                    except Exception:
                        log = CACHE / f'{index}-error.log'
                        if attempt == 2 or not log.exists() or 'failed to PUT media bytes' not in log.read_text():
                            raise
                        time.sleep(2 * (attempt + 1))
                with lock:
                    results.append(index)
                    print(f'{len(results)}/{len(indices)} ready: {index}', flush=True)
            except Exception as error:
                log = CACHE / f'{index}-error.log'
                detail = log.read_text() if log.exists() else str(error)
                with lock:
                    failures.append(index)
                    print(f'FAILED {index}: {type(error).__name__}; inspect its error log', flush=True)
                    if any(word in detail.lower() for word in ['credit', 'balance', 'payment', '402', 'not authenticated', 'session expired', '401', '403']):
                        reason.append(detail)
                        stopped.set()
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        list(executor.map(lambda _: run(), range(workers)))
    summary = dict(ready=len(results), target=len(indices), failed=failures, stopped=stopped.is_set(), reasons=reason)
    (CACHE / 'progress.json').write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary), flush=True)


def stage(data, directions, indices, workers):
    worker = module()
    ready = [i for i in indices if worker.job(i) and (CACHE / f'{i}.png').exists()]
    if ready:
        worker.stage(data, [], ready, workers)
    path = DEST / 'manifest.json'
    manifest = json.loads(path.read_text())
    legacy = json.loads(LEGACY.read_text())
    published = {r['index'] for r in manifest['frames']} | {r['index'] for r in legacy['frames']}
    for row in manifest['frames']:
        row['angles'] = [a for a, entries in directions.items() if any(row['index'] in e for e in entries)]
        row['group'] = row['angles'][0]
    complete = [a for a, entries in directions.items() if all(i in published for e in entries for i in e)]
    manifest.update(additionalTarget=len(indices), generated=len(ready), completeDirections=sorted(complete),
                    status='partial' if len(complete) < len(directions) else 'complete', groups=[])
    for angle, entries in directions.items():
        if angle not in complete or angle == 45:
            continue
        unique = list(dict.fromkeys(tuple(e) for e in entries))
        manifest['groups'] += [dict(id=f'{angle}:' + ':'.join(map(str, e)), label=f'{angle:+d}° · 사진 {e[0]}', indices=list(e)) for e in unique]
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Published {len(ready)} additional photographs; complete angles: {sorted(complete)}', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['generate', 'stage', 'inventory'])
    parser.add_argument('--workers', type=int, default=6)
    args = parser.parse_args()
    data, directions, indices = inventory()
    setup(data)
    if args.command == 'inventory':
        print(json.dumps(dict(target=len(indices), directions=len(directions))))
    elif args.command == 'generate':
        generate(data, indices, args.workers)
    else:
        stage(data, directions, indices, args.workers)


if __name__ == '__main__':
    main()
