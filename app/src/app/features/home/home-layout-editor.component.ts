import { Component, computed, inject } from '@angular/core';
import { IonItem, IonList, IonNote, IonReorder, IonReorderGroup, IonToggle } from '@ionic/angular';
import { SettingsService } from '../../services/settings/settings.service';
import { normalizeWidgets, WIDGETS } from './home-widgets.component';

/** Modo «Editar» da Home: arrasta pela pega para reordenar e liga/desliga cada widget. */
@Component({
  selector: 'app-home-layout-editor',
  imports: [IonList, IonItem, IonNote, IonReorder, IonReorderGroup, IonToggle],
  template: `
    <ion-note class="hint">Arrasta pela pega para mudar a ordem. Desliga o interruptor para esconder um widget.</ion-note>
    <ion-list lines="full">
      <ion-reorder-group [disabled]="false" (ionReorderEnd)="onReorder($any($event))">
        @for (w of all(); track w.id) {
          <ion-item>
            <ion-toggle [checked]="w.on" (ionChange)="toggle(w.id, $any($event).detail.checked)">{{ w.label }}</ion-toggle>
            <ion-reorder slot="end" />
          </ion-item>
        }
      </ion-reorder-group>
    </ion-list>
  `,
  styles: `
    .hint { display: block; padding: 4px 0 10px; }
    ion-list { border-radius: 14px; overflow: hidden; }
  `,
})
export class HomeLayoutEditorComponent {
  private readonly settings = inject(SettingsService);
  private readonly saved = this.settings.get('homeWidgets');

  /** Ligados na ordem guardada, seguidos dos desligados. */
  readonly all = computed(() => {
    const on = normalizeWidgets(this.saved());
    const off = WIDGETS.filter((w) => !on.includes(w.id)).map((w) => w.id);
    return [...on, ...off].map((id) => ({ id, label: WIDGETS.find((w) => w.id === id)!.label, on: on.includes(id) }));
  });

  async onReorder(ev: { detail: { from: number; to: number; complete: () => void } }): Promise<void> {
    const list = this.all().map((w) => w);
    const [moved] = list.splice(ev.detail.from, 1);
    list.splice(ev.detail.to, 0, moved);
    ev.detail.complete();
    await this.settings.set('homeWidgets', list.filter((w) => w.on).map((w) => w.id));
  }

  async toggle(id: string, on: boolean): Promise<void> {
    const cur = normalizeWidgets(this.saved());
    await this.settings.set('homeWidgets', on ? [...cur.filter((x) => x !== id), id] : cur.filter((x) => x !== id));
  }
}
