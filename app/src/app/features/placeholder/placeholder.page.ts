import { Component, input } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

/** Ecrã provisório para as rotas das fases seguintes. */
@Component({
  selector: 'app-placeholder',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  template: `
    <ion-header><ion-toolbar><ion-title>{{ title() }}</ion-title></ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <div class="empty">
        <span class="phase">{{ phase() }}</span>
        <h2>{{ title() }}</h2>
        <p>{{ description() }}</p>
      </div>
    </ion-content>
  `,
  styles: `
    .empty { max-width: 420px; margin: 18vh auto 0; text-align: center; }
    .phase {
      display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 600;
      background: rgba(var(--ion-color-primary-rgb), 0.12); color: var(--ion-color-primary);
    }
    h2 { margin: 12px 0 6px; font-weight: 700; }
    p { color: var(--ion-color-medium); margin: 0; }
  `,
})
export class PlaceholderPage {
  readonly title = input('');
  readonly phase = input('');
  readonly description = input('');
}
