import { Component, computed, inject } from '@angular/core';
import { IonLabel, IonSegment, IonSegmentButton, IonToolbar, NavController } from '@ionic/angular';
import { sectionForUrl } from '../core/navigation/tabs';
import { NavStateService } from '../services/ui/nav-state.service';

/**
 * Segmento com as secções do separador atual (por exemplo Treinos · Semana · Ciclos).
 * Vai no ion-header, por baixo da barra do título: `<app-section-tabs />`.
 * Num separador com uma só secção não mostra nada.
 */
@Component({
  selector: 'app-section-tabs',
  imports: [IonToolbar, IonSegment, IonSegmentButton, IonLabel],
  template: `
    @if (hit(); as h) {
      @if (h.tab.sections.length > 1) {
        <ion-toolbar class="sections">
          <ion-segment [value]="h.section.path" (ionChange)="go($any($event).detail.value)">
            @for (s of h.tab.sections; track s.path) {
              <ion-segment-button [value]="s.path"><ion-label>{{ s.label }}</ion-label></ion-segment-button>
            }
          </ion-segment>
        </ion-toolbar>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .sections { --min-height: 52px; --padding-start: 12px; --padding-end: 12px; }
    ion-segment { max-width: 640px; margin: 0 auto; }
    ion-segment-button { min-height: 44px; --padding-start: 4px; --padding-end: 4px; }
    ion-label { font-weight: 700; }
  `,
})
export class SectionTabsComponent {
  private readonly nav = inject(NavController);
  private readonly state = inject(NavStateService);
  readonly hit = computed(() => sectionForUrl(this.state.url()));

  go(path: string | undefined): void {
    if (!path || path === this.hit()?.section.path) return;
    void this.nav.navigateRoot(path, { animated: false });
  }
}
