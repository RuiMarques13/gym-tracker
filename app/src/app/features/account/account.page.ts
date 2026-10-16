import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList,
  IonListHeader, IonNote, IonSegment, IonSegmentButton, IonTitle, IonToggle, IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../../core/cloud/auth.service';
import { SettingsService } from '../../core/settings/settings.service';
import { SyncService } from '../../core/sync/sync.service';

/** Conta na nuvem: entrar, criar conta, sair e apagar os dados da nuvem. Opcional: a app funciona sem conta. */
@Component({
  selector: 'app-account',
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonList, IonListHeader, IonItem, IonLabel,
    IonInput, IonButton, IonNote, IonSegment, IonSegmentButton, IonToggle,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        @if (auth.state() === 'signedIn') {
          <ion-buttons slot="start"><ion-back-button defaultHref="/definicoes" text="" /></ion-buttons>
        }
        <ion-title>{{ auth.state() === 'signedIn' ? 'Conta' : 'Gym Tracker' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        @switch (auth.state()) {
          @case ('loading') {
            <p class="intro">A verificar a sessão…</p>
          }
          @case ('signedOut') {
            <p class="intro">Entra na tua conta para usar a app. Os teus treinos ficam guardados neste dispositivo e também na tua conta, a sincronizar entre dispositivos.</p>
            <ion-segment [value]="mode()" (ionChange)="setMode($any($event).detail.value)">
              <ion-segment-button value="in"><ion-label>Entrar</ion-label></ion-segment-button>
              <ion-segment-button value="up"><ion-label>Criar conta</ion-label></ion-segment-button>
            </ion-segment>
            <form (submit)="submit($event)">
              <ion-list lines="full">
                <ion-item>
                  <ion-input label="Email" labelPlacement="floating" type="email" name="email" autocomplete="email" inputmode="email"
                    [value]="email()" (ionInput)="email.set($any($event).detail.value ?? '')" />
                </ion-item>
                <ion-item>
                  <ion-input label="Palavra-passe" labelPlacement="floating" type="password" name="password"
                    [autocomplete]="mode() === 'in' ? 'current-password' : 'new-password'"
                    [value]="password()" (ionInput)="password.set($any($event).detail.value ?? '')" />
                </ion-item>
              </ion-list>
              @if (mode() === 'up') {
                <ion-note class="hint">Pelo menos 8 caracteres.</ion-note>
              }
              <div class="actions">
                <ion-button type="submit" expand="block" [disabled]="!canSubmit() || busy()">
                  {{ busy() ? 'A processar…' : mode() === 'in' ? 'Entrar' : 'Criar conta' }}
                </ion-button>
              </div>
            </form>
          }
          @case ('signedIn') {
            <ion-list lines="full">
              <ion-list-header><ion-label>Sessão iniciada</ion-label></ion-list-header>
              <ion-item lines="none">
                <ion-label class="ion-text-wrap">
                  <h3>{{ auth.email() }}</h3>
                </ion-label>
              </ion-item>
              <ion-item lines="none">
                <ion-label class="ion-text-wrap">
                  <h3>{{ syncTitle() }}</h3>
                  <p>{{ sync.message() ?? syncHint() }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
            <div class="actions">
              <ion-button expand="block" (click)="sync.syncNow()" [disabled]="sync.status() === 'syncing'">
                {{ sync.status() === 'paused' ? 'Retomar e sincronizar' : 'Sincronizar agora' }}
              </ion-button>
            </div>
            <div class="actions">
              <ion-button expand="block" fill="outline" (click)="signOut()" [disabled]="busy()">Sair</ion-button>
            </div>
            <ion-list lines="none">
              <ion-list-header><ion-label>Fotos de progresso</ion-label></ion-list-header>
              <ion-item>
                <ion-toggle [checked]="photosOn()" (ionChange)="togglePhotos($any($event).detail.checked, $any($event).target)" [disabled]="busy()">
                  <ion-label class="ion-text-wrap">
                    <h3>Sincronizar fotos</h3>
                    <p>{{ photosOn()
                      ? 'As fotos deste dispositivo são enviadas para a tua conta e chegam aos outros dispositivos com esta opção ligada.'
                      : 'Desligado: as fotos ficam só neste dispositivo. O resto dos dados continua a sincronizar.' }}</p>
                  </ion-label>
                </ion-toggle>
              </ion-item>
            </ion-list>
            <div class="actions">
              <ion-button expand="block" fill="clear" color="danger" (click)="confirmDeletePhotos()" [disabled]="busy()">Apagar fotos na nuvem</ion-button>
            </div>
            <ion-list lines="none">
              <ion-list-header><ion-label>Dados na nuvem</ion-label></ion-list-header>
              <ion-item>
                <ion-label class="ion-text-wrap">
                  <p>Apagar remove da nuvem tudo o que é desta conta. Os dados deste dispositivo não são tocados.</p>
                </ion-label>
              </ion-item>
            </ion-list>
            <div class="actions">
              <ion-button expand="block" fill="clear" color="danger" (click)="confirmDelete()" [disabled]="busy()">Apagar dados na nuvem</ion-button>
            </div>
          }
        }
        @if (message()) {
          <p class="msg" [class.error]="isError()" role="status">{{ message() }}</p>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 560px; margin: 0 auto; padding: 8px 0 24px; }
    .intro { padding: 0 16px; color: var(--ion-color-medium); }
    ion-segment { margin: 4px 16px 12px; width: auto; }
    .actions { padding: 12px 16px; }
    .hint { display: block; padding: 4px 16px 0; }
    .msg { padding: 0 16px; color: var(--ion-color-success-shade); }
    .msg.error { color: var(--ion-color-danger); }
  `,
})
export class AccountPage {
  protected readonly auth = inject(AuthService);
  protected readonly sync = inject(SyncService);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);
  private readonly settings = inject(SettingsService);

  readonly photosOn = this.settings.get('syncPhotos');

  readonly mode = signal<'in' | 'up'>('in');
  readonly email = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly message = signal('');
  readonly isError = signal(false);

  readonly syncTitle = computed(() => {
    switch (this.sync.status()) {
      case 'syncing': return 'A sincronizar…';
      case 'offline': return 'Sem ligação';
      case 'error': return 'O sync falhou';
      case 'paused': return 'Sincronização em pausa';
      default: return this.sync.lastSyncAt() ? 'Tudo em dia' : 'Sincronização ligada';
    }
  });
  readonly syncHint = computed(() => {
    const at = this.sync.lastSyncAt();
    if (this.sync.status() === 'paused') return 'Os dados deste dispositivo não estão a ser enviados. Retoma quando quiseres.';
    if (!at) return 'Os teus dados são enviados para a tua conta e chegam aos outros dispositivos.';
    return `Última vez às ${new Date(at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}.`;
  });

  readonly canSubmit = computed(() => {
    const e = this.email().trim();
    return e.includes('@') && this.password().length >= (this.mode() === 'up' ? 8 : 1);
  });

  setMode(m: string): void {
    this.mode.set(m === 'up' ? 'up' : 'in');
    this.message.set('');
  }

  async submit(ev: Event): Promise<void> {
    ev.preventDefault();
    if (!this.canSubmit() || this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    const r =
      this.mode() === 'in'
        ? await this.auth.signIn(this.email(), this.password())
        : await this.auth.signUp(this.email(), this.password());
    this.busy.set(false);
    if (!r.ok) return this.show(r.message, true);
    this.password.set('');
    if (!r.needsConfirmation) {
      await this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }
    if (r.needsConfirmation) {
      this.mode.set('in');
      this.show('Conta criada. Abre o email que te enviámos, carrega no link e depois entra aqui.', false);
    }
  }

  async signOut(): Promise<void> {
    this.busy.set(true);
    await this.auth.signOut();
    this.busy.set(false);
    this.show('Sessão terminada. Os dados deste dispositivo ficam como estão.', false);
  }

  async confirmDelete(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Apagar dados na nuvem?',
      message: 'Remove da nuvem todos os treinos, sessões e medidas desta conta. Os dados deste dispositivo ficam. Não dá para desfazer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Apagar', role: 'destructive', handler: () => void this.deleteCloud() },
      ],
    });
    await alert.present();
  }

  private async deleteCloud(): Promise<void> {
    this.busy.set(true);
    const r = await this.auth.deleteCloudData();
    if (r.ok) await this.sync.pauseAndReset();
    this.busy.set(false);
    this.show(r.ok ? 'Dados da nuvem apagados. A sincronização ficou em pausa: retoma quando quiseres enviar tudo outra vez.' : r.message, !r.ok);
  }

  /** Ligar pede confirmação: as fotos são dados de saúde e passam a sair do dispositivo. Desligar é imediato. */
  async togglePhotos(on: boolean, toggle?: { checked: boolean }): Promise<void> {
    if (on === this.photosOn()) return;
    if (!on) {
      await this.sync.setPhotoSync(false);
      this.show('As fotos deste dispositivo deixam de ser enviadas. As que já estão na nuvem ficam até as apagares.', false);
      return;
    }
    const alert = await this.alerts.create({
      header: 'Enviar fotos para a nuvem?',
      message: 'As fotos de progresso deste dispositivo passam a ser guardadas na tua conta (Supabase) e chegam aos teus outros dispositivos que também tenham esta opção ligada. Podes desligar e apagá-las da nuvem quando quiseres.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Enviar', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') {
      await this.sync.setPhotoSync(true);
      this.show('Fotos a sincronizar.', false);
    } else if (toggle) {
      toggle.checked = false; // cancelaste: o interruptor volta a desligado (o valor guardado nunca mudou)
    }
  }

  async confirmDeletePhotos(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Apagar fotos na nuvem?',
      message: 'Remove da nuvem todas as fotos de progresso desta conta. As fotos guardadas nos dispositivos ficam. Se outro dispositivo tiver «Sincronizar fotos» ligado, volta a enviar as dele. Não dá para desfazer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Apagar', role: 'destructive', handler: () => void this.deletePhotos() },
      ],
    });
    await alert.present();
  }

  private async deletePhotos(): Promise<void> {
    this.busy.set(true);
    if (this.photosOn()) await this.sync.setPhotoSync(false);
    const r = await this.auth.deleteCloudPhotos();
    if (r.ok) await this.sync.forgetPhotos();
    this.busy.set(false);
    this.show(r.ok ? 'Fotos apagadas da nuvem. Ficam só nos dispositivos e o envio está desligado.' : r.message, !r.ok);
  }

  private show(text: string, error: boolean): void {
    this.message.set(text);
    this.isError.set(error);
  }
}
