import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

test('the CLI queue stops on credit failure and retries only a known pre-submit upload failure', () => {
  const result = execFileSync('python3', ['-c', `
import importlib.util,json,tempfile
from pathlib import Path
from types import SimpleNamespace
s=importlib.util.spec_from_file_location('queue', 'scripts/runway-walk/higgsfield-all-quality.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
m.time.sleep=lambda _:None
with tempfile.TemporaryDirectory() as folder:
 m.CACHE=Path(folder);calls=[]
 def credit(data,index):
  calls.append(index)
  (m.CACHE/f'{index}-error.log').write_text('HTTP 402: insufficient credits')
  raise RuntimeError('credit limit')
 m.module=lambda:SimpleNamespace(generate=credit)
 m.generate({},[1,2,3],1)
 summary=json.loads((m.CACHE/'progress.json').read_text())
 assert summary['stopped'] and summary['failed']==[1] and calls==[1]
 calls=[]
 def upload(data,index):
  calls.append(index)
  if len(calls)==1:
   (m.CACHE/f'{index}-error.log').write_text('failed to PUT media bytes to upload_url: 520')
   raise RuntimeError('upload failed')
 m.module=lambda:SimpleNamespace(generate=upload)
 m.generate({},[1,2],1)
 summary=json.loads((m.CACHE/'progress.json').read_text())
 assert not summary['stopped'] and summary['ready']==2 and calls==[1,1,2]
 print('queue safeguards passed')
`], { cwd: process.cwd(), encoding: 'utf8' });
  expect(result).toContain('queue safeguards passed');
});
