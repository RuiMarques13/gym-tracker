import { inject, Injectable, signal } from '@angular/core';
import { SEED } from '../seed/seed.generated';
import { loadSeed } from '../seed/seed-loader';
import { refineStoredMuscles } from '../library/refine-stored-muscles';
import { CLOCK } from '../util/clock';
import { CapacitorSqliteAdapter } from './adapters/capacitor-adapter';
import { DbAdapter } from './db-adapter';
import { ensureDeviceId } from './local-meta';
import { migrate } from './migrator';

export interface DbStatus {
  ready: boolean;
  schemaVersion: number;
  seedVersion: number;
  deviceId: string | null;
  persistentStorage: boolean | null;
  error: string | null;
}

/**
 * Arranque da base: abre o adaptador certo para a plataforma, corre as
 * migrações, garante o device_id e carrega o seed. Corre uma vez no arranque
 * da app (provideAppInitializer em app.config.ts).
 */
@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private readonly clock = inject(CLOCK);
  private adapter: DbAdapter | null = null;
  private deviceIdValue: string | null = null;

  readonly status = signal<DbStatus>({
    ready: false,
    schemaVersion: 0,
    seedVersion: 0,
    deviceId: null,
    persistentStorage: null,
    error: null,
  });

  get db(): DbAdapter {
    if (!this.adapter) throw new Error('Base de dados ainda não está pronta');
    return this.adapter;
  }

  get deviceId(): string {
    if (!this.deviceIdValue) throw new Error('device_id ainda não existe');
    return this.deviceIdValue;
  }

  /** Converte músculos antigos (costas, ombros) nos finos; chama-se depois de importar ou de receber dados. */
  async refineMuscles(): Promise<void> {
    await refineStoredMuscles(this.db, this.deviceId, this.clock.nowIso());
  }

  async init(): Promise<void> {
    try {
      const persistent = await requestPersistentStorage();
      const db = await CapacitorSqliteAdapter.open();
      const migration = await migrate(db, undefined, () => this.clock.nowIso());
      const deviceId = await ensureDeviceId(db);
      const seed = await loadSeed(db, SEED, deviceId, () => this.clock.nowIso());
      await refineStoredMuscles(db, deviceId, this.clock.nowIso());
      this.adapter = db;
      this.deviceIdValue = deviceId;
      this.status.set({
        ready: true,
        schemaVersion: migration.to,
        seedVersion: seed.version,
        deviceId,
        persistentStorage: persistent,
        error: null,
      });
    } catch (err) {
      console.error('Falha ao iniciar a base de dados', err);
      this.status.update((s) => ({ ...s, error: String((err as Error)?.message ?? err) }));
    }
  }
}

/**
 * No browser, pede para o armazenamento não ser limpo automaticamente.
 * Até haver sync, é a única cópia dos dados do PC (doc v2, secção 4).
 */
async function requestPersistentStorage(): Promise<boolean | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return null;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
