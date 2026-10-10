import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WIDGETS } from '../home/home-widgets.component';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToggle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { AuthService } from '../../core/cloud/auth.service';
import { BackupService } from '../../core/backup/backup.service';
import { MERGE_TABLES, MergeError, MergeReport } from '../../core/merge/merge';
import { SettingsService } from '../../core/settings/settings.service';

@Component({
  selector: 'app-settings',
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonItem, IonLabel, IonNote,
    IonSegment, IonSegmentButton, IonButton, RouterLink, IonToggle,
  ],
  template: `
    <ion-header>
      <ion-toolbar><ion-title>Definições</ion-title></ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        <ion-list>
          <ion-list-header><ion-label>Conta</ion-label></ion-list-header>
          <ion-item button detail routerLink="/conta">
            <ion-label class="ion-text-wrap">
              <h3>{{ auth.email() ?? 'Entrar ou criar conta' }}</h3>
              <p>{{ auth.state() === 'signedIn' ? 'Sessão iniciada' : 'Opcional: guarda os dados na nuvem' }}</p>
            </ion-label>
          </ion-item>

          <ion-list-header><ion-label>Aspeto</ion-label></ion-list-header>
          <ion-item lines="none">
            <ion-label>Tema</ion-label>
          </ion-item>
          <ion-item lines="full">
            <ion-segment [value]="theme()" (ionChange)="setTheme($any($event).detail.value)">
              <ion-segment-button value="system"><ion-label>Sistema</ion-label></ion-segment-button>
              <ion-segment-button value="light"><ion-label>Claro</ion-label></ion-segment-button>
              <ion-segment-button value="dark"><ion-label>Escuro</ion-label></ion-segment-button>
            </ion-segment>
          </ion-item>

          <ion-list-header><ion-label>Treino</ion-label></ion-list-header>
          <ion-item>
            <ion-label>Descanso por defeito</ion-label>
            <ion-note slot="end">{{ rest() }} s</ion-note>
          </ion-item>
          <ion-item>
            <ion-label>Peso das séries em músculos secundários</ion-label>
            <ion-note slot="end">{{ secondary() }}</ion-note>
          </ion-item>

          <ion-list-header><ion-label>Home</ion-label></ion-list-header>
          @for (w of widgets; track w.id) {
            <ion-item>
              <ion-toggle [checked]="widgetOn(w.id)" (ionChange)="setWidget(w.id, $any($event).detail.checked)">{{ w.label }}</ion-toggle>
            </ion-item>
          }

          <ion-list-header><ion-label>Relógio</ion-label></ion-list-header>
          <ion-item button detail routerLink="/definicoes/relogio">
            <ion-label class="ion-text-wrap">
              <h3>Configurar relógio</h3>
              <p>Receber o aviso do descanso no Galaxy Watch</p>
            </ion-label>
          </ion-item>

          <ion-list-header><ion-label>Cópia de segurança</ion-label></ion-list-header>
          <ion-item lines="none">
            <ion-label class="ion-text-wrap">
              <p>Os teus dados vivem só neste dispositivo. Exporta de vez em quando um ficheiro JSON com tudo.
                Importar junta o ficheiro ao que já tens: em cada linha fica a versão mais recente, e nada se perde.</p>
              <p class="last">Última exportação: {{ lastExport() }}</p>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-button (click)="export()" [disabled]="busy()">Exportar</ion-button>
            <ion-button fill="outline" (click)="picker.click()" [disabled]="busy()">Importar</ion-button>
            <input #picker type="file" accept=".json,application/json" hidden (change)="onFile($event)" />
          </ion-item>
          @if (message()) {
            <ion-item lines="none"><ion-label class="ion-text-wrap"><p class="msg" [class.error]="isError()">{{ message() }}</p></ion-label></ion-item>
          }
        </ion-list>
      </div>
    </ion-content>
  `,
  styles: `.page { max-width: 760px; margin: 0 auto; } ion-segment { margin: 4px 0 12px; } .last { margin-top: 6px; } .msg { color: var(--ion-color-success-shade); } .msg.error { color: var(--ion-color-danger); }`,
})
export class SettingsPage {
  protected readonly auth = inject(AuthService);
  private readonly settings = inject(SettingsService);
  private readonly backup = inject(BackupService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  readonly theme = this.settings.get('theme');
  readonly rest = this.settings.get('defaultRestSeconds');
  readonly secondary = this.settings.get('secondaryMuscleWeight');
  private readonly lastExportAt = this.settings.get('lastExportAt');

  readonly widgets = WIDGETS;
  private readonly homeWidgets = this.settings.get('homeWidgets');
  widgetOn = (id: string) => this.homeWidgets().includes(id);
  setWidget(id: string, on: boolean): void {
    const order = WIDGETS.map((w) => w.id as string);
    const next = order.filter((x) => (x === id ? on : this.homeWidgets().includes(x)));
    void this.settings.set('homeWidgets', next);
  }

  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly isError = signal(false);
  readonly lastExport = computed(() => {
    const at = this.lastExportAt();
    return at ? new Date(at).toLocaleString('pt-PT', { dateStyle: 'long', timeStyle: 'short' }) : 'nunca';
  });

  setTheme(value: 'system' | 'light' | 'dark'): void {
    void this.settings.set('theme', value);
  }

  async export(): Promise<void> {
    this.busy.set(true);
    try {
      const r = await this.backup.exportToFile();
      this.show(`Exportado: ${r.sessions} ${r.sessions === 1 ? 'sessão' : 'sessões'}, ${r.sets} linhas de séries (${r.filename}).`);
    } catch (err) {
      this.show(`Não foi possível exportar: ${err instanceof Error ? err.message : 'erro desconhecido'}`, true);
    } finally {
      this.busy.set(false);
    }
  }

  async onFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // deixa escolher o mesmo ficheiro outra vez
    if (!file) return;
    this.busy.set(true);
    try {
      const { file: data, report } = await this.backup.preview(await file.text());
      if (!report.inserted && !report.updated) {
        this.show('Nada de novo: já tens tudo o que está neste ficheiro.');
        return;
      }
      const when = new Date(data.exportedAt).toLocaleString('pt-PT', { dateStyle: 'long', timeStyle: 'short' });
      const alert = await this.alerts.create({
        header: 'Importar este ficheiro?',
        message: `Exportado a ${when}. ${describe(report)} As linhas em que a tua versão é mais recente ficam como estão.`,
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Importar', handler: () => void this.apply(data) },
        ],
      });
      await alert.present();
    } catch (err) {
      this.show(err instanceof MergeError ? err.message : 'Não foi possível ler o ficheiro.', true);
    } finally {
      this.busy.set(false);
    }
  }

  private async apply(data: Parameters<BackupService['apply']>[0]): Promise<void> {
    this.busy.set(true);
    try {
      const report = await this.backup.apply(data);
      this.show(`Importado. ${describe(report)}`);
      const t = await this.toasts.create({ message: 'Importação concluída.', color: 'success', duration: 2000 });
      await t.present();
    } catch (err) {
      this.show(err instanceof MergeError ? err.message : 'Não foi possível importar.', true);
    } finally {
      this.busy.set(false);
    }
  }

  private show(text: string, error = false): void {
    this.message.set(text);
    this.isError.set(error);
  }
}

const LABEL: Partial<Record<(typeof MERGE_TABLES)[number], [string, string]>> = {
  session: ['sessão', 'sessões'],
  set_log: ['linha de séries', 'linhas de séries'],
  exercise: ['exercício', 'exercícios'],
  workout_template: ['treino', 'treinos'],
};

/** «3 sessões e 24 linhas de séries novas; 1 exercício atualizado.» */
function describe(r: MergeReport): string {
  const parts = (key: 'inserted' | 'updated') =>
    (Object.keys(LABEL) as (keyof typeof LABEL)[])
      .map((t) => [r.tables[t]?.[key] ?? 0, LABEL[t]!] as const)
      .filter(([n]) => n > 0)
      .map(([n, [one, many]]) => `${n} ${n === 1 ? one : many}`);
  const novos = parts('inserted');
  const atualizados = parts('updated');
  const out: string[] = [];
  if (novos.length) out.push(`Novo: ${novos.join(', ')}.`);
  if (atualizados.length) out.push(`Atualizado: ${atualizados.join(', ')}.`);
  if (!out.length) out.push(`${r.inserted + r.updated} linhas de apoio (definições, ligações).`);
  return out.join(' ');
}
