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

test('staging preserves previous candidates and rejects changed generation bytes', () => {
  const script = fileURLToPath(new URL('./quality-jobs.py', import.meta.url));
  const result = execFileSync('python3', ['-c', `
import importlib.util,json,sys,tempfile,hashlib
from pathlib import Path
from PIL import Image
spec=importlib.util.spec_from_file_location('quality_jobs',sys.argv[1])
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
 root=Path(tmp);m.PAGE=root/'page';m.CACHE=root/'cache'
 folder=m.PAGE/'assets/gpt-quality';folder.mkdir(parents=True)
 (m.PAGE/'assets/gpt-zero').mkdir()
 (m.CACHE/'input').mkdir(parents=True);(m.CACHE/'jobs').mkdir()
 def save(path,obj):path.write_text(json.dumps(obj))
 save(m.PAGE/'angles.json',dict(assetVersion='current',atlases=['a.webp'],frames=[dict(source='s',sourceFrame=0,atlas=0,tile=0)]))
 save(m.PAGE/'reference-schedule.json',dict(directions={'5':[[0]]}))
 save(m.PAGE/'assets/gpt-zero/manifest.json',dict(assetVersion='current',frames=[]))
 save(folder/'manifest.json',dict(assetVersion='current',frames=[],generated=0))
 save(folder/'prompts.json',[])
 original=m.CACHE/'input/0.png';Image.new('RGBA',(2,3),(0,0,0,0)).save(original)
 out=root/'generated.png';Image.new('RGBA',(2,3),(255,0,0,0)).save(out)
 def record(prompt):
  save(m.CACHE/'jobs/0.json',dict(assetVersion='current',status='generated-unreviewed',source='s',sourceFrame=0,nativeOutput=str(out),originalSha256=hashlib.sha256(original.read_bytes()).hexdigest(),generatedSha256=hashlib.sha256(out.read_bytes()).hexdigest(),prompt=prompt))
 def stage():sys.argv=['quality-jobs.py','stage','0','--angle','5'];m.main()
 record('first prompt');stage();before=(folder/'manifest.json').read_bytes();stage()
 assert before==(folder/'manifest.json').read_bytes()
 Image.new('RGBA',(2,3),(0,255,0,0)).save(out);record('second prompt');stage()
 row=json.loads((folder/'manifest.json').read_text())['frames'][0]
 assert row['edited']!='0.webp' and (folder/'0.webp').exists()
 assert row['previousVersions'][0]['file']=='0.webp'
 assert row['previousVersions'][0]['prompt']=='first prompt'
 out.write_bytes(b'corrupt')
 try:stage()
 except ValueError as error:assert 'changed after generation' in str(error)
 else:raise AssertionError('Changed output was accepted')
print('verified')
`, script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  expect(result).toContain('verified');
});
