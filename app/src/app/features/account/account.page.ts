import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList,
  IonListHeader, IonNote, IonSegment, IonSegmentButton, IonTitle, IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../../core/cloud/auth.service';

/** Conta na nuvem: entrar, criar conta, sair e apagar os dados da nuvem. Opcional: a app funciona sem conta. */
@Component({
  selector: 'app-account',
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonList, IonListHeader, IonItem, IonLabel,
    IonInput, IonButton, IonNote, IonSegment, IonSegmentButton,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        @if (!inicio()) {
          <ion-buttons slot="start"><ion-back-button defaultHref="/definicoes" text="" /></ion-buttons>
        }
        <ion-title>{{ inicio() ? 'Gym Tracker' : 'Conta' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        @switch (auth.state()) {
          @case ('loading') {
            <p class="intro">A verificar a sessão…</p>
          }
          @case ('signedOut') {
            <p class="intro">Com uma conta, os teus treinos passam a estar também na nuvem e a sincronizar entre dispositivos (chega na próxima fase). Sem conta, tudo continua a funcionar só neste dispositivo.</p>
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
            @if (inicio()) {
              <div class="actions">
                <ion-button expand="block" fill="clear" (click)="continueWithout()">Continuar sem conta</ion-button>
              </div>
            }
          }
          @case ('signedIn') {
            <ion-list lines="full">
              <ion-list-header><ion-label>Sessão iniciada</ion-label></ion-list-header>
              <ion-item lines="none">
                <ion-label class="ion-text-wrap">
                  <h3>{{ auth.email() }}</h3>
                  <p>A sincronização entre dispositivos chega na próxima fase. Os teus dados continuam a viver neste dispositivo.</p>
                </ion-label>
              </ion-item>
            </ion-list>
            <div class="actions">
              <ion-button expand="block" fill="outline" (click)="signOut()" [disabled]="busy()">Sair</ion-button>
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
  private readonly router = inject(Router);
  /** Preenchido (?inicio=1) quando a app abre sem sessão e vem direto para aqui. */
  readonly inicio = input<string>();
  private readonly alerts = inject(AlertController);

  readonly mode = signal<'in' | 'up'>('in');
  readonly email = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly message = signal('');
  readonly isError = signal(false);

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
    if (!r.needsConfirmation && this.inicio()) {
      await this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }
    if (r.needsConfirmation) {
      this.mode.set('in');
      this.show('Conta criada. Abre o email que te enviámos, carrega no link e depois entra aqui.', false);
    }
  }

  async continueWithout(): Promise<void> {
    this.auth.skipLogin();
    await this.router.navigateByUrl('/home', { replaceUrl: true });
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
    this.busy.set(false);
    this.show(r.ok ? 'Dados da nuvem apagados.' : r.message, !r.ok);
  }

  private show(text: string, error: boolean): void {
    this.message.set(text);
    this.isError.set(error);
  }
}
