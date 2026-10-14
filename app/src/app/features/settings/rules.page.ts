import { Component, computed, signal } from '@angular/core';
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonListHeader, IonSegment,
  IonSegmentButton, IonTitle, IonToolbar,
} from '@ionic/angular';
import { AREA_LABEL, RULES, type RuleArea, type RuleMark } from '../../core/progression/rules';
import { RuleWhyComponent } from '../../shared/rule-why.component';

/** Ajuda → Regras e fontes: todas as regras de progressão, cada uma com a marca, o valor e a fonte. */
@Component({
  selector: 'app-rules',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonList, IonListHeader, IonLabel, IonItem,
    IonSegment, IonSegmentButton, RuleWhyComponent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/definicoes" /></ion-buttons>
        <ion-title>Regras e fontes</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page">
        <p class="intro">Cada regra diz de onde vem. <strong>Fonte</strong>: o número está num estudo ou posição oficial que abrimos.
          <strong>Escolha da app</strong>: nenhuma fonte dá o número e a app precisa de um. Orientação geral de treino, não aconselhamento médico.</p>
        <ion-segment [value]="filter()" (ionChange)="filter.set($any($event).detail.value)">
          <ion-segment-button value="all"><ion-label>Todas</ion-label></ion-segment-button>
          <ion-segment-button value="source"><ion-label>Fonte</ion-label></ion-segment-button>
          <ion-segment-button value="app"><ion-label>Escolha da app</ion-label></ion-segment-button>
        </ion-segment>
        @for (g of groups(); track g.area) {
          <ion-list lines="full">
            <ion-list-header><ion-label>{{ g.label }}</ion-label></ion-list-header>
            @for (r of g.rules; track r.key) {
              <ion-item><app-rule-why class="item" [value]="r" /></ion-item>
            }
          </ion-list>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 720px; margin: 0 auto; padding-bottom: 24px; }
    .intro { padding: 12px 16px 4px; margin: 0; font-size: 14px; line-height: 1.5; color: var(--ion-color-medium); }
    ion-segment { margin: 8px 16px; width: auto; }
    .item { padding: 10px 0; width: 100%; }
  `,
})
export class RulesPage {
  readonly filter = signal<'all' | RuleMark>('all');
  readonly groups = computed(() => {
    const f = this.filter();
    const areas = Object.keys(AREA_LABEL) as RuleArea[];
    return areas
      .map((area) => ({ area, label: AREA_LABEL[area], rules: RULES.filter((r) => r.area === area && (f === 'all' || r.mark === f)) }))
      .filter((g) => g.rules.length);
  });
}
