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
import { UpdateService } from './core/pwa/update.service';
import { DatabaseService } from './core/db/database.service';
import { SettingsService } from './core/settings/settings.service';
import { ThemeService } from './core/theme/theme.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideIonicAngular({ mode: 'md' }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes, withComponentInputBinding()),
    // PWA: só na web em produção. No APK (Capacitor) os ficheiros já vão dentro da app.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !Capacitor.isNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // Base pronta antes do primeiro ecrã: migrações, device_id, seed, definições.
    provideAppInitializer(async () => {
      const db = inject(DatabaseService);
      const settings = inject(SettingsService);
      const theme = inject(ThemeService);
      const update = inject(UpdateService); // inject() só funciona antes do primeiro await
      theme.start();
      await db.init();
      await settings.init();
      update.start();
    }),
  ],
};
