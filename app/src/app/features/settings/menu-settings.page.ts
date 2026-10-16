import { Component, computed, inject } from '@angular/core';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonList, IonNote,
  IonReorder, IonReorderGroup, IonTitle, IonToggle, IonToolbar,
} from '@ionic/angular';
import { orderedNav } from '../../core/navigation/nav-items';
import { SettingsService } from '../../services/settings/settings.service';

/** Personalizar o menu lateral: arrastar para reordenar, interruptor para esconder. */
@Component({
  selector: 'app-menu-settings',
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonList, IonItem,
    IonIcon, IonNote, IonReorder, IonReorderGroup, IonToggle,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/definicoes" /></ion-buttons>
        <ion-title>Personalizar menu</ion-title>
        <ion-buttons slot="end"><ion-button (click)="reset()">Repor</ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        <ion-note class="hint">Arrasta pela pega para mudar a ordem. Desliga o interruptor para esconder um ecrã do menu.</ion-note>
        <ion-list lines="full">
          <ion-reorder-group [disabled]="false" (ionReorderEnd)="onReorder($any($event))">
            @for (item of list(); track item.path) {
              <ion-item>
                <ion-icon slot="start" [name]="item.icon" aria-hidden="true" />
                <ion-toggle [checked]="!hidden().includes(item.path)" [disabled]="item.locked"
                  (ionChange)="toggle(item.path, $any($event).detail.checked)">{{ item.label }}</ion-toggle>
                <ion-reorder slot="end" />
              </ion-item>
            }
          </ion-reorder-group>
        </ion-list>
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 640px; margin: 0 auto; }
    .hint { display: block; padding: 14px 16px 6px; }
  `,
})
export class MenuSettingsPage {
  private readonly settings = inject(SettingsService);
  readonly order = this.settings.get('navOrder');
  readonly hidden = this.settings.get('navHidden');
  readonly list = computed(() => orderedNav(this.order()));

  async onReorder(ev: { detail: { from: number; to: number; complete: () => void } }): Promise<void> {
    const paths = this.list().map((i) => i.path);
    const [moved] = paths.splice(ev.detail.from, 1);
    paths.splice(ev.detail.to, 0, moved);
    ev.detail.complete();
    await this.settings.set('navOrder', paths);
  }

  async toggle(path: string, on: boolean): Promise<void> {
    const h = new Set(this.hidden());
    if (on) h.delete(path);
    else h.add(path);
    await this.settings.set('navHidden', [...h]);
  }

  async reset(): Promise<void> {
    await this.settings.set('navOrder', []);
    await this.settings.set('navHidden', []);
  }
}
