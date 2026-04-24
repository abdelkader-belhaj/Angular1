import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

const globalObject = globalThis as typeof globalThis & {
  global?: typeof globalThis;
};

if (typeof globalObject.global === 'undefined') {
  globalObject.global = globalObject;
}

platformBrowserDynamic()
  .bootstrapModule(AppModule, {
    ngZoneEventCoalescing: true,
  })
  .catch((err) => console.error(err));
