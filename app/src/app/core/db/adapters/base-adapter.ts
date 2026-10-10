import { DbAdapter, SqlValue } from '../db-adapter';

/**
 * Serializa o acesso à base: cada operação de topo espera pela anterior,
 * e uma transação tem a base só para si até terminar. Dentro da transação,
 * o adaptador "tx" passa por cima da fila (senão bloqueava-se a si próprio).
 */
export abstract class BaseAdapter implements DbAdapter {
  private queue: Promise<unknown> = Promise.resolve();

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
    });
  }

  exec(script: string): Promise<void> {
    return this.enqueue(async () => {
      await this.rawExec(script);
      await this.flush();
    });
  }

  transaction<T>(fn: (tx: DbAdapter) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      await this.begin();
      try {
        const result = await fn(this.txView());
        await this.commit();
        await this.flush();
        return result;
      } catch (err) {
        await this.rollback();
        throw err;
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
