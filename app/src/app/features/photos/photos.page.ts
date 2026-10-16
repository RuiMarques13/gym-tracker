import { Component, computed, inject, resource, signal } from '@angular/core';
import {
  AlertController, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSegment, IonSegmentButton, IonLabel, IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cameraOutline, closeOutline, gitCompareOutline, trashOutline } from 'ionicons/icons';
import { compressImage } from '../../services/util/image-compress';
import { CLOCK } from '../../services/clock';
import { toLocalDate } from '../../core/util/week';
import { PhotoError, PhotoPose, POSE_LABEL, ProgressPhoto } from '../../data/models/photo';
import { PHOTO_REPOSITORY } from '../../services/repositories';
import { RouterLink } from '@angular/router';
import { SettingsService } from '../../services/settings/settings.service';
import { NavButtonComponent } from '../../shared/nav-button.component';

const POSES: PhotoPose[] = ['FRONT', 'SIDE', 'BACK', 'OTHER'];

/** Fotos de progresso: guardar, ver por data e comparar duas lado a lado. */
import { ToastService } from '../../services/ui/toast.service';

@Component({
  selector: 'app-photos',
  imports: [NavButtonComponent, RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonSegment, IonSegmentButton, IonLabel],
  template: `
    <ion-header>
      <ion-toolbar>
        <app-nav-button slot="start" />
        <ion-title>Fotos</ion-title>
        <ion-buttons slot="end">
          @if (photos.value()?.length! > 1) {
            <ion-button (click)="toggleCompare()" [color]="comparing() ? 'primary' : undefined" aria-label="Comparar">
              <ion-icon slot="icon-only" name="git-compare-outline" />
            </ion-button>
          }
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="page">
        <div class="add card">
          <h2>Nova foto</h2>
          <ion-segment [value]="pose()" (ionChange)="pose.set($any($event).detail.value)">
            @for (p of poses; track p) { <ion-segment-button [value]="p"><ion-label>{{ label[p] }}</ion-label></ion-segment-button> }
          </ion-segment>
          <div class="row">
            <label class="date">Dia
              <input type="date" [value]="date()" (change)="date.set($any($event.target).value)" />
            </label>
            <ion-button (click)="file.click()" [disabled]="busy()">
              <ion-icon slot="start" name="camera-outline" /> {{ busy() ? 'A guardar…' : 'Tirar ou escolher foto' }}
            </ion-button>
            <input #file type="file" accept="image/*" hidden (change)="onFile($any($event.target))" />
          </div>
          <p class="hint">
            Reduzidas para ≈ 80 KB cada.
            {{ photosSync() ? 'Sincronizam com a tua conta.' : 'Ficam só neste dispositivo.' }}
            <a routerLink="/conta">Mudar</a>
          </p>
        </div>

        @if (comparing()) {
          <div class="card cmp">
            <h2>Comparar</h2>
            <p class="hint">Toca em duas fotos da lista para as veres lado a lado.</p>
            @if (pair().length === 2) {
              <div class="pair">
                @for (p of pair(); track p.id) {
                  <figure><img [src]="p.image" [alt]="label[p.pose] + ', ' + dayLabel(p.date)" /><figcaption>{{ dayLabel(p.date) }} · {{ label[p.pose] }}</figcaption></figure>
                }
              </div>
              <p class="hint">{{ daysBetween() }} dias entre as duas.</p>
            }
          </div>
        }

        @if (photos.isLoading()) {
          <p class="hint">A carregar…</p>
        } @else if (!photos.value()?.length) {
          <p class="hint">Ainda sem fotos. Tira a primeira para teres um ponto de partida.</p>
        } @else {
          <div class="grid">
            @for (p of photos.value()!; track p.id) {
              <button type="button" class="thumb" [class.sel]="selected().includes(p.id)" (click)="tap(p)">
                <img [src]="p.image" [alt]="label[p.pose] + ', ' + dayLabel(p.date)" loading="lazy" />
                <span>{{ dayLabel(p.date) }} · {{ label[p.pose] }}</span>
              </button>
            }
          </div>
        }

        @if (open(); as o) {
          <div class="viewer" role="dialog" aria-label="Foto">
            <div class="bar">
              <span>{{ dayLabel(o.date) }} · {{ label[o.pose] }}</span>
              <span>
                <ion-button fill="clear" color="light" (click)="remove(o)" aria-label="Apagar foto"><ion-icon slot="icon-only" name="trash-outline" /></ion-button>
                <ion-button fill="clear" color="light" (click)="open.set(null)" aria-label="Fechar"><ion-icon slot="icon-only" name="close-outline" /></ion-button>
              </span>
            </div>
            <img [src]="o.image" [alt]="label[o.pose] + ', ' + dayLabel(o.date)" />
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { max-width: 760px; margin: 0 auto; }
    .card { background: var(--ion-card-background, var(--ion-item-background, #fff)); border-radius: 14px; padding: 14px 16px; margin-bottom: 14px; }
    h2 { font-size: 1rem; margin: 0 0 10px; }
    .row { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-top: 10px; }
    .date { display: flex; flex-direction: column; font-size: 0.8rem; color: var(--ion-color-medium); }
    .date input { font: inherit; color: var(--ion-text-color); background: transparent; border: 1px solid var(--ion-border-color, rgba(128,128,128,0.4)); border-radius: 8px; padding: 6px 8px; }
    .hint { color: var(--ion-color-medium); font-size: 0.82rem; margin: 8px 0 0; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .thumb { padding: 0; border: 2px solid transparent; border-radius: 10px; background: none; text-align: left; cursor: pointer; color: inherit; overflow: hidden; }
    .thumb.sel { border-color: var(--ion-color-primary); }
    .thumb img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; display: block; border-radius: 8px; }
    .thumb span { display: block; font-size: 0.72rem; padding: 4px 2px; color: var(--ion-color-medium); }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .pair figure { margin: 0; }
    .pair img { width: 100%; border-radius: 8px; display: block; }
    .pair figcaption { font-size: 0.78rem; color: var(--ion-color-medium); padding-top: 4px; }
    .viewer { position: fixed; inset: 0; z-index: 1000; background: #000; display: flex; flex-direction: column; }
    .viewer .bar { display: flex; justify-content: space-between; align-items: center; color: #fff; padding: 8px 12px; padding-top: calc(8px + env(safe-area-inset-top)); }
    .viewer img { flex: 1; min-height: 0; object-fit: contain; width: 100%; }
  `,
})
export class PhotosPage {
  private readonly repo = inject(PHOTO_REPOSITORY);
  private readonly clock = inject(CLOCK);
  private readonly toasts = inject(ToastService);
  private readonly alerts = inject(AlertController);
  /** As fotos só saem do dispositivo com «Sincronizar fotos» ligado (Conta). */
  readonly photosSync = inject(SettingsService).get('syncPhotos');

