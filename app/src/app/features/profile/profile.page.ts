import { ProgressionService } from '../../services/progression/progression.service';
import { defaultRepRange } from '../../core/progression/goals';
import { paceBand } from '../../core/progression/body';
import { RuleWhyComponent } from '../../shared/rule-why.component';
import { NoticeCardsComponent } from '../../shared/suggestion-cards.component';
import { RouterLink } from '@angular/router';
import { Component, computed, inject, resource, signal } from '@angular/core';
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote,
  IonSelect, IonSelectOption, IonTitle, IonToolbar,
} from '@ionic/angular';
import { SettingsService } from '../../services/settings/settings.service';
import { ageOn } from '../../core/util/body';
import { CLOCK } from '../../services/clock';
import { toLocalDate } from '../../core/util/week';

/** Perfil (nome, nascimento, sexo, altura, objetivo e nível), com acesso a Conta, Definições e Regras e fontes. */

@Component({
  selector: 'app-profile',
  imports: [RouterLink, IonButtons, IonBackButton, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonItem, IonLabel, IonInput, IonNote, IonSelect,
    IonSelectOption, IonIcon, RuleWhyComponent, NoticeCardsComponent,
  ],
  template: `
    <ion-header><ion-toolbar><ion-buttons slot="start"><ion-back-button defaultHref="/home" text="" /></ion-buttons><ion-title>Perfil</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="page">
        <ion-list lines="full">
          <ion-item button detail routerLink="/conta">
            <ion-icon slot="start" name="cloud-done-outline" aria-hidden="true" />
            <ion-label>Conta e sincronização</ion-label>
          </ion-item>
          <ion-item button detail routerLink="/definicoes">
            <ion-icon slot="start" name="settings-outline" aria-hidden="true" />
            <ion-label>Definições</ion-label>
          </ion-item>
          <ion-item button detail routerLink="/definicoes/regras">
            <ion-icon slot="start" name="book-outline" aria-hidden="true" />
            <ion-label>Regras e fontes</ion-label>
          </ion-item>
        </ion-list>

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
          <ion-item button detail routerLink="/corpo">
            <ion-icon slot="start" name="body-outline" aria-hidden="true" />
            <ion-label class="ion-text-wrap"><h3>Peso, medidas e fotos</h3><p>Em Progresso → Corpo</p></ion-label>
          </ion-item>
        </ion-list>
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; }
    .goal-info p { font-size: 13px; }
    .whybtn { font: inherit; font-size: 13px; font-weight: 600; border: 0; background: none; color: var(--ion-color-primary); padding: 0; }
    .rules { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
    .notices { padding: 8px 16px 0; }
  `,
})
export class ProfilePage {
  protected readonly settings = inject(SettingsService);
  private readonly clock = inject(CLOCK);

  readonly name = this.settings.get('profileName');
  readonly birth = this.settings.get('profileBirthDate');
  readonly sex = this.settings.get('profileSex');
  readonly height = this.settings.get('profileHeightCm');
  readonly goal = this.settings.get('profileGoal');
  readonly level = this.settings.get('profileLevel');

  readonly age = computed(() => ageOn(this.birth(), toLocalDate(this.clock.now())));


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

  async saveGoal(v: 'hypertrophy' | 'strength' | 'power' | 'endurance' | 'maintenance' | 'cut'): Promise<void> {
    if (v === this.goal()) return;
    await this.settings.set('profileGoal', v);
    await this.settings.set('profileGoalChangedAt', this.clock.nowIso());
  }


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
}
