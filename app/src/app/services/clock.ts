import { InjectionToken } from '@angular/core';
import { SystemClock, type Clock } from '../core/util/clock';

/** Relógio da app (injetável). A lógica pura em core/ recebe datas; os services leem-nas daqui. */
export const CLOCK = new InjectionToken<Clock>('CLOCK', {
  providedIn: 'root',
  factory: () => new SystemClock(),
});
