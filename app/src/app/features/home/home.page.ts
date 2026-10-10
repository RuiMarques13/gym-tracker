import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { DatabaseService } from '../../core/db/database.service';
import { EXERCISE_REPOSITORY } from '../../data/repositories/providers';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle,
    IonCardSubtitle, IonCardContent, IonList, IonItem, IonLabel, IonNote, IonIcon,
  ],
  template: `
    <ion-header>
      <ion-toolbar><ion-title>Home</ion-title></ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="page">
        <h1 class="greeting">Bom treino.</h1>
        <p class="lede">Os teus exercícios já se gerem aqui. Treinos e sessões são os próximos passos.</p>

        <p class="stats-title">Os teus exercícios</p>
        <div class="stats">
          <a class="stat" routerLink="/exercicios" [queryParams]="{ kind: 'STRENGTH' }">
            <span class="value">{{ counts.value()?.strength ?? '–' }}</span>
            <span class="label">de força</span>
          </a>
          <a class="stat" routerLink="/exercicios" [queryParams]="{ kind: 'MOBILITY' }">
            <span class="value">{{ counts.value()?.mobility ?? '–' }}</span>
            <span class="label">de mobilidade</span>
          </a>
          <a class="stat" routerLink="/exercicios" [queryParams]="{ kind: 'CARDIO' }">
            <span class="value">{{ counts.value()?.cardio ?? '–' }}</span>
            <span class="label">de cardio</span>
          </a>
        </div>

        <ion-card>
          <ion-card-header>
            <ion-card-subtitle>Diagnóstico</ion-card-subtitle>
            <ion-card-title>Base de dados local</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            @if (status().error; as err) {
              <p class="error"><ion-icon name="alert-circle-outline" /> {{ err }}</p>
            }
            <ion-list lines="full">
              <ion-item>
                <ion-label>Estado</ion-label>
                <ion-note slot="end" [class.ok]="status().ready">{{ status().ready ? 'Pronta' : 'A iniciar…' }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>Versão do esquema</ion-label>
                <ion-note slot="end">{{ status().schemaVersion }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>Versão do seed</ion-label>
                <ion-note slot="end">{{ status().seedVersion }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>Dispositivo</ion-label>
                <ion-note slot="end" class="mono">{{ shortDevice() }}</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-label>Armazenamento persistente</ion-label>
                <ion-note slot="end">{{ persistentLabel() }}</ion-note>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; }
    .greeting { font-size: 1.9rem; font-weight: 700; margin: 8px 0 4px; letter-spacing: -0.01em; }
    .lede { color: var(--ion-color-medium); margin: 0 0 20px; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
    .stats-title { font-size: 0.8rem; color: var(--ion-color-medium); margin: 0 0 6px; }
    .stat {
      display: flex; flex-direction: column; gap: 4px; padding: 16px; border-radius: 14px;
      background: var(--ion-background-color-step-50, rgba(127,127,127,0.08)); text-decoration: none; color: inherit;
    }
    .stat .value { font-size: 2rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ion-color-primary); }
    .stat .label { font-size: 0.85rem; color: var(--ion-color-medium); }
    ion-card { margin: 12px 0 0; box-shadow: none; border: 1px solid var(--ion-background-color-step-150, rgba(127,127,127,0.2)); }
    ion-card-content { padding: 0 0 8px; }
    .ok { color: var(--ion-color-success); }
    .mono { font-family: ui-monospace, monospace; font-size: 0.85rem; }
    .error { color: var(--ion-color-danger); padding: 0 16px; }
  `,
})
export class HomePage {
  private readonly database = inject(DatabaseService);
  private readonly exercises = inject(EXERCISE_REPOSITORY);

  readonly status = this.database.status;
  readonly shortDevice = computed(() => this.status().deviceId?.slice(0, 8) ?? '–');
  readonly persistentLabel = computed(() => {
    const p = this.status().persistentStorage;
    return p === null ? 'n/d (nativo)' : p ? 'Sim' : 'Não concedido';
  });

  readonly counts = resource({
    loader: async () => {
      const all = await this.exercises.list();
      return {
        strength: all.filter((e) => e.kind === 'STRENGTH').length,
        mobility: all.filter((e) => e.kind === 'MOBILITY').length,
        cardio: all.filter((e) => e.kind === 'CARDIO').length,
      };
    },
  });
}
