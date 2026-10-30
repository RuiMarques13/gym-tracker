import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButtons } from '@ionic/angular';
import { AuthService } from '../services/cloud/auth.service';
import { SettingsService } from '../services/settings/settings.service';

/** Iniciais do nome (ou do email) para o avatar: «Rui Marques» → «RM». */
export function initialsOf(name: string, email: string | null): string {
  const src = name.trim() || email || 'GT';
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? 'G') + (parts.length > 1 ? parts[1][0] : '')).toUpperCase();
}

/**
 * Avatar no canto superior direito dos ecrãs principais: abre o Perfil (com Conta e Definições).
 * `<app-avatar-button slot="end" />`
 */
@Component({
  selector: 'app-avatar-button',
  imports: [IonButtons, RouterLink],
  template: `
    <ion-buttons>
      <a class="avatar" routerLink="/perfil" [attr.aria-label]="'Perfil e definições de ' + name()">{{ initials() }}</a>
    </ion-buttons>
  `,
  styles: `
    .avatar {
      display: grid; place-items: center; width: 44px; height: 44px; margin: 2px 8px 2px 4px; border-radius: 50%;
      background: var(--ion-color-primary); color: var(--ion-color-primary-contrast);
      font-weight: 800; font-size: 0.95rem; letter-spacing: 0.02em; text-decoration: none;
    }
    .avatar:focus-visible { outline: 2px solid var(--ion-color-primary); outline-offset: 2px; }
  `,
})
export class AvatarButtonComponent {
  private readonly auth = inject(AuthService);
  private readonly settings = inject(SettingsService);
  readonly name = computed(() => this.settings.get('profileName')().trim() || this.auth.email() || 'Gym Tracker');
  readonly initials = computed(() => initialsOf(this.settings.get('profileName')(), this.auth.email()));
}
