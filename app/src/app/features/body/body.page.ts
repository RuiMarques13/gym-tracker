import { Component, computed, inject, resource, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ViewWillEnter } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cameraOutline, chevronForward } from 'ionicons/icons';
import { POSE_LABEL } from '../../data/models/photo';
import { PHOTO_REPOSITORY } from '../../services/repositories';
import { SettingsService } from '../../services/settings/settings.service';
import { AvatarButtonComponent } from '../../shared/avatar-button.component';
import { SectionTabsComponent } from '../../shared/section-tabs.component';
import { BodyMeasurementsComponent } from './body-measurements.component';

/** Quantas fotos recentes aparecem no cartão. */
const PREVIEW = 3;

/** Progresso → Corpo: peso e medidas, e o acesso às fotos de progresso. */
@Component({
  selector: 'app-body',
  imports: [RouterLink, AvatarButtonComponent, SectionTabsComponent, BodyMeasurementsComponent, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon],
  template: `
    <ion-header>
      <ion-toolbar><ion-title>Progresso</ion-title><app-avatar-button slot="end" /></ion-toolbar>
      <app-section-tabs />
    </ion-header>
    <ion-content>
      <div class="page">
        <app-body-measurements />

        <a class="photos card" routerLink="/corpo/fotos">
          <span class="head">
            <ion-icon name="camera-outline" aria-hidden="true" />
            <span class="txt">
              <strong>Fotos de progresso</strong>
              <small>{{ summary() }}</small>
            </span>
            <ion-icon name="chevron-forward" class="go" aria-hidden="true" />
          </span>
          @if (recent().length) {
            <span class="thumbs">
              @for (p of recent(); track p.id) {
                <img [src]="p.image" [alt]="pose[p.pose] + ', ' + day(p.date)" loading="lazy" />
              }
            </span>
          }
        </a>
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; padding-bottom: 24px; }
    .card {
      display: block; margin: 8px 16px 0; padding: 14px 16px; border-radius: 14px; text-decoration: none; color: inherit;
      background: var(--ion-card-background, var(--ion-item-background, #fff));
      border: 2px solid var(--gt-line, rgba(128, 128, 128, 0.2));
    }
    .head { display: flex; align-items: center; gap: 12px; min-height: 44px; }
    .head > ion-icon { font-size: 24px; color: var(--ion-color-primary); }
    .head .go { margin-left: auto; font-size: 20px; color: var(--ion-color-medium); }
    .txt { display: flex; flex-direction: column; }
    .txt small { color: var(--ion-color-medium); }
    .thumbs { display: grid; grid-template-columns: repeat(${PREVIEW}, 1fr); gap: 8px; margin-top: 12px; }
    .thumbs img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 8px; display: block; }
  `,
})
export class BodyPage implements ViewWillEnter {
  private readonly photosRepo = inject(PHOTO_REPOSITORY);
  private readonly settings = inject(SettingsService);
  private readonly measurements = viewChild(BodyMeasurementsComponent);

  readonly pose = POSE_LABEL;
  readonly photos = resource({ loader: () => this.photosRepo.list() });
  readonly recent = computed(() => (this.photos.value() ?? []).slice(0, PREVIEW));
  private readonly photosSync = this.settings.get('syncPhotos');
  readonly summary = computed(() => {
    const list = this.photos.value() ?? [];
    const where = this.photosSync() ? 'sincronizam com a conta' : 'só neste dispositivo';
    if (!list.length) return `Ainda sem fotos · ${where}`;
    return `${list.length} ${list.length === 1 ? 'foto' : 'fotos'} · última a ${this.day(list[0].date)} · ${where}`;
  });

  constructor() {
    addIcons({ cameraOutline, chevronForward });
  }

  ionViewWillEnter(): void {
    this.photos.reload();
    this.measurements()?.reload();
  }

  day = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).replace('.', '');
}
