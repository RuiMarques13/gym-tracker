import type { Database, SqlJsStatic } from 'sql.js';
import { SqlValue } from '../db-adapter';
import { BaseAdapter } from './base-adapter';

/** Adaptador em memória com sql.js. Usado nos testes em Node. */
export class SqlJsAdapter extends BaseAdapter {
  constructor(private readonly db: Database) {
    super();
    db.run('PRAGMA foreign_keys = ON;');
  }

  static async create(SQL: SqlJsStatic): Promise<SqlJsAdapter> {
    return new SqlJsAdapter(new SQL.Database());
  }

  protected async rawQuery<T>(sql: string, params: SqlValue[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  }

  protected async rawRun(sql: string, params: SqlValue[]): Promise<void> {
    this.db.run(sql, params);
  }

  protected async rawExec(script: string): Promise<void> {
    this.db.exec(script);
  }

  protected async begin(): Promise<void> {
    this.db.run('BEGIN');
  }
  protected async commit(): Promise<void> {
    this.db.run('COMMIT');
  }
  protected async rollback(): Promise<void> {
    this.db.run('ROLLBACK');
  }
  async flush(): Promise<void> {}

  close(): void {
    this.db.close();
  }
}
