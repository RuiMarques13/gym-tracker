import { computed, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { DatabaseService } from '../db/database.service';
import { CLOCK } from '../util/clock';
import { SETTINGS, SettingName, SettingValue } from './setting-registry';
import { FormFactor, SettingsStore } from './settings-store';

/**
 * Definições como signals. Carrega tudo no arranque (são poucas) e
 * escreve no SQLite a cada alteração.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly database = inject(DatabaseService);
  private readonly clock = inject(CLOCK);
  private store: SettingsStore | null = null;
  private readonly values = new Map<SettingName, WritableSignal<unknown>>();

  readonly formFactor = signal<FormFactor>(detectFormFactor());

  constructor() {
    for (const name of Object.keys(SETTINGS) as SettingName[]) {
      this.values.set(name, signal(SETTINGS[name].defaultValue));
    }
    if (typeof window !== 'undefined') {
      window.matchMedia?.('(min-width: 992px)').addEventListener?.('change', () =>
        this.formFactor.set(detectFormFactor()),
      );
    }
  }

  async init(): Promise<void> {
    if (!this.database.status().ready) return;
    this.store = new SettingsStore(this.database.db, this.clock, this.database.deviceId);
    for (const name of Object.keys(SETTINGS) as SettingName[]) {
      const value = await this.store.get(SETTINGS[name] as never, this.formFactor());
      this.values.get(name)!.set(value);
    }
  }

  get<K extends SettingName>(name: K): Signal<SettingValue<K>> {
    const s = this.values.get(name)!;
    return computed(() => s() as SettingValue<K>);
  }

  async set<K extends SettingName>(name: K, value: SettingValue<K>): Promise<void> {
    const def = SETTINGS[name];
    if (!(def.validate as (v: unknown) => boolean)(value)) throw new Error(`Valor inválido para ${def.key}`);
    this.values.get(name)!.set(value);
    await this.store?.set(def as never, value as never, this.formFactor());
  }
}

function detectFormFactor(): FormFactor {
  if (typeof window === 'undefined' || !window.matchMedia) return 'phone';
  return window.matchMedia('(min-width: 992px)').matches ? 'desktop' : 'phone';
}
