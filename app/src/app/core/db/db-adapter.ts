export type SqlValue = string | number | null | Uint8Array;

/**
 * Única porta de acesso ao SQLite. Os repositórios só conhecem isto.
 * Implementações: CapacitorSqliteAdapter (Android e web via jeep-sqlite)
 * e SqlJsAdapter (testes em Node).
 */
export interface DbAdapter {
  query<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  /** Executa um script com várias instruções (migrações). Sem parâmetros. */
  exec(script: string): Promise<void>;
  /**
   * Corre fn numa transação. Chamadas encadeadas reutilizam a transação
   * exterior. Se fn lançar erro, faz rollback.
   */
  transaction<T>(fn: (tx: DbAdapter) => Promise<T>): Promise<T>;
  /** Persiste no armazenamento (só faz algo no browser). */
  flush(): Promise<void>;
}
