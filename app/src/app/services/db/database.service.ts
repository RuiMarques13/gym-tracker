import { inject, Injectable, signal } from '@angular/core';
import { SEED } from '../../data/seed/seed.generated';
import { loadSeed } from '../../data/seed/seed-loader';
import { refineStoredMuscles, fixStoredMovement } from '../../data/library/refine-stored-muscles';
import { refineStoredMechanic, refineStoredNames } from '../../data/library/refine-stored-names';
import { refineStoredCategories } from '../../data/library/refine-stored-category';
import { CLOCK } from '../clock';
import { CapacitorSqliteAdapter } from '../../data/db/adapters/capacitor-adapter';
import { DbAdapter } from '../../data/db/db-adapter';
import { ensureDeviceId } from '../../data/db/local-meta';
import { migrate } from '../../data/db/migrator';

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
    await fixStoredMovement(this.db, this.deviceId, this.clock.nowIso());
    await this.refineCategories(this.db, this.deviceId);
  }

  private async refineCategories(db: DbAdapter, deviceId: string): Promise<void> {
    const { LIBRARY } = await import('../../core/library/library-data');
    await refineStoredCategories(db, deviceId, this.clock.nowIso(), LIBRARY.items);
    await refineStoredNames(db, deviceId, this.clock.nowIso(), LIBRARY.items);
    await refineStoredMechanic(db, deviceId, this.clock.nowIso(), LIBRARY.items);
  }

  async init(): Promise<void> {
    try {
      const persistent = await requestPersistentStorage();
      const db = await CapacitorSqliteAdapter.open();
      const migration = await migrate(db, undefined, () => this.clock.nowIso());
      const deviceId = await ensureDeviceId(db);
      const seed = await loadSeed(db, SEED, deviceId, () => this.clock.nowIso());
      await refineStoredMuscles(db, deviceId, this.clock.nowIso());
      await fixStoredMovement(db, deviceId, this.clock.nowIso());
      await this.refineCategories(db, deviceId);
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
