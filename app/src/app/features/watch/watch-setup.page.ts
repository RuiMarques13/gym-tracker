import { Component, computed, inject, signal } from '@angular/core';
import {
  IonBackButton, IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonTitle, IonToolbar,
} from '@ionic/angular';
import { SettingsService } from '../../services/settings/settings.service';
import { TimerService } from '../../services/timer/timer.service';
import { HealthService } from '../../services/health/health.service';

interface Step {
  id: string;
  title: string;
  detail: string;
}

const STEPS: Step[] = [
  { id: 'notifications', title: 'Permitir notificações do Gym Tracker', detail: 'Android: Definições → Aplicações → Gym Tracker → Notificações. Sem isto, o aviso do fim do descanso não aparece com o ecrã bloqueado.' },
  { id: 'channel', title: 'Deixar o canal «Temporizador» com som e vibração', detail: 'Nas notificações da app, abre «Temporizador» e confirma que está em importância alta, com vibração.' },
  { id: 'wearable', title: 'Galaxy Wearable: espelhar as notificações da app', detail: 'Na app Galaxy Wearable → Definições do relógio → Notificações → Gym Tracker: ligado.' },
  { id: 'while-using', title: '«Mostrar alertas mesmo com o telemóvel em uso»', detail: 'Ainda em Notificações do Galaxy Wearable, liga esta opção. Sem ela, o relógio só vibra se o telemóvel estiver bloqueado.' },
  { id: 'battery', title: 'Tirar o Gym Tracker da poupança de bateria', detail: 'Definições → Aplicações → Gym Tracker → Bateria → Sem restrições. Evita que o sistema atrase o aviso.' },
];

/** Passo a passo para o aviso do descanso chegar ao relógio, com um botão para o testar. */
@Component({
  selector: 'app-watch-setup',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonList, IonListHeader, IonItem, IonLabel, IonCheckbox, IonNote],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/definicoes" text="" /></ion-buttons>
        <ion-title>Configurar relógio</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        <p class="intro">O aviso do fim do descanso é uma notificação da app. O Galaxy Watch mostra-a e vibra se as notificações estiverem espelhadas. Segue os passos e depois testa.</p>
        <ion-list lines="full">
          <ion-list-header><ion-label>Passos ({{ done().length }} de {{ steps.length }})</ion-label></ion-list-header>
          @for (s of steps; track s.id) {
            <ion-item>
              <ion-checkbox slot="start" [checked]="isDone(s.id)" (ionChange)="toggle(s.id)" />
              <ion-label class="ion-text-wrap">
                <h3>{{ s.title }}</h3>
                <p>{{ s.detail }}</p>
              </ion-label>
            </ion-item>
          }
        </ion-list>
        <div class="test">
          <ion-button (click)="test()">Testar aviso (5 segundos)</ion-button>
          <p class="note">Põe o telemóvel a dormir antes de acabar os 5 segundos. No browser só toca e vibra dentro da app; a notificação para o relógio só existe na app Android.</p>
        </div>
        <ion-list lines="full">
          <ion-list-header><ion-label>Frequência cardíaca, calorias e passos</ion-label></ion-list-header>
          <ion-item lines="none">
            <ion-label class="ion-text-wrap">
              <p>1) No Samsung Health: Definições → Health Connect (ou «Dados e privacidade») → permite que o Samsung Health escreva no Health Connect (frequência cardíaca, calorias, passos, distância, exercício).
                2) Aqui: autoriza o Gym Tracker a ler tudo (se já tinhas autorizado antes, volta a tocar para aceitar as leituras novas: calorias totais, repouso, passos, distância). 3) No detalhe de cada treino, toca em «Importar do relógio». O relógio demora a sincronizar: abre o Samsung Health no telemóvel antes de importar.</p>
              <p class="note">{{ healthStatus() }}</p>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-button (click)="authorize()">Autorizar Health Connect</ion-button>
            <ion-button fill="outline" (click)="openHealth()">Abrir Health Connect</ion-button>
          </ion-item>
        </ion-list>
        <ion-note class="foot">A app só lê; nada sai deste telemóvel.</ion-note>
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; padding: 8px 0 24px; }
    .intro { padding: 0 16px; color: var(--ion-color-medium); }
    .test { padding: 16px; }
    .note { color: var(--ion-color-medium); font-size: 0.85rem; }
    .foot { display: block; padding: 0 16px; }
  `,
})
export class WatchSetupPage {
  private readonly settings = inject(SettingsService);
  private readonly timer = inject(TimerService);
  private readonly health = inject(HealthService);
  readonly healthStatus = signal('');
  readonly steps = STEPS;
  private readonly checked = this.settings.get('watchChecklist');
  private readonly local = signal<string[] | null>(null);
  readonly done = computed(() => this.local() ?? this.checked());

  isDone = (id: string) => this.done().includes(id);

  toggle(id: string): void {
    const next = this.isDone(id) ? this.done().filter((x) => x !== id) : [...this.done(), id];
    this.local.set(next);
    void this.settings.set('watchChecklist', next);
  }

  async authorize(): Promise<void> {
    const av = await this.health.availability();
    if (!av.available) {
      this.healthStatus.set(av.reason);
      return;
    }
    try {
      this.healthStatus.set((await this.health.requestAccess()) ? 'Autorizado: já podes importar do relógio.' : 'Não autorizado. Tenta de novo ou abre o Health Connect.');
    } catch (err) {
      this.healthStatus.set(err instanceof Error ? err.message : 'Não foi possível pedir a autorização.');
    }
  }

  async openHealth(): Promise<void> {
    try {
      await this.health.openSettings();
    } catch {
      this.healthStatus.set('O Health Connect só abre na app Android.');
    }
  }

  test(): void {
    this.timer.start('REST', 'Teste do aviso', 5);
  }
}
