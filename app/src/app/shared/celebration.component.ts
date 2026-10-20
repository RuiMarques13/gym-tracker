import { Component, input } from '@angular/core';

/**
 * Festa curta por cima do ecrã (recorde): confetes a cair e um cartão. Não bloqueia toques.
 * Sem confetes quando o telemóvel pede menos movimento; o texto é anunciado aos leitores de ecrã.
 */
@Component({
  selector: 'app-celebration',
  template: `
    @if (title()) {
      <div class="wrap" role="status" aria-live="polite">
        <div class="confetti" aria-hidden="true">
          @for (c of pieces; track $index) {
            <i [style.left.%]="c.x" [style.background]="c.color" [style.animation-delay.ms]="c.delay"></i>
          }
        </div>
        <div class="card">
          <span class="medal" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5.5" /><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5" /></svg>
          </span>
          <span class="text"><strong>{{ title() }}</strong>@if (detail()) {<small>{{ detail() }}</small>}</span>
        </div>
      </div>
    }
  `,
  styles: `
    :host { position: fixed; inset: 0; pointer-events: none; z-index: 30000; }
    .wrap { position: absolute; inset: 0; }
    .confetti i { position: absolute; top: -20px; width: 10px; height: 14px; border-radius: 3px; animation: fall 1.6s ease-in both; }
    @keyframes fall { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(70vh) rotate(340deg); opacity: 0; } }
    .card { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px;
      width: min(88vw, 380px); box-sizing: border-box; padding: 14px 16px; border-radius: 18px;
      background: var(--gt-flame-tint); color: var(--ion-text-color); border: 2px solid var(--gt-flame);
      box-shadow: 0 6px 0 var(--gt-flame-press); animation: pop 380ms cubic-bezier(.2,.9,.3,1.3) both; }
    @keyframes pop { 0% { transform: translateX(-50%) scale(.6); opacity: 0; } 100% { transform: translateX(-50%) scale(1); opacity: 1; } }
    .medal { flex: 0 0 auto; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center;
      background: var(--gt-flame); color: #17201c; box-shadow: 0 4px 0 var(--gt-flame-press); }
    .text { display: grid; gap: 2px; min-width: 0; }
    .text strong { font-size: 1.15rem; font-weight: 900; }
    .text small { font-size: 0.95rem; font-weight: 700; }
    @media (prefers-reduced-motion: reduce) { .confetti { display: none; } .card { animation: none; } }
  `,
})
export class CelebrationComponent {
  readonly title = input<string | null>(null);
  readonly detail = input<string | null>(null);
  readonly pieces = Array.from({ length: 18 }, (_, i) => ({
    x: (i * 53) % 100, delay: (i * 70) % 500, color: ['#2fcb86', '#ff8a00', '#4f8df5'][i % 3],
  }));
}
