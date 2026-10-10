import { Component, inject } from '@angular/core';
import {
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
  IonToolbar,
} from '@ionic/angular';
import { SettingsService } from '../../core/settings/settings.service';

@Component({
  selector: 'app-settings',
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonItem, IonLabel, IonNote,
    IonSegment, IonSegmentButton,
  ],
  template: `
    <ion-header>
      <ion-toolbar><ion-title>Definições</ion-title></ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        <ion-list>
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
          <ion-item lines="none">
            <ion-label class="ion-text-wrap">
              <p>Mais definições editáveis chegam com os ecrãs da Fase 1.</p>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>
    </ion-content>
  `,
  styles: `.page { max-width: 760px; margin: 0 auto; } ion-segment { margin: 4px 0 12px; }`,
})
export class SettingsPage {
  private readonly settings = inject(SettingsService);
  readonly theme = this.settings.get('theme');
  readonly rest = this.settings.get('defaultRestSeconds');
  readonly secondary = this.settings.get('secondaryMuscleWeight');

  setTheme(value: 'system' | 'light' | 'dark'): void {
    void this.settings.set('theme', value);
  }
}
