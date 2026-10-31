import { expect, test } from 'vitest';
import { AtlasPool } from './atlas-pool';
test('decoded pages are bounded and recently used pages survive eviction', async () => {
  const closed: number[] = [];
  const pool = new AtlasPool(async (index: number) => ({ close: () => closed.push(index) }),2);
  await pool.load(0); await pool.load(1); pool.get(0); await pool.load(2);
  expect(pool.size).toBe(2); expect(closed).toEqual([1]); expect(pool.get(0)).toBeDefined(); expect(pool.get(1)).toBeUndefined();
});
test('concurrent decode requests share work and failed pages can retry', async () => {
  let attempts = 0;
  const pool = new AtlasPool(async () => { attempts++; if (attempts === 1) throw Error('decode'); return { close() {} }; });
  await expect(Promise.all([pool.load(0),pool.load(0)])).rejects.toThrow('decode');
  expect(attempts).toBe(1); await pool.load(0); expect(attempts).toBe(2);
});
test('current and scheduled pages survive an unrelated decode finishing late', async () => {
  const closed: number[] = [];
  const pool = new AtlasPool(async (index: number) => ({ close: () => closed.push(index) }), 2);
  await pool.load(0); await pool.load(1);
  pool.retain([0,1]);
  await pool.load(2);
  expect(pool.get(0)).toBeDefined(); expect(pool.get(1)).toBeDefined();
  expect(closed).toEqual([2]);
  pool.retain([1]); await pool.load(3);
  expect(pool.get(1)).toBeDefined(); expect(pool.size).toBe(2);
});
