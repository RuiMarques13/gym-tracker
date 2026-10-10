import { Injectable, signal } from '@angular/core';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { translateAuthError } from './auth-errors';
import { CLOUD, sessionStorageKey } from './cloud-config';

export type AuthState = 'loading' | 'signedOut' | 'signedIn';
export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; message: string };

/**
 * Conta na nuvem (Supabase Auth). A app funciona sem conta: isto só serve para o sync (Fase 3).
 * O supabase-js carrega-se sob pedido (chunk à parte) e só no arranque se já houver sessão guardada,
 * para não pesar a quem ainda não entrou. A sessão fica no localStorage e renova-se sozinha.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly state = signal<AuthState>('loading');
  readonly email = signal<string | null>(null);
  readonly userId = signal<string | null>(null);

  private clientPromise: Promise<SupabaseClient> | null = null;
  private initPromise: Promise<void> | null = null;

  /** Arranque: lê a sessão guardada (funciona offline). Sem sessão guardada nem sequer carrega o supabase-js. */
  init(): Promise<void> {
    this.initPromise ??= this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    if (!this.hasStoredSession()) {
      this.apply(null);
      return;
    }
    try {
      const client = await this.client();
      const { data } = await client.auth.getSession();
      this.apply(data.session);
    } catch {
      this.apply(null);
    }
  }

  /** Cliente do Supabase (único). Também é usado pelo transporte de sync. */
  client(): Promise<SupabaseClient> {
    this.clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => {
      const c = createClient(CLOUD.url, CLOUD.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
      c.auth.onAuthStateChange((_event, session) => this.apply(session));
      return c;
    });
    return this.clientPromise;
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await (await this.client()).auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { ok: false, message: translateAuthError(error) };
      this.apply(data.session);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: translateAuthError(e as Error) };
    }
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await (await this.client()).auth.signUp({ email: email.trim(), password });
      if (error) return { ok: false, message: translateAuthError(error) };
      this.apply(data.session);
      // Sem sessão: o projeto exige confirmar o email antes de entrar.
      return { ok: true, needsConfirmation: !data.session };
    } catch (e) {
      return { ok: false, message: translateAuthError(e as Error) };
    }
  }

  /** Termina a sessão só neste dispositivo. Os dados locais ficam como estão. */
  async signOut(): Promise<void> {
    try {
      await (await this.client()).auth.signOut({ scope: 'local' });
    } finally {
      this.apply(null);
    }
  }

  /** Apaga na nuvem tudo o que é desta conta (função delete_my_data). Os dados locais não se tocam. */
  async deleteCloudData(): Promise<AuthResult> {
    try {
      const { error } = await (await this.client()).rpc('delete_my_data');
      if (error) return { ok: false, message: translateAuthError(error as { message?: string }) };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: translateAuthError(e as Error) };
    }
  }

  private apply(session: Session | null): void {
    this.email.set(session?.user.email ?? null);
    this.userId.set(session?.user.id ?? null);
    this.state.set(session ? 'signedIn' : 'signedOut');
  }

  private hasStoredSession(): boolean {
    try {
      return localStorage.getItem(sessionStorageKey()) !== null;
    } catch {
      return false;
    }
  }
}
