import { ProgressionService } from '../../core/progression/progression.service';
import { defaultRepRange } from '../../core/progression/goals';
import { formatPace, paceBand, weeklyPace } from '../../core/progression/body';
import { RuleWhyComponent } from '../../shared/rule-why.component';
import { NoticeCardsComponent } from '../../shared/suggestion-cards.component';
import { NavButtonComponent } from '../../shared/nav-button.component';
import { Component, computed, inject, resource, signal } from '@angular/core';
import {
  IonButton, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonSegment, IonSegmentButton,
  IonSelect, IonSelectOption, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { trashOutline } from 'ionicons/icons';
import { SettingsService } from '../../core/settings/settings.service';
import { ageOn, bmi, bmiLabel } from '../../core/util/body';
import { CLOCK } from '../../core/util/clock';
import { toLocalDate } from '../../core/util/week';
import { BODY_TYPES, BodyMetric, BodyMetricError } from '../../data/models/body';
import { BODY_METRIC_REPOSITORY } from '../../data/repositories/providers';

/** Perfil (nome, nascimento, sexo, altura) e medições corporais ao longo do tempo. */
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-profile',
  imports: [NavButtonComponent, 
    IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonItem, IonLabel, IonInput, IonNote, IonSelect,
    IonSelectOption, IonSegment, IonSegmentButton, IonButton, IonIcon, RuleWhyComponent, NoticeCardsComponent,
  ],
  template: `
    <ion-header><ion-toolbar><app-nav-button slot="start" /><ion-title>Perfil</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page">
        <ion-list lines="full">
          <ion-list-header><ion-label>Sobre ti</ion-label></ion-list-header>
          <ion-item>
            <ion-input label="Nome" labelPlacement="stacked" [value]="name()" (ionBlur)="saveName($any($event).target.value)" />
          </ion-item>
          <ion-item>
            <ion-input label="Data de nascimento" labelPlacement="stacked" type="date" [value]="birth() ?? ''"
              (ionChange)="saveBirth($any($event).detail.value)" />
            @if (age() !== null) { <ion-note slot="end">{{ age() }} anos</ion-note> }
          </ion-item>
          <ion-item>
            <ion-select label="Sexo" labelPlacement="stacked" [value]="sex()" interface="popover" placeholder="Não indicado"
              (ionChange)="saveSex($any($event).detail.value)">
              <ion-select-option value="F">Feminino</ion-select-option>
              <ion-select-option value="M">Masculino</ion-select-option>
              <ion-select-option value="O">Outro</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-input label="Altura (cm)" labelPlacement="stacked" type="number" inputmode="numeric" [value]="height() ?? ''"
              (ionBlur)="saveHeight($any($event).target.value)" />
          </ion-item>
        </ion-list>

        <ion-list lines="full">
          <ion-list-header><ion-label>Treino</ion-label></ion-list-header>
          <ion-item>
            <ion-select label="Objetivo" labelPlacement="stacked" [value]="goal()" interface="popover"
              (ionChange)="saveGoal($any($event).detail.value)">
              <ion-select-option value="hypertrophy">Ganhar massa (hipertrofia)</ion-select-option>
              <ion-select-option value="strength">Força</ion-select-option>
              <ion-select-option value="power">Potência</ion-select-option>
              <ion-select-option value="endurance">Resistência muscular</ion-select-option>
              <ion-select-option value="maintenance">Manutenção</ion-select-option>
              <ion-select-option value="cut">Definição (perder gordura)</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-select label="Nível" labelPlacement="stacked" [value]="level()" interface="popover"
              (ionChange)="settings.set('profileLevel', $any($event).detail.value)">
              <ion-select-option value="beginner">Iniciante (menos de ~6 meses)</ion-select-option>
              <ion-select-option value="intermediate">Intermédio (~6 meses a 3 anos)</ion-select-option>
              <ion-select-option value="advanced">Avançado (mais de 3 anos)</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item lines="none">
            <ion-label class="ion-text-wrap goal-info">
              <p>{{ goalInfo() }}</p>
              <p><button type="button" class="whybtn" (click)="whyGoal.set(!whyGoal())">{{ whyGoal() ? 'Fechar' : 'Porquê? e proteína' }}</button></p>
              @if (whyGoal()) {
                <div class="rules">@for (r of goalRules(); track r) { <app-rule-why [key]="r" /> }</div>
              }
            </ion-label>
          </ion-item>
          @if (levelNotices().length) {
            <div class="notices"><app-notice-cards [notices]="levelNotices()" (changed)="notices.reload()" /></div>
          }
        </ion-list>

        <ion-list lines="full">
          <ion-list-header><ion-label>Medições</ion-label></ion-list-header>
          <ion-item lines="none">
            <ion-segment [value]="type()" (ionChange)="type.set($any($event).detail.value)">
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

        @if (history.value()?.length) {
          <ion-list lines="full">
            @for (m of history.value()!; track m.id) {
              <ion-item>
                <ion-label>{{ fmt(m.value) }} {{ unit() }} <ion-note>{{ day(m.date) }}</ion-note></ion-label>
                <ion-button slot="end" fill="clear" color="medium" (click)="remove(m)" aria-label="Apagar medição">
                  <ion-icon slot="icon-only" name="trash-outline" />
                </ion-button>
              </ion-item>
            }
          </ion-list>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; }
    ion-segment { margin: 4px 0 8px; }
    .big { font-size: 1.8rem; font-weight: 700; color: var(--ion-color-primary); }
    .error { color: var(--ion-color-danger); }
    .goal-info p { font-size: 13px; }
    .whybtn { font: inherit; font-size: 13px; font-weight: 600; border: 0; background: none; color: var(--ion-color-primary); padding: 0; }
    .rules { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
    .notices { padding: 8px 16px 0; }
    .pace { color: var(--ion-color-medium); }
    ion-item ion-input + ion-input { margin-inline-start: 12px; }
  `,
})
export class ProfilePage {
  protected readonly settings = inject(SettingsService);
  private readonly bodyRepo = inject(BODY_METRIC_REPOSITORY);
  private readonly toasts = inject(ToastService);
  private readonly clock = inject(CLOCK);

