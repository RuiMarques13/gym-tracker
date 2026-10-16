import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar, ViewWillEnter } from '@ionic/angular';
import { VolumeService } from '../../services/metrics/volume.service';
import { MuscleBarsComponent } from '../../shared/muscle-bars.component';
import { RecoveryCardComponent } from '../../shared/recovery-card.component';
import { SettingsService } from '../../services/settings/settings.service';
import { NavButtonComponent } from '../../shared/nav-button.component';

const GOAL_LABEL = { hypertrophy: 'Ganhar massa', strength: 'Força', power: 'Potência', endurance: 'Resistência muscular', maintenance: 'Manutenção', cut: 'Definição' } as const;
const LEVEL_LABEL = { beginner: 'Iniciante', intermediate: 'Intermédio', advanced: 'Avançado' } as const;
/** Volume semanal por músculo (últimos 7 dias): séries efetivas fracionais vs faixa recomendada. */
@Component({
  selector: 'app-volume',
  imports: [RouterLink, NavButtonComponent, MuscleBarsComponent, RecoveryCardComponent, IonHeader, IonToolbar, IonTitle, IonContent],
  template: `
    <ion-header>
      <ion-toolbar><app-nav-button slot="start" /><ion-title>Volume semanal</ion-title></ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="page">
        <p class="sub">
          Últimos 7 dias · {{ goalLabel() }} · {{ levelLabel() }}.
          <a routerLink="/perfil">Alterar no perfil</a>
        </p>

        @if (tips().length) {
          <section class="card" aria-label="Recomendações">
            <h2>Recomendações</h2>
            <ul>
              @for (t of tips(); track t.muscle) { <li>{{ t.message }}</li> }
            </ul>
          </section>
        }

        @if (missing() > 0) {
          <p class="warn">{{ missing() }} exercício(s) sem músculo principal não contam para o volume. Edita-os em Exercícios.</p>
        }

        @if (data.isLoading()) {
          <p class="sub">A calcular…</p>
        } @else {
          <section class="card" aria-label="Séries por músculo">
            <app-muscle-bars [rows]="rows()" />
          </section>
        }
        <section class="card" aria-label="Descanso recomendado">
          <h2>Descanso recomendado</h2>
          <app-recovery-card [refresh]="tick()" />
        </section>
        <p class="legal">Orientação geral de treino, não aconselhamento médico. Séries efetivas: de trabalho, 5–30 repetições, RIR ≤ 3 (ou sem RIR). Músculos secundários contam 0,5.</p>
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 720px; margin: 0 auto; }
    .sub { color: var(--ion-color-medium); margin: 0 0 12px; }
    .card { background: var(--ion-card-background, var(--ion-item-background, #fff)); border-radius: 14px; padding: 14px 16px; margin-bottom: 14px; }
    .card h2 { font-size: 1rem; margin: 0 0 8px; }
    .card ul { margin: 0; padding-left: 18px; }
    .card li { margin: 4px 0; }
    .warn { color: var(--ion-color-warning-shade, #92400e); font-size: 0.9rem; }
    .legal { color: var(--ion-color-medium); font-size: 0.8rem; margin: 8px 0 24px; }
  `,
})
export class VolumePage implements ViewWillEnter {
  private readonly service = inject(VolumeService);
  private readonly settings = inject(SettingsService);

  private readonly goal = this.settings.get('profileGoal');
  private readonly level = this.settings.get('profileLevel');
  private readonly goalChangedAt = this.settings.get('profileGoalChangedAt');
  private readonly birth = this.settings.get('profileBirthDate');

  readonly goalLabel = computed(() => GOAL_LABEL[this.goal()]);
  readonly levelLabel = computed(() => LEVEL_LABEL[this.level()]);

  readonly data = resource({
    params: () => ({ g: this.goal(), l: this.level(), c: this.goalChangedAt(), b: this.birth() }),
    loader: () => this.service.load(),
  });
  readonly missing = computed(() => this.data.value()?.missing ?? 0);
  readonly rows = computed(() => this.data.value()?.rows ?? []);
  readonly tips = computed(() => this.data.value()?.tips ?? []);

  readonly tick = signal(0);

  ionViewWillEnter(): void {
    this.tick.update((n) => n + 1);
    this.data.reload();
  }
}
