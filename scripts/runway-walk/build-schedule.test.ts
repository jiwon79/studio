import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {expect,test} from 'vitest';

test('a preliminary rebuild cannot overwrite an edit with reviewed identity cuts',()=>{
 const file='pages/runway-walk/reference-schedule.json';
 const before=readFileSync(file);
 const result=spawnSync(process.execPath,['scripts/runway-walk/build-schedule.mjs'],{encoding:'utf8',timeout:10000});
 expect(result.status).not.toBe(0);
 expect(result.stderr).toContain('Export candidates to a separate output path');
 expect(readFileSync(file).equals(before)).toBe(true);
});
