import { Component, computed, inject, resource, signal } from '@angular/core';
import {
  IonButton, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonSegment, IonSegmentButton,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { trashOutline } from 'ionicons/icons';
import { formatPace, paceBand, weeklyPace } from '../../core/progression/body';
import { bmi, bmiLabel } from '../../core/util/body';
import { toLocalDate } from '../../core/util/week';
import { BODY_TYPES, BodyMetric, BodyMetricError } from '../../data/models/body';
import { CLOCK } from '../../services/clock';
import { BODY_METRIC_REPOSITORY } from '../../services/repositories';
import { SettingsService } from '../../services/settings/settings.service';
import { ToastService } from '../../services/ui/toast.service';

/** Quantas medições se mostram antes de «Ver todas». */
const SHORT_LIST = 5;

/** Peso e medidas ao longo do tempo: último valor, variação, ritmo do peso, IMC, registar e apagar. */
@Component({
  selector: 'app-body-measurements',
  imports: [IonList, IonListHeader, IonItem, IonLabel, IonNote, IonInput, IonButton, IonIcon, IonSegment, IonSegmentButton],
  template: `
    <ion-list lines="full">
      <ion-list-header><ion-label>Peso e medidas</ion-label></ion-list-header>
      <ion-item lines="none">
        <ion-segment [value]="type()" (ionChange)="setType($any($event).detail.value)">
          @for (t of types; track t.type) {
            <ion-segment-button [value]="t.type"><ion-label>{{ t.label }}</ion-label></ion-segment-button>
          }
        </ion-segment>
      </ion-item>
      <ion-item>
        <ion-label>
          <h2 class="big">{{ latest() ? fmt(latest()!.value) + ' ' + unit() : '–' }}</h2>
          @if (delta() !== null) { <p>{{ delta()! > 0 ? '+' : '' }}{{ fmt(delta()!) }} {{ unit() }} desde a medição anterior</p> }
          @if (type() === 'WEIGHT_KG' && paceText(); as pt) { <p class="pace">{{ pt }}</p> }
        </ion-label>
        @if (bmiValue() !== null && type() === 'WEIGHT_KG') {
          <ion-note slot="end">IMC {{ fmt(bmiValue()!) }}<br />{{ bmiText() }}</ion-note>
        }
      </ion-item>
      <ion-item>
        <ion-input [label]="'Novo valor (' + unit() + ')'" labelPlacement="stacked" type="number" inputmode="decimal"
          [value]="value()" (ionInput)="value.set($any($event).detail.value ?? '')" />
        <ion-input label="Dia" labelPlacement="stacked" type="date" [value]="date()" (ionChange)="date.set($any($event).detail.value ?? date())" />
      </ion-item>
      <ion-item lines="none">
        <ion-button (click)="add()" [disabled]="!value()">Registar</ion-button>
      </ion-item>
      @if (error()) { <ion-item lines="none"><ion-label class="ion-text-wrap"><p class="error">{{ error() }}</p></ion-label></ion-item> }
    </ion-list>

    @if (shown().length) {
      <ion-list lines="full">
        @for (m of shown(); track m.id) {
          <ion-item>
            <ion-label>{{ fmt(m.value) }} {{ unit() }} <ion-note>{{ day(m.date) }}</ion-note></ion-label>
            <ion-button slot="end" fill="clear" color="medium" (click)="remove(m)" aria-label="Apagar medição">
              <ion-icon slot="icon-only" name="trash-outline" />
            </ion-button>
          </ion-item>
        }
        @if (hiddenCount() > 0) {
          <ion-item button [detail]="false" lines="none" (click)="showAll.set(true)">
            <ion-label color="primary">Ver todas ({{ hiddenCount() }} mais)</ion-label>
          </ion-item>
        }
      </ion-list>
    }
  `,
  styles: `
    :host { display: block; }
    ion-segment { margin: 4px 0 8px; }
    .big { font-size: 1.8rem; font-weight: 700; color: var(--ion-color-primary); }
    .error { color: var(--ion-color-danger); }
    .pace { color: var(--ion-color-medium); }
    ion-item ion-input + ion-input { margin-inline-start: 12px; }
  `,
})
export class BodyMeasurementsComponent {
  private readonly settings = inject(SettingsService);
  private readonly bodyRepo = inject(BODY_METRIC_REPOSITORY);
  private readonly toasts = inject(ToastService);
  private readonly clock = inject(CLOCK);

  readonly types = BODY_TYPES;
  private readonly height = this.settings.get('profileHeightCm');
  private readonly goal = this.settings.get('profileGoal');
  private readonly level = this.settings.get('profileLevel');

  readonly type = signal<string>('WEIGHT_KG');
  readonly value = signal('');
  readonly date = signal(toLocalDate(this.clock.now()));
  readonly error = signal<string | null>(null);
  readonly showAll = signal(false);

  readonly unit = computed(() => BODY_TYPES.find((t) => t.type === this.type())?.unit ?? '');

  readonly history = resource({ params: () => this.type(), loader: ({ params }) => this.bodyRepo.list(params, 30) });
  private readonly weights = resource({ loader: () => this.bodyRepo.list('WEIGHT_KG', 1) });
  private readonly weightHistory = resource({ params: () => this.history.value(), loader: () => this.bodyRepo.list('WEIGHT_KG', 60) });

  readonly latest = computed(() => this.history.value()?.[0] ?? null);
  readonly delta = computed(() => {
    const h = this.history.value();
    return h && h.length > 1 ? Math.round((h[0].value - h[1].value) * 100) / 100 : null;
  });
  readonly shown = computed(() => {
    const h = this.history.value() ?? [];
    return this.showAll() ? h : h.slice(0, SHORT_LIST);
  });
  readonly hiddenCount = computed(() => (this.history.value()?.length ?? 0) - this.shown().length);
  readonly bmiValue = computed(() => bmi(this.weights.value()?.[0]?.value, this.height()));
  readonly bmiText = computed(() => (this.bmiValue() === null ? '' : bmiLabel(this.bmiValue()!)));
  readonly paceText = computed(() => {
    const pct = weeklyPace((this.weightHistory.value() ?? []).map((m) => ({ date: m.date, value: m.value })), toLocalDate(this.clock.now()));
    if (pct === null) return 'Ritmo: faltam pesagens (3 em cada uma das últimas 2 semanas).';
    const band = paceBand(this.goal(), this.level());
    return `Ritmo: ${formatPace(pct)}${band ? ` · alvo ${band.text}` : ''}`;
  });

  constructor() {
    addIcons({ trashOutline });
  }

  fmt = (n: number) => n.toLocaleString('pt-PT', { maximumFractionDigits: 2 });
  day = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');

  setType(t: string): void {
    this.type.set(t);
    this.showAll.set(false);
  }

  /** Para o ecrã recarregar ao voltar (outro dispositivo pode ter sincronizado). */
  reload(): void {
    this.history.reload();
    this.weights.reload();
  }

  async add(): Promise<void> {
    this.error.set(null);
    try {
      await this.bodyRepo.add({ date: this.date(), type: this.type(), value: Number(this.value().replace(',', '.')) });
      this.value.set('');
      this.reload();
    } catch (err) {
      this.error.set(err instanceof BodyMetricError ? err.message : 'Não foi possível guardar.');
    }
  }

  async remove(m: BodyMetric): Promise<void> {
    await this.bodyRepo.remove(m.id);
    this.reload();
    await this.toasts.info('Medição apagada.', 1500);
  }
}
