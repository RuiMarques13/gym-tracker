import type { DbAdapter } from '../db/db-adapter';
import type { Clock } from '../../core/util/clock';
import { ids } from '../../core/util/uuid';
import { SettingDef } from '../../core/settings/setting-registry';

export type FormFactor = 'phone' | 'desktop';

interface StoredValue {
  v: number;
  value: unknown;
}

/**
 * Leitura e escrita de definições, sem Angular (testável em Node).
 * O id de cada linha é determinístico (scope:scope_ref:key), por isso a mesma
 * definição de conta alterada em dois dispositivos converge no sync.
 */
export class SettingsStore {
  constructor(
    private readonly db: DbAdapter,
    private readonly clock: Clock,
    private readonly deviceId: string,
  ) {}

  scopeRef(def: SettingDef<unknown>, formFactor: FormFactor): string | null {
    switch (def.scope) {
      case 'ACCOUNT':
        return null;
      case 'DEVICE':
        return this.deviceId;
      case 'LAYOUT':
        return formFactor;
    }
  }

  async get<T>(def: SettingDef<T>, formFactor: FormFactor = 'phone'): Promise<T> {
    const ref = this.scopeRef(def as SettingDef<unknown>, formFactor);
    const rows = await this.db.query<{ value: string }>(
      'SELECT value FROM setting WHERE id = ? AND deleted_at IS NULL',
      [ids.setting(def.scope, ref, def.key)],
    );
    if (!rows.length) return def.defaultValue;
    return this.decode(def, rows[0].value);
  }

  async set<T>(def: SettingDef<T>, value: T, formFactor: FormFactor = 'phone'): Promise<void> {
    if (!def.validate(value)) throw new Error(`Valor inválido para ${def.key}: ${JSON.stringify(value)}`);
    const ref = this.scopeRef(def as SettingDef<unknown>, formFactor);
    const payload: StoredValue = { v: def.schemaVersion, value };
    await this.db.run(
      `INSERT INTO setting (id, key, scope, scope_ref, value, updated_at, deleted_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
       ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at,
         deleted_at = NULL, device_id = excluded.device_id`,
      [ids.setting(def.scope, ref, def.key), def.key, def.scope, ref, JSON.stringify(payload),
        this.clock.nowIso(), this.deviceId],
    );
  }

  /** Volta ao valor por defeito (soft delete, para o sync propagar). */
  async reset<T>(def: SettingDef<T>, formFactor: FormFactor = 'phone'): Promise<void> {
    const ref = this.scopeRef(def as SettingDef<unknown>, formFactor);
    await this.db.run('UPDATE setting SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [
      this.clock.nowIso(), this.clock.nowIso(), this.deviceId, ids.setting(def.scope, ref, def.key),
    ]);
  }

  /** Lê o JSON, aplica migrações de esquema e valida; se falhar, usa o defeito. */
  decode<T>(def: SettingDef<T>, raw: string): T {
    try {
      const parsed = JSON.parse(raw) as StoredValue;
      let value = parsed.value;
      if (parsed.v < def.schemaVersion) {
        if (!def.migrate) return def.defaultValue;
        value = def.migrate(value, parsed.v);
      }
      return def.validate(value) ? value : def.defaultValue;
    } catch {
      return def.defaultValue;
    }
  }
}
