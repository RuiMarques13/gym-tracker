import { HEALTH_PROVIDER } from './core/health/health-provider';
import { CapacitorHealthProvider } from './core/health/capacitor-health.provider';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { Capacitor } from '@capacitor/core';
import { provideRouter, RouteReuseStrategy, withComponentInputBinding } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { AuthService } from './core/cloud/auth.service';
import { SyncService } from './core/sync/sync.service';
import { UpdateService } from './core/pwa/update.service';
import { DatabaseService } from './core/db/database.service';
import { SettingsService } from './core/settings/settings.service';
import { ThemeService } from './core/theme/theme.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideIonicAngular({ mode: 'md', innerHTMLTemplatesEnabled: true }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes, withComponentInputBinding()),
    // PWA: só na web em produção. No APK (Capacitor) os ficheiros já vão dentro da app.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !Capacitor.isNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    { provide: HEALTH_PROVIDER, useFactory: () => new CapacitorHealthProvider() },
    // Base pronta antes do primeiro ecrã: migrações, device_id, seed, definições.
    provideAppInitializer(async () => {
      const db = inject(DatabaseService);
      const settings = inject(SettingsService);
      const theme = inject(ThemeService);
      const auth = inject(AuthService);
      const sync = inject(SyncService);
      const update = inject(UpdateService); // inject() só funciona antes do primeiro await
      theme.start();
      await db.init();
      await settings.init();
      update.start();
      void auth.init(); // lê a sessão guardada sem atrasar o primeiro ecrã
      void sync.start();
    }),
  ],
};
