import { AuthService } from '../cloud/auth.service';
import {
  SYNC_PROTOCOL_VERSION,
  SyncError,
  type SyncPullResponse,
  type SyncPushRequest,
  type SyncPushResponse,
  type SyncTransport,
} from '../../data/sync/sync-types';

interface RpcError {
  message?: string;
  code?: string;
  details?: string;
}

/** SyncTransport sobre as funções sync_push / sync_pull do Supabase (supabase/migrations). */
export class SupabaseSyncTransport implements SyncTransport {
  constructor(private readonly auth: AuthService) {}

  async push(request: SyncPushRequest): Promise<SyncPushResponse> {
    return this.call<SyncPushResponse>('sync_push', { payload: request });
  }

  async pull(since: number, limit = 1000): Promise<SyncPullResponse> {
    return this.call<SyncPullResponse>('sync_pull', { p_since: since, p_limit: limit });
  }

  private async call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    let result: { data: unknown; error: RpcError | null };
    try {
      const client = await this.auth.client();
      result = (await client.rpc(fn, args)) as typeof result;
    } catch (e) {
      throw new SyncError('Sem ligação ao servidor.', 'offline');
    }
    if (result.error) throw toSyncError(result.error);
    const data = result.data as T & { protocol_version?: number };
    if (!data || data.protocol_version !== SYNC_PROTOCOL_VERSION) {
      throw new SyncError('Resposta inesperada do servidor.', 'protocol');
    }
    return data;
  }
}

export function toSyncError(e: RpcError): SyncError {
  const msg = (e.message ?? '').toLowerCase();
  if (e.code === '28000' || msg.includes('not authenticated') || msg.includes('jwt')) {
    return new SyncError('A sessão expirou. Entra outra vez.', 'auth');
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('fetch')) {
    return new SyncError('Sem ligação ao servidor.', 'offline');
  }
  if (msg.includes('could not find the function') || e.code === 'PGRST202' || e.code === '42883') {
    return new SyncError('O servidor ainda não tem as funções de sync (falta aplicar o SQL no Supabase).', 'server');
  }
  if (msg.includes('protocol_version')) return new SyncError('Versão do servidor incompatível.', 'protocol');
  if (msg.includes('foreign key')) return new SyncError('O servidor recusou dados com referências em falta.', 'data');
  return new SyncError('O servidor recusou o pedido.', 'server');
}
