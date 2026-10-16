import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { DatabaseService } from '../db/database.service';
import { MIGRATIONS } from '../../data/db/migrations';
import { exportData, ExportFile, mergeData, MergeReport, parseExport, previewMerge } from '../../data/merge/merge';
import { SettingsService } from '../settings/settings.service';
import { CLOCK } from '../clock';

export interface ExportResult {
  filename: string;
  sessions: number;
  sets: number;
}

const SCHEMA_VERSION = MIGRATIONS.at(-1)!.version;

/** Exportar e importar a base toda em JSON. O merge em si vive em core/merge. */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly database = inject(DatabaseService);
  private readonly settings = inject(SettingsService);
  private readonly clock = inject(CLOCK);

  /** Gera o ficheiro e entrega-o: descarrega no browser, ou abre a partilha no Android. */
  async exportToFile(): Promise<ExportResult> {
    const now = this.clock.nowIso();
    const file = await exportData(this.database.db, { schemaVersion: SCHEMA_VERSION, deviceId: this.database.deviceId, nowIso: now });
    const filename = `gym-tracker-${now.slice(0, 10)}.json`;
    const text = JSON.stringify(file);
    if (Capacitor.isNativePlatform()) await this.shareNative(filename, text);
    else this.download(filename, text);
    await this.settings.set('lastExportAt', now);
    return {
      filename,
      sessions: (file.tables.session ?? []).filter((r) => r['deleted_at'] === null).length,
      sets: (file.tables.set_log ?? []).filter((r) => r['deleted_at'] === null).length,
    };
  }

  /** Lê o ficheiro e diz o que mudaria, sem escrever nada. */
  async preview(text: string): Promise<{ file: ExportFile; report: MergeReport }> {
    const file = parseExport(text, SCHEMA_VERSION);
    return { file, report: await previewMerge(this.database.db, file) };
  }

  /** Aplica o merge e recarrega as definições em memória (podem ter mudado). */
  async apply(file: ExportFile): Promise<MergeReport> {
    const report = await mergeData(this.database.db, file);
    await this.database.refineMuscles();
    await this.database.db.flush();
    await this.settings.init();
    return report;
  }

  private download(filename: string, text: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  private async shareNative(filename: string, text: string): Promise<void> {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const written = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'Cópia de segurança do Gym Tracker', url: written.uri, dialogTitle: 'Guardar a cópia de segurança' });
  }
}
