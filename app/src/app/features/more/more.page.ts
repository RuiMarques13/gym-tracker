import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonTitle, IonToolbar } from '@ionic/angular';
import { NAV_ITEMS } from '../../core/navigation/nav-items';

/** No telemóvel, os ecrãs que não cabem nos separadores. */
@Component({
  selector: 'app-more',
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonLabel],
  template: `
    <ion-header><ion-toolbar><ion-title>Mais</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <ion-list lines="full">
        @for (item of items; track item.path) {
          <ion-item [routerLink]="item.path" [detail]="true" button>
            <ion-icon slot="start" [name]="item.icon" aria-hidden="true" />
            <ion-label>{{ item.label }}</ion-label>
          </ion-item>
        }
      </ion-list>
    </ion-content>
  `,
})
export class MorePage {
  readonly items = NAV_ITEMS.filter((i) => !i.tab);
}
