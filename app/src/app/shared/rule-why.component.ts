import { Component, computed, input } from '@angular/core';
import { RULE, type Rule } from '../core/progression/rules';

/** Uma regra de progressão: o que a app faz, a marca (fonte ou escolha da app) e as ligações às fontes. */
@Component({
  selector: 'app-rule-why',
  template: `
    @if (rule(); as r) {
      <div class="rule">
        <div class="head">
          @if (showTitle()) { <strong>{{ r.title }}</strong> }
          <span class="mark" [class.app]="r.mark === 'app'">{{ r.mark === 'app' ? 'Escolha da app' : 'Fonte' }}</span>
        </div>
        <p class="value">{{ r.value }}</p>
        @if (r.refs.length) {
          <p class="refs">
            @for (ref of r.refs; track ref.url; let last = $last) {
              <a [href]="ref.url" target="_blank" rel="noopener">{{ ref.label }}</a>@if (ref.note) { <span class="note"> ({{ ref.note }})</span> }@if (!last) {<span>; </span>}
            }
          </p>
        }
        @if (r.mark === 'app' && r.setting) { <p class="note">Podes mudar este valor nas Definições.</p> }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .head strong { font-size: 14px; }
    .mark { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px; background: rgba(var(--ion-color-primary-rgb), .15); color: var(--ion-color-primary); }
    .mark.app { background: rgba(128,128,128,.15); color: var(--ion-color-medium); }
    p { margin: 4px 0 0; font-size: 13px; line-height: 1.45; }
    .refs a { color: var(--ion-color-primary); }
    .note { color: var(--ion-color-medium); font-size: 12px; }
  `,
})
export class RuleWhyComponent {
  /** Chave da regra (rules.ts) ou a própria regra. */
  readonly key = input<string | null>(null);
  readonly value = input<Rule | null>(null);
  readonly showTitle = input(true);
  readonly rule = computed(() => this.value() ?? (this.key() ? RULE[this.key()!] ?? null : null));
}
