import type { SqlValue } from '../db/db-adapter';
import type { MergeTable } from '../merge/merge';

/** Contrato de sync (doc, secção 5). Quem implementa o servidor só precisa de respeitar isto. */
export const SYNC_PROTOCOL_VERSION = 1;

export type SyncRow = Record<string, SqlValue>;
export type SyncTables = Partial<Record<MergeTable, SyncRow[]>>;

export interface SyncPushRequest {
  protocol_version: number;
  device_id: string;
  tables: SyncTables;
}

export interface SyncPushResponse {
  protocol_version: number;
  /** Linhas escritas no servidor, por tabela. */
  applied: Record<string, number>;
  /** Linhas ignoradas porque o servidor já tinha a mesma versão ou uma mais recente. */
  skipped: Record<string, number>;
  server_time: string;
}

export interface SyncPullResponse {
  protocol_version: number;
  /** Maior server_version incluído. Usar como «since» no pedido seguinte. */
  cursor: number;
  has_more: boolean;
  tables: SyncTables;
  server_time: string;
}

/** Fala com o servidor. Supabase = duas funções RPC; Spring Boot = POST /sync/push e GET /sync/pull. */
export interface SyncTransport {
  push(request: SyncPushRequest): Promise<SyncPushResponse>;
  pull(since: number, limit?: number): Promise<SyncPullResponse>;
}

/** Falha de sync com uma mensagem que se pode mostrar. `offline` = sem rede (não é erro a sério). */
export class SyncError extends Error {
  constructor(
    message: string,
    readonly kind: 'offline' | 'auth' | 'server' | 'protocol' | 'data',
  ) {
    super(message);
    this.name = 'SyncError';
  }
}
