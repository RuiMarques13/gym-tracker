import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, RouteReuseStrategy, withComponentInputBinding } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
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
    // Base pronta antes do primeiro ecrã: migrações, device_id, seed, definições.
    provideAppInitializer(async () => {
      const db = inject(DatabaseService);
      const settings = inject(SettingsService);
      const theme = inject(ThemeService);
      theme.start();
      await db.init();
      await settings.init();
    }),
  ],
};
