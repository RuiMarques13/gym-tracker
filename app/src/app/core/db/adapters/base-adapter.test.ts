import { describe, expect, it } from 'vitest';
import { createEmptyDb } from '../../testing/test-db';

describe('transações do adaptador', () => {
  it('faz rollback quando a função falha', async () => {
    const db = await createEmptyDb();
    await db.exec('CREATE TABLE t (v INTEGER);');
    await expect(
      db.transaction(async (tx) => {
        await tx.run('INSERT INTO t VALUES (1)');
        throw new Error('falhou');
      }),
    ).rejects.toThrow('falhou');
    expect(await db.query('SELECT * FROM t')).toEqual([]);
  });

  it('transações encadeadas reutilizam a exterior', async () => {
    const db = await createEmptyDb();
    await db.exec('CREATE TABLE t (v INTEGER);');
    await db.transaction(async (tx) => {
      await tx.run('INSERT INTO t VALUES (1)');
      await tx.transaction(async (inner) => inner.run('INSERT INTO t VALUES (2)'));
    });
    expect(await db.query('SELECT v FROM t ORDER BY v')).toEqual([{ v: 1 }, { v: 2 }]);
  });

  it('operações em paralelo não entram a meio de uma transação', async () => {
    const db = await createEmptyDb();
    await db.exec('CREATE TABLE t (v INTEGER);');
    let seenInside = -1;
    const tx = db.transaction(async (t) => {
      await t.run('INSERT INTO t VALUES (1)');
      await new Promise((r) => setTimeout(r, 10));
      await t.run('INSERT INTO t VALUES (2)');
    });
    const read = db.query<{ n: number }>('SELECT COUNT(*) AS n FROM t').then((r) => (seenInside = r[0].n));
    await Promise.all([tx, read]);
    expect(seenInside).toBe(2);
  });
});