  readonly poses = POSES;
  readonly label = POSE_LABEL;
  readonly photos = resource({ loader: () => this.repo.list() });
  readonly pose = signal<PhotoPose>('FRONT');
  readonly date = signal(toLocalDate(this.clock.now()));
  readonly busy = signal(false);
  readonly comparing = signal(false);
  readonly selected = signal<string[]>([]);
  readonly open = signal<ProgressPhoto | null>(null);

  readonly pair = computed(() => {
    const list = this.photos.value() ?? [];
    return this.selected().map((id) => list.find((p) => p.id === id)).filter((p): p is ProgressPhoto => !!p).sort((a, b) => a.date.localeCompare(b.date));
  });
  readonly daysBetween = computed(() => {
    const [a, b] = this.pair();
    return a && b ? Math.round((Date.parse(b.date) - Date.parse(a.date)) / 86_400_000) : 0;
  });

  constructor() {
    addIcons({ cameraOutline, closeOutline, gitCompareOutline, trashOutline });
  }

  dayLabel = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');

  async onFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy.set(true);
    try {
      const image = await compressImage(file);
      await this.repo.add({ date: this.date(), pose: this.pose(), image });
      this.photos.reload();
      await this.toast('Foto guardada.');
    } catch (e) {
      await this.toast(e instanceof PhotoError ? e.message : 'Não consegui processar esta imagem.');
    } finally {
      this.busy.set(false);
    }
  }

  toggleCompare(): void {
    this.comparing.update((c) => !c);
    this.selected.set([]);
  }

  tap(p: ProgressPhoto): void {
    if (!this.comparing()) return void this.open.set(p);
    this.selected.update((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s.slice(-1), p.id]));
  }

  async remove(p: ProgressPhoto): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Apagar esta foto?', message: 'Também desaparece dos teus outros dispositivos.',
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Apagar', role: 'destructive', handler: () => void this.doRemove(p) }],
    });
    await alert.present();
  }

  private async doRemove(p: ProgressPhoto): Promise<void> {
    await this.repo.remove(p.id);
    this.open.set(null);
    this.selected.update((s) => s.filter((x) => x !== p.id));
    this.photos.reload();
  }

  private async toast(message: string): Promise<void> {
    await this.toasts.show(message, 'info');
  }
}