  readonly types = BODY_TYPES;
  readonly name = this.settings.get('profileName');
  readonly birth = this.settings.get('profileBirthDate');
  readonly sex = this.settings.get('profileSex');
  readonly height = this.settings.get('profileHeightCm');
  readonly goal = this.settings.get('profileGoal');
  readonly level = this.settings.get('profileLevel');

  readonly type = signal<string>('WEIGHT_KG');
  readonly value = signal('');
  readonly date = signal(toLocalDate(this.clock.now()));
  readonly error = signal<string | null>(null);

  readonly unit = computed(() => BODY_TYPES.find((t) => t.type === this.type())?.unit ?? '');
  readonly age = computed(() => ageOn(this.birth(), toLocalDate(this.clock.now())));

  readonly history = resource({ params: () => this.type(), loader: ({ params }) => this.bodyRepo.list(params, 30) });
  private readonly weights = resource({ loader: () => this.bodyRepo.list('WEIGHT_KG', 1) });
  readonly latest = computed(() => this.history.value()?.[0] ?? null);
  readonly delta = computed(() => {
    const h = this.history.value();
    return h && h.length > 1 ? Math.round((h[0].value - h[1].value) * 100) / 100 : null;
  });
  readonly bmiValue = computed(() => bmi(this.weights.value()?.[0]?.value, this.height()));
  readonly bmiText = computed(() => (this.bmiValue() === null ? '' : bmiLabel(this.bmiValue()!)));

  constructor() {
    addIcons({ trashOutline });
  }

