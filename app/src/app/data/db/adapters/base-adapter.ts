import { DbAdapter, SqlValue, TransactionOptions } from '../db-adapter';

/**
 * Serializa o acesso à base: cada operação de topo espera pela anterior,
 * e uma transação tem a base só para si até terminar. Dentro da transação,
 * o adaptador "tx" passa por cima da fila (senão bloqueava-se a si próprio).
 */
export abstract class BaseAdapter implements DbAdapter {
  private queue: Promise<unknown> = Promise.resolve();
  private writeListener: (() => void) | null = null;

  /** Avisa depois de cada escrita nos dados (o sync usa-o para agendar um envio). */
  onWrite(listener: (() => void) | null): void {
    this.writeListener = listener;
  }

  private notifyWrite(sql: string): void {
    // estado interno (local_meta, sync_row, migrações) não é «dados do utilizador»
    if (/\b(local_meta|sync_row|schema_migrations)\b/i.test(sql)) return;
    try {
      this.writeListener?.();
    } catch {
      /* um ouvinte com erro nunca estraga a escrita */
    }
  }

  protected abstract rawQuery<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  protected abstract rawRun(sql: string, params: SqlValue[]): Promise<void>;
  protected abstract rawExec(script: string): Promise<void>;
  protected abstract begin(): Promise<void>;
  protected abstract commit(): Promise<void>;
  protected abstract rollback(): Promise<void>;
  abstract flush(): Promise<void>;

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const result = this.queue.then(op, op);
    this.queue = result.catch(() => undefined);
    return result;
  }

  query<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.enqueue(() => this.rawQuery<T>(sql, params));
  }

  run(sql: string, params: SqlValue[] = []): Promise<void> {
    return this.enqueue(async () => {
      await this.rawRun(sql, params);
      await this.flush();
      this.notifyWrite(sql);
    });
  }

  exec(script: string): Promise<void> {
    return this.enqueue(async () => {
      await this.rawExec(script);
      await this.flush();
      this.notifyWrite(script);
    });
  }

  transaction<T>(fn: (tx: DbAdapter) => Promise<T>, options: TransactionOptions = {}): Promise<T> {
    return this.enqueue(async () => {
      // Sem flush entre o PRAGMA e a transação: no browser, gravar reabre a base e repõe o PRAGMA.
      if (options.foreignKeysOff) await this.rawExec('PRAGMA foreign_keys = OFF;');
      try {
        await this.begin();
        let result: T;
        try {
          result = await fn(this.txView());
          if (options.foreignKeysOff) {
            const broken = await this.rawQuery<{ table: string }>('PRAGMA foreign_key_check', []);
            if (broken.length) {
              throw new Error(`${broken.length} referências inválidas depois da alteração (ex.: ${broken[0].table})`);
            }
          }
          await this.commit();
        } catch (err) {
          await this.rollback();
          throw err;
        }
        this.notifyWrite('transaction');
        return result;
      } finally {
        if (options.foreignKeysOff) await this.rawExec('PRAGMA foreign_keys = ON;');
        await this.flush();
      }
    });
  }

  /** Vista usada dentro de uma transação: chama o motor diretamente. */
  private txView(): DbAdapter {
    const self = this;
    const view: DbAdapter = {
      query: <T>(sql: string, params: SqlValue[] = []) => self.rawQuery<T>(sql, params),
      run: (sql: string, params: SqlValue[] = []) => self.rawRun(sql, params),
      exec: (script: string) => self.rawExec(script),
      transaction: <T>(fn: (tx: DbAdapter) => Promise<T>) => fn(view),
      flush: async () => undefined,
    };
    return view;
  }
}
