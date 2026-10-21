import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonTitle, IonToolbar, ModalController } from '@ionic/angular';
import {
  GROUP_DEFAULTS, GROUP_HINT, GROUP_KINDS, GROUP_LABEL, groupLabel, normalizeConfig, type GroupConfig, type GroupKind,
} from '../../core/session/group-format';

type Field = 'rounds' | 'roundRestSeconds' | 'workSeconds' | 'restSeconds' | 'durationSeconds';

const FIELDS: Record<GroupKind, { key: Field; label: string; unit: string; step: number }[]> = {
  SUPERSET: [],
  CIRCUIT: [{ key: 'rounds', label: 'Voltas', unit: '', step: 1 }, { key: 'roundRestSeconds', label: 'Descanso entre voltas', unit: 's', step: 15 }],
  TABATA: [{ key: 'workSeconds', label: 'Trabalho', unit: 's', step: 5 }, { key: 'restSeconds', label: 'Descanso', unit: 's', step: 5 }, { key: 'rounds', label: 'Rondas', unit: '', step: 1 }],
  EMOM: [{ key: 'rounds', label: 'Minutos', unit: 'min', step: 1 }],
  AMRAP: [{ key: 'durationSeconds', label: 'Duração', unit: 'min', step: 60 }],
  INTERVALS: [{ key: 'workSeconds', label: 'Trabalho', unit: 's', step: 5 }, { key: 'restSeconds', label: 'Descanso', unit: 's', step: 5 }, { key: 'rounds', label: 'Rondas', unit: '', step: 1 }],
};

/** Escolher o formato de um grupo (superset, circuito, Tabata, EMOM, AMRAP, intervalos) e os tempos. Devolve a configuração. */
@Component({
  selector: 'app-group-format-sheet',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonFooter],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Formato do grupo {{ groupKey }}</ion-title>
        <ion-buttons slot="end"><ion-button (click)="cancel()">Cancelar</ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="wrap">
        <div class="kinds" role="radiogroup" aria-label="Formato">
          @for (k of kinds; track k) {
            <button type="button" role="radio" class="kind" [class.on]="cfg().kind === k" [attr.aria-checked]="cfg().kind === k" (click)="pick(k)">
              <strong>{{ label[k] }}</strong><small>{{ hint[k] }}</small>
            </button>
          }
        </div>
        @for (f of fields(); track f.key) {
          <div class="field">
            <span class="flabel">{{ f.label }}</span>
            <button type="button" class="step" [attr.aria-label]="'Menos ' + f.label" (click)="bump(f.key, -f.step)">−</button>
            <span class="val" aria-live="polite">{{ show(f.key, f.unit) }}</span>
            <button type="button" class="step" [attr.aria-label]="'Mais ' + f.label" (click)="bump(f.key, f.step)">+</button>
          </div>
        }
        <p class="summary">{{ summary() }}</p>
      </div>
    </ion-content>
    <ion-footer>
      <div class="foot"><ion-button expand="block" (click)="done()">Guardar formato</ion-button></div>
    </ion-footer>
  `,
  styles: `
    .wrap { padding: 12px 16px 24px; max-width: 520px; margin: 0 auto; display: grid; gap: 14px; }
    .kinds { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .kind { min-height: 84px; display: grid; align-content: start; gap: 4px; padding: 10px 12px; text-align: left; font: inherit;
      border: 2px solid var(--gt-line); border-radius: 16px; background: transparent; color: inherit; box-shadow: 0 4px 0 var(--gt-line);
      transition: transform 80ms ease, box-shadow 80ms ease; }
    .kind:active { transform: translateY(4px); box-shadow: none; }
    .kind.on { border-color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), .1);
      box-shadow: 0 4px 0 color-mix(in srgb, var(--ion-color-primary) 62%, #000); }
    .kind strong { font-size: 1.05rem; font-weight: 900; }
    .kind small { font-size: .8rem; color: var(--ion-color-medium); line-height: 1.25; }
    .field { display: grid; grid-template-columns: 1fr 52px 96px 52px; align-items: center; gap: 8px; }
    .flabel { font-weight: 800; }
    .step { height: 48px; border-radius: 14px; border: 2px solid var(--gt-line); background: var(--gt-surface); color: inherit;
      font: inherit; font-size: 1.4rem; font-weight: 900; box-shadow: 0 4px 0 var(--gt-line); }
    .step:active { transform: translateY(4px); box-shadow: none; }
    .val { text-align: center; font-size: 1.3rem; font-weight: 900; font-variant-numeric: tabular-nums; }
    .summary { margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--gt-surface); font-weight: 800; text-align: center; }
    .foot { max-width: 520px; margin: 0 auto; padding: 8px 16px 10px; }
  `,
})
export class GroupFormatSheetComponent implements OnInit {
  private readonly modal = inject(ModalController);
  /** Passados por componentProps (ModalController). */
  groupKey = '';
  initial: GroupConfig | null = null;
  readonly kinds = GROUP_KINDS;
  readonly label = GROUP_LABEL;
  readonly hint = GROUP_HINT;
  readonly cfg = signal<GroupConfig>(GROUP_DEFAULTS.SUPERSET);
  readonly fields = computed(() => FIELDS[this.cfg().kind]);
  readonly summary = computed(() => groupLabel(this.cfg()));

  ngOnInit(): void {
    this.cfg.set(normalizeConfig(this.initial ?? GROUP_DEFAULTS.SUPERSET));
  }

  pick(k: GroupKind): void {
    this.cfg.set(k === this.cfg().kind ? this.cfg() : GROUP_DEFAULTS[k]);
  }

  bump(key: Field, delta: number): void {
    const c = this.cfg();
    this.cfg.set(normalizeConfig({ ...c, [key]: (c[key] ?? 0) + delta }));
  }

  show(key: Field, unit: string): string {
    const v = this.cfg()[key] ?? 0;
    if (unit === 'min') return `${key === 'durationSeconds' ? v / 60 : v} min`;
    return unit ? `${v} ${unit}` : String(v);
  }

  cancel(): void {
    void this.modal.dismiss(null, 'cancel');
  }

  done(): void {
    void this.modal.dismiss(this.cfg(), 'confirm');
  }
}
