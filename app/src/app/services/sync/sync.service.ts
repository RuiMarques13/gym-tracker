import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { AuthService } from '../cloud/auth.service';
import { DatabaseService } from '../db/database.service';
import { getMeta, setMeta } from '../../data/db/local-meta';
import { MIGRATIONS } from '../../data/db/migrations';
import { SettingsService } from '../settings/settings.service';
import { CLOCK } from '../clock';
import type { MergeTable } from '../../data/merge/merge';
import { forgetTable, hasDirty, resetPullCursor, resetSyncState, syncOnce } from '../../data/sync/sync-engine';
import { SupabaseSyncTransport } from './supabase-transport';
import { SyncError } from '../../data/sync/sync-types';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error' | 'paused';

const META_PAUSED = 'sync.paused';
const WRITE_DEBOUNCE_MS = 4000;
const PERIODIC_MS = 5 * 60_000;
const SCHEMA = MIGRATIONS.at(-1)!.version;

/**
 * Liga o motor de sync à app: decide quando sincronizar e mostra o estado.
 * Gatilhos: entrar na conta, abrir a app, guardar alguma coisa (depois de uns segundos), voltar a ter rede,
 * voltar à app e de 5 em 5 minutos. Um bloqueio impede dois separadores de sincronizar ao mesmo tempo.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly auth = inject(AuthService);
  private readonly database = inject(DatabaseService);
  private readonly clock = inject(CLOCK);
  private readonly settings = inject(SettingsService);
  private readonly transport = new SupabaseSyncTransport(this.auth);

  readonly status = signal<SyncStatus>('off');
  readonly message = signal<string | null>(null);
  readonly lastSyncAt = signal<string | null>(null);
  /** Sobe sempre que o sync trouxe dados novos: os ecrãs abertos podem recarregar. */
  readonly dataVersion = signal(0);

  private started = false;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Já houve uma tentativa de sync nesta sessão de conta. */
  private syncedOnce = false;
  private firstWaiters: Array<() => void> = [];
  private resetCursorNext = false;

  constructor() {
    effect(() => {
      const state = this.auth.state();
      untracked(() => {
        if (state === 'signedIn') {
          if (this.status() === 'off') this.status.set('idle');
          this.schedule(0);
        } else if (state === 'signedOut') {
          this.status.set('off');
          this.syncedOnce = false;
          this.releaseFirst();
        }
      });
    });
  }

  /** Chamado uma vez, com a base pronta. */
  async start(): Promise<void> {
    if (this.started || !this.database.status().ready) return;
    this.started = true;
    this.database.db.onWrite?.(() => this.schedule(WRITE_DEBOUNCE_MS));
    if ((await getMeta(this.database.db, META_PAUSED)) === '1') this.status.set('paused');
    window.addEventListener('online', () => this.schedule(1000));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.schedule(500);
    });
    setInterval(() => {
      if (document.visibilityState === 'visible') this.schedule(0);
    }, PERIODIC_MS);
    if (this.auth.state() === 'signedIn') this.schedule(0);
  }

  /** Espera pelo primeiro sync (ou desiste ao fim de `ms`), para o onboarding não aparecer antes dos dados chegarem. */
  async whenFirstDone(ms: number): Promise<void> {
    if (this.auth.state() !== 'signedIn' || this.syncedOnce) return;
    await Promise.race([new Promise<void>((r) => this.firstWaiters.push(r)), new Promise<void>((r) => setTimeout(r, ms))]);
  }

  private releaseFirst(): void {
    const waiters = this.firstWaiters;
    this.firstWaiters = [];
    waiters.forEach((r) => r());
  }

  /** Botão «Sincronizar agora»; também retoma a sincronização se estava em pausa. */
  async syncNow(): Promise<void> {
    if (this.status() === 'paused') {
      await setMeta(this.database.db, META_PAUSED, '0');
      this.status.set('idle');
    }
    await this.run();
  }

  /** Tabelas que não sincronizam neste dispositivo (fotos, se não as quiseres na nuvem). */
  private skipTables(): MergeTable[] {
    return this.settings.get('syncPhotos')() ? [] : ['progress_photo'];
  }

  /**
   * Liga ou desliga o envio das fotos deste dispositivo. Ao ligar, o próximo sync lê o servidor desde o início,
   * para trazer as fotos que chegaram enquanto estava desligado.
   */
  async setPhotoSync(on: boolean): Promise<void> {
    await this.settings.set('syncPhotos', on);
    if (on) {
      // Feito dentro do bloqueio, no início do próximo sync: um sync já a correr não volta a escrever o cursor antigo.
      this.resetCursorNext = true;
      this.schedule(0);
    }
  }

  /** Depois de apagar as fotos da nuvem: se voltares a ligar o envio, as fotos deste dispositivo sobem todas outra vez. */
  async forgetPhotos(): Promise<void> {
    await forgetTable(this.database.db, 'progress_photo');
  }

  /** Depois de apagar os dados da nuvem: nada volta a subir sozinho até a pessoa retomar. */
  async pauseAndReset(): Promise<void> {
    await setMeta(this.database.db, META_PAUSED, '1');
    await resetSyncState(this.database.db);
    this.status.set('paused');
    this.message.set(null);
  }

  private schedule(delayMs: number): void {
    if (this.auth.state() !== 'signedIn' || this.status() === 'paused' || !this.database.status().ready) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run();
    }, delayMs);
  }

  private async run(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId || this.running || !this.database.status().ready) return;
    this.running = true;
    this.status.set('syncing');
    try {
      const done = await this.withLock(async () => {
        const db = this.database.db;
        const skipTables = this.skipTables();
        if (this.resetCursorNext) {
          this.resetCursorNext = false;
          await resetPullCursor(db);
        }
        // Se guardaste algo durante o sync, repete (até 3 vezes) em vez de esperar pelo próximo gatilho.
        for (let i = 0; i < 3; i++) {
          const report = await syncOnce(db, this.transport, {
            deviceId: this.database.deviceId, userId, schemaVersion: SCHEMA, nowIso: () => this.clock.nowIso(), skipTables,
          });
          if (report.changed > 0) {
            await this.database.refineMuscles();
            await this.settings.init(); // as definições da conta podem ter chegado de outro dispositivo
            this.dataVersion.update((n) => n + 1);
          }
          if (!(await hasDirty(db, skipTables))) break;
        }
      });
      if (done) {
        this.lastSyncAt.set(this.clock.nowIso());
        this.message.set(null);
        this.status.set('idle');
      } else {
        this.status.set('idle'); // outro separador está a sincronizar
      }
    } catch (e) {
      const err = e instanceof SyncError ? e : null;
      if (err?.kind === 'offline') {
        this.status.set('offline');
        this.message.set('Sem ligação. Tenta outra vez quando tiveres rede.');
      } else {
        this.status.set('error');
        this.message.set(err?.message ?? 'O sync falhou. Os teus dados continuam seguros neste dispositivo.');
        console.error('sync', e);
      }
    } finally {
      this.running = false;
      this.syncedOnce = true;
      this.releaseFirst();
      if (this.resetCursorNext) this.schedule(2000); // ligaste as fotos durante um sync: lê outra vez desde o início
    }
  }

  private async withLock(fn: () => Promise<void>): Promise<boolean> {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks) {
      await fn();
      return true;
    }
    return locks.request('gym-tracker-sync', { ifAvailable: true }, async (lock) => {
      if (!lock) return false;
      await fn();
      return true;
    });
  }
}
