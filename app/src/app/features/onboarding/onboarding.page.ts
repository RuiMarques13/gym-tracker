import { Component, computed, inject, signal } from '@angular/core';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonList, IonSelect, IonSelectOption, IonTitle, IonToolbar, NavController,
} from '@ionic/angular';
import { SettingsService } from '../../core/settings/settings.service';
import { CLOCK } from '../../core/util/clock';
import { toLocalDate } from '../../core/util/week';
import { BODY_METRIC_REPOSITORY } from '../../data/repositories/providers';

/** Primeira vez: nome, dados básicos e descanso, em quatro passos curtos. Tudo é opcional e editável depois. */
@Component({
  selector: 'app-onboarding',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonInput, IonSelect, IonSelectOption],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Bem-vindo</ion-title>
        <ion-buttons slot="end"><ion-button (click)="finish(null)">Saltar</ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="page">
        <p class="steps">Passo {{ step() + 1 }} de {{ total }}</p>

        @switch (step()) {
          @case (0) {
            <h1>Isto é teu.</h1>
            <p>Gym Tracker guarda os teus treinos de força, mobilidade e cardio neste dispositivo. Funciona sem internet e podes exportar tudo quando quiseres.</p>
            <ion-list>
              <ion-item>
                <ion-input label="Como te chamas?" labelPlacement="stacked" placeholder="Opcional" [value]="name()"
                  (ionInput)="name.set($any($event).detail.value ?? '')" />
              </ion-item>
            </ion-list>
          }
          @case (1) {
            <h1>Sobre ti</h1>
            <p>Serve para calcular a idade e o IMC. Podes saltar e preencher no Perfil.</p>
            <ion-list>
              <ion-item><ion-input label="Altura (cm)" labelPlacement="stacked" type="number" inputmode="numeric" [value]="height()" (ionInput)="height.set($any($event).detail.value ?? '')" /></ion-item>
              <ion-item><ion-input label="Peso (kg)" labelPlacement="stacked" type="number" inputmode="decimal" [value]="weight()" (ionInput)="weight.set($any($event).detail.value ?? '')" /></ion-item>
              <ion-item><ion-input label="Data de nascimento" labelPlacement="stacked" type="date" [value]="birth()" (ionChange)="birth.set($any($event).detail.value ?? '')" /></ion-item>
              <ion-item>
                <ion-select label="Sexo" labelPlacement="stacked" interface="popover" placeholder="Não indicado" [value]="sex()" (ionChange)="sex.set($any($event).detail.value)">
                  <ion-select-option value="F">Feminino</ion-select-option>
                  <ion-select-option value="M">Masculino</ion-select-option>
                  <ion-select-option value="O">Outro</ion-select-option>
                </ion-select>
              </ion-item>
            </ion-list>
          }
          @case (2) {
            <h1>Descanso entre séries</h1>
            <p>O temporizador arranca sozinho quando registas uma série de força. Podes mudar o tempo por exercício ou por treino. Mobilidade e cardio não têm descanso por defeito.</p>
            <ion-list>
              <ion-item><ion-input label="Descanso por defeito (segundos)" labelPlacement="stacked" type="number" inputmode="numeric" [value]="rest()" (ionInput)="rest.set($any($event).detail.value ?? '')" /></ion-item>
            </ion-list>
          }
          @case (3) {
            <h1>Os teus exercícios</h1>
            <p>A biblioteca tem mais de 400 exercícios de força, mobilidade e cardio. Adiciona os que usas com um toque e depois cria os teus treinos.</p>
          }
        }

        <div class="nav">
          @if (step() > 0) { <ion-button fill="outline" (click)="step.set(step() - 1)">Voltar</ion-button> }
          @if (step() < total - 1) {
            <ion-button (click)="step.set(step() + 1)">Seguinte</ion-button>
          } @else {
            <ion-button (click)="finish('/exercicios/biblioteca')">Abrir a biblioteca</ion-button>
            <ion-button fill="outline" (click)="finish('/home')">Mais tarde</ion-button>
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 520px; margin: 4vh auto 0; }
    .steps { color: var(--ion-color-medium); font-size: 0.85rem; margin: 0 0 4px; }
    h1 { margin: 0 0 8px; font-size: 1.8rem; font-weight: 700; }
    p { color: var(--ion-color-medium); }
    .nav { display: flex; gap: 10px; margin-top: 24px; flex-wrap: wrap; }
  `,
})
export class OnboardingPage {
  private readonly settings = inject(SettingsService);
  private readonly body = inject(BODY_METRIC_REPOSITORY);
  private readonly nav = inject(NavController);
  private readonly clock = inject(CLOCK);

  readonly total = 4;
  readonly step = signal(0);
  readonly name = signal('');
  readonly height = signal('');
  readonly weight = signal('');
  readonly birth = signal('');
  readonly sex = signal<'F' | 'M' | 'O' | null>(null);
  readonly rest = signal(String(this.settings.get('defaultRestSeconds')()));
  readonly hasData = computed(() => !!(this.name() || this.height() || this.weight() || this.birth() || this.sex()));

  /** Guarda o que foi preenchido (se `go` não for nulo) e marca a introdução como feita. */
  async finish(go: string | null): Promise<void> {
    if (go !== null) await this.save();
    await this.settings.set('onboardingDone', true);
    await this.nav.navigateRoot(go ?? '/home');
  }

  private async save(): Promise<void> {
    const num = (v: string) => Number(v.replace(',', '.'));
    if (this.name().trim()) await this.settings.set('profileName', this.name().trim().slice(0, 80));
    const h = num(this.height());
    if (h >= 50 && h <= 260) await this.settings.set('profileHeightCm', Math.round(h));
    if (/^\d{4}-\d{2}-\d{2}$/.test(this.birth())) await this.settings.set('profileBirthDate', this.birth());
    if (this.sex()) await this.settings.set('profileSex', this.sex());
    const r = Math.round(num(this.rest()));
    if (Number.isFinite(r) && r >= 0 && r <= 1800 && this.rest() !== '') await this.settings.set('defaultRestSeconds', r);
    const w = num(this.weight());
    if (this.weight() && Number.isFinite(w)) {
      try {
        await this.body.add({ date: toLocalDate(this.clock.now()), type: 'WEIGHT_KG', value: w });
      } catch {
        /* valor fora dos limites: ignora, edita-se no Perfil */
      }
    }
  }
}