  private readonly progression = inject(ProgressionService);
  readonly whyGoal = signal(false);
  readonly notices = resource({ params: () => this.level(), loader: () => this.progression.notices() });
  readonly levelNotices = computed(() => (this.notices.value() ?? []).filter((n) => n.key.startsWith('level:')));
  readonly goalInfo = computed(() => {
    const [a, b] = defaultRepRange(this.goal(), this.level());
    switch (this.goal()) {
      case 'strength':
        return `Treinos novos com ${a}–${b} repetições, 3 séries; carga perto de 80% do teu 1RM estimado; 3 min de descanso nos multiarticulares. O peso não é vigiado.`;
      case 'power':
        return `Treinos novos com ${a}–${b} repetições; carga a 30–70% do teu 1RM estimado, o mais rápido possível na subida; 3 min nos multiarticulares. A app não mede a velocidade. O peso não é vigiado.`;
      case 'endurance':
        return `Treinos novos com ${a}–${b} repetições; carga leve (40–60% do teu 1RM estimado); 1 min de descanso. O peso não é vigiado.`;
      case 'cut':
        return `A app vigia o ritmo de peso (−0,5 a −1% por semana) e baixa o volume 25% se o desempenho cair 2 semanas.`;
      case 'maintenance':
        return `Volume mínimo para manter; a app vigia se o peso fica estável (±0,25% por semana).`;
      default:
        return `Treinos novos com ${a}–${b} repetições; a app vigia o ritmo de peso (${paceBand('hypertrophy', this.level())!.text}).`;
    }
  });
  readonly goalRules = computed(() => {
    const g = this.goal();
    const pace = paceBand(g, this.level())?.rule;
    const base = g === 'strength' ? ['goal.strength.reps', 'goal.strength.load', 'goal.strength.rest', 'goal.strength.volume']
      : g === 'power' ? ['goal.power.reps', 'goal.power.load', 'goal.power.rest', 'goal.strength.volume']
      : g === 'endurance' ? ['goal.endurance.reps', 'goal.endurance.load', 'goal.endurance.rest', 'goal.strength.volume']
      : ['goal.hypertrophy.reps'];
    return [...base, ...(pace ? ['pace.measure', pace] : []), 'level.definition', 'goal.nutrition'];
  });
  private readonly weightHistory = resource({ params: () => this.history.value(), loader: () => this.bodyRepo.list('WEIGHT_KG', 60) });
  readonly paceText = computed(() => {
    const pct = weeklyPace((this.weightHistory.value() ?? []).map((m) => ({ date: m.date, value: m.value })), toLocalDate(this.clock.now()));
    if (pct === null) return 'Ritmo: faltam pesagens (3 em cada uma das últimas 2 semanas).';
    const band = paceBand(this.goal(), this.level());
    return `Ritmo: ${formatPace(pct)}${band ? ` · alvo ${band.text}` : ''}`;
  });

  async saveGoal(v: 'hypertrophy' | 'strength' | 'power' | 'endurance' | 'maintenance' | 'cut'): Promise<void> {
    if (v === this.goal()) return;
    await this.settings.set('profileGoal', v);
    await this.settings.set('profileGoalChangedAt', this.clock.nowIso());
  }

  fmt = (n: number) => n.toLocaleString('pt-PT', { maximumFractionDigits: 2 });
  day = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');

  saveName(v: string): void {
    void this.settings.set('profileName', (v ?? '').trim().slice(0, 80));
  }
  saveBirth(v: string): void {
    void this.settings.set('profileBirthDate', /^\d{4}-\d{2}-\d{2}$/.test(v ?? '') ? v : null);
  }
  saveSex(v: 'F' | 'M' | 'O' | null): void {
    void this.settings.set('profileSex', v ?? null);
  }
  saveHeight(v: string): void {
    const n = Number(String(v ?? '').replace(',', '.'));
    void this.settings.set('profileHeightCm', Number.isFinite(n) && n >= 50 && n <= 260 ? Math.round(n) : null);
  }

  async add(): Promise<void> {
    this.error.set(null);
    try {
      await this.bodyRepo.add({ date: this.date(), type: this.type(), value: Number(this.value().replace(',', '.')) });
      this.value.set('');
      this.history.reload();
      this.weights.reload();
    } catch (err) {
      this.error.set(err instanceof BodyMetricError ? err.message : 'Não foi possível guardar.');
    }
  }

  async remove(m: BodyMetric): Promise<void> {
    await this.bodyRepo.remove(m.id);
    this.history.reload();
    this.weights.reload();
    await this.toasts.info('Medição apagada.', 1500);
  }
}
