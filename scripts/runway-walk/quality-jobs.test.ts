import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('quality inventory deduplicates shared angle photos and does not reuse stale generation receipts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'runway-quality-jobs-'));
  try {
    const page = join(dir, 'page'), cache = join(dir, 'cache');
    mkdirSync(join(page, 'assets/gpt-zero'), { recursive: true });
    mkdirSync(join(cache, 'jobs'), { recursive: true });
    const json = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value));
    json(join(page, 'angles.json'), { assetVersion: 'current', atlases: ['a.webp'], frames: [0, 1, 2, 3].map(i => ({ source: 'source', sourceFrame: i, atlas: 0, tile: i })) });
    json(join(page, 'reference-schedule.json'), { directions: { '0': [0], '5': [[1, 2, 3]], '10': [[1, 2, 3]] } });
    json(join(page, 'assets/gpt-zero/manifest.json'), { assetVersion: 'current', frames: [0, 1, 2].map(index => ({ index, edited: `${index}.webp` })) });
    const inventory = () => JSON.parse(execFileSync('python3', ['-c', `
import importlib.util,json,sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('quality_jobs',sys.argv[1])
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.PAGE=Path(sys.argv[2])/'page';m.CACHE=Path(sys.argv[2])/'cache'
print(json.dumps(m.inventory()[1]))
`, fileURLToPath(new URL('./quality-jobs.py', import.meta.url)), dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    const initial = inventory();
    expect(initial.jobs).toHaveLength(4);
    expect(initial.jobs.filter((r: { status: string }) => r.status === 'existing-zero')).toHaveLength(3);
    expect(initial.jobs[3]).toMatchObject({ index: 3, angles: [5, 10], status: 'pending' });
    json(join(cache, 'jobs/3.json'), { assetVersion: 'old', sourceFrame: 3, status: 'generated-unreviewed' });
    expect(inventory().jobs[3].status).toBe('pending');
    json(join(cache, 'jobs/3.json'), { assetVersion: 'current', sourceFrame: 3, status: 'rejected' });
    expect(inventory().jobs[3].status).toBe('rejected');
    json(join(page, 'assets/gpt-zero/manifest.json'), { assetVersion: 'old', frames: [] });
    expect(inventory).toThrow();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
