import { Component, input } from '@angular/core';
import { IonNote } from '@ionic/angular';
import type { VolumeRow } from '../core/metrics/volume.service';

/** Barras de séries por músculo contra a faixa (mínimo–máximo) e o alvo. */
@Component({
  selector: 'app-muscle-bars',
  imports: [IonNote],
  template: `
    @for (r of rows(); track r.muscle) {
      <div class="row">
        <div class="head">
          <strong>{{ r.label }}</strong>
          <span class="num">{{ r.sets }} séries · {{ r.frequency }} {{ r.frequency === 1 ? 'sessão' : 'sessões' }}</span>
        </div>
        <div class="bar" role="img" [attr.aria-label]="r.label + ': ' + r.sets + ' séries, ' + r.statusText + ' (faixa ' + r.range.min + ' a ' + r.range.max + ')'">
          <div class="zone" [style.left.%]="r.minPos" [style.width.%]="r.maxPos - r.minPos"></div>
          <div class="fill" [class.below]="r.status === 'below'" [class.above]="r.status === 'above'" [style.width.%]="r.fill"></div>
          <div class="tick" [style.left.%]="r.targetPos"></div>
        </div>
        <div class="foot">
          <span class="chipst" [class.below]="r.status === 'below'" [class.above]="r.status === 'above'">{{ r.statusText }}</span>
          <ion-note>faixa {{ r.range.min }}–{{ r.range.max }} · alvo {{ r.range.target }}</ion-note>
        </div>
      </div>
    }
  `,
  styles: `
    .row { padding: 10px 0; border-bottom: 1px solid var(--ion-border-color, rgba(128,128,128,0.2)); }
    .row:last-child { border-bottom: 0; }
    .head, .foot { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .num { font-variant-numeric: tabular-nums; color: var(--ion-color-medium); font-size: 0.88rem; }
    .bar { position: relative; height: 10px; border-radius: 5px; background: rgba(128,128,128,0.18); margin: 8px 0 6px; overflow: hidden; }
    .zone { position: absolute; top: 0; bottom: 0; background: rgba(15,118,110,0.22); }
    .fill { position: absolute; left: 0; top: 2px; bottom: 2px; border-radius: 3px; background: #0f766e; }
    .fill.below { background: #b45309; }
    .fill.above { background: #b91c1c; }
    .tick { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--ion-text-color, #000); opacity: 0.55; }
    .chipst { font-size: 0.78rem; font-weight: 600; color: #0f766e; }
    .chipst.below { color: #b45309; }
    .chipst.above { color: #b91c1c; }
    @media (prefers-color-scheme: dark) {
      .fill { background: #2cb5a8; } .fill.below { background: #f59e0b; } .fill.above { background: #f87171; }
      .chipst { color: #2cb5a8; } .chipst.below { color: #f59e0b; } .chipst.above { color: #f87171; }
      .zone { background: rgba(44,181,168,0.25); }
    }
  `,
})
export class MuscleBarsComponent {
  readonly rows = input.required<VolumeRow[]>();
}
