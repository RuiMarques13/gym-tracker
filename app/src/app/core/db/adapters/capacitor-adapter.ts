import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { SqlValue } from '../db-adapter';
import { BaseAdapter } from './base-adapter';

export const DB_NAME = 'gymtracker';

/**
 * Adaptador para @capacitor-community/sqlite.
 * Android: SQLite nativo. Browser: jeep-sqlite (sql.js + IndexedDB);
 * aí cada escrita é seguida de saveToStore para não perder dados.
 */
export class CapacitorSqliteAdapter extends BaseAdapter {
  private constructor(
    private readonly sqlite: SQLiteConnection,
    private readonly db: SQLiteDBConnection,
    private readonly isWeb: boolean,
  ) {
    super();
  }

  static async open(): Promise<CapacitorSqliteAdapter> {
    const isWeb = Capacitor.getPlatform() === 'web';
    const sqlite = new SQLiteConnection(CapacitorSQLite);

    if (isWeb) {
      // dist/components importa o sql.js instalado (o /loader traz uma cópia antiga embutida
      // que não corresponde ao .wasm). Assim JS e wasm vêm sempre da mesma versão.
      const { defineCustomElement } = await import('jeep-sqlite/dist/components/jeep-sqlite');
      defineCustomElement();
      if (!document.querySelector('jeep-sqlite')) {
        const el = document.createElement('jeep-sqlite');
        // Caminho absoluto a partir do <base href>, para funcionar em subpastas (GitHub Pages).
        el.setAttribute('wasmpath', new URL('assets', document.baseURI).pathname);
        document.body.appendChild(el);
      }
      await customElements.whenDefined('jeep-sqlite');
      await sqlite.initWebStore();
    }

    const consistent = (await sqlite.checkConnectionsConsistency()).result;
    const exists = (await sqlite.isConnection(DB_NAME, false)).result;
    const db =
      consistent && exists
        ? await sqlite.retrieveConnection(DB_NAME, false)
        : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    await db.open();
    await db.execute('PRAGMA foreign_keys = ON;', false);
    return new CapacitorSqliteAdapter(sqlite, db, isWeb);
  }

  protected async rawQuery<T>(sql: string, params: SqlValue[]): Promise<T[]> {
    const res = await this.db.query(sql, params);
    return (res.values ?? []) as T[];
  }

  protected async rawRun(sql: string, params: SqlValue[]): Promise<void> {
    await this.db.run(sql, params, false);
  }

  protected async rawExec(script: string): Promise<void> {
    await this.db.execute(script, false);
  }

  protected async begin(): Promise<void> {
    await this.db.beginTransaction();
  }
  protected async commit(): Promise<void> {
    await this.db.commitTransaction();
  }
  protected async rollback(): Promise<void> {
    await this.db.rollbackTransaction();
  }

  async flush(): Promise<void> {
    if (this.isWeb) await this.sqlite.saveToStore(DB_NAME);
  }
}
