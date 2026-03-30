import { Component, signal, computed, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Timey, TimeyEvent } from './timey';

type Theme = 'light' | 'dark';

@Component({
  selector: 'box-root',
  imports: [RouterOutlet, Timey],
  template: `
    <div class="box-container">
      <header>
        <h1>Hello, {{ title() }}</h1>
        <button (click)="toggleTheme()" [attr.aria-label]="'Switch to ' + (theme() === 'dark' ? 'light' : 'dark') + ' mode'">
          {{ theme() === 'dark' ? '☀️' : '🌙' }}
        </button>
      </header>

      <section class="timey-demo">
        <div class="timey-wrapper">
          <box-timey
            max="30:00"
            [(command)]="timeyCommand"
            (tick)="onTimeyTick($event)"
          />
        </div>
        <div class="timey-controls">
          <button class="btn-primary" (click)="timeyCommand.set('start')">Start</button>
          <button class="btn-primary" (click)="timeyCommand.set('start:20:00')">Start 20:00</button>
          <button class="btn-primary" (click)="timeyCommand.set('start:3')">Start 3</button>
          <button (click)="timeyCommand.set('pause')">Pause</button>
          <button (click)="timeyCommand.set('resume')">Resume</button>
          <button (click)="timeyCommand.set('stop')">Stop</button>
        </div>
        <p class="text-muted">State: {{ timeyState() }}</p>
      </section>

      <router-outlet />
    </div>
  `,
  styles: [`
    .box-container {
      max-width: 48rem;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    h1 {
      color: var(--text);
    }

    button {
      font-size: 1.25rem;
      padding: 0.5rem 0.75rem;
    }

    button:hover {
      background: var(--primary);
      color: var(--primary-text);
      border-color: var(--primary);
    }

    .timey-demo {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      margin-top: 2rem;
    }

    .timey-wrapper {
      width: 200px;
      height: 200px;
    }

    .timey-controls {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .timey-controls button {
      font-size: 0.9rem;
    }

    .text-muted {
      color: var(--text-muted);
      font-size: 0.85rem;
    }
  `],
})
export class App {
  protected readonly title = signal('box');
  readonly timeyCommand = signal('');
  readonly timeyState = signal('idle');

  private readonly platformId = inject(PLATFORM_ID);
  readonly theme = signal<Theme>(this.detectSystemTheme());

  constructor() {
    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        document.documentElement.setAttribute('data-theme', this.theme());
      }
    });

    if (isPlatformBrowser(this.platformId)) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        this.theme.set(e.matches ? 'dark' : 'light');
      });

      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }

  toggleTheme() {
    this.theme.update(t => t === 'dark' ? 'light' : 'dark');
  }

  private detectSystemTheme(): Theme {
    if (isPlatformBrowser(this.platformId)) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  onTimeyTick(event: TimeyEvent) {
    this.timeyState.set(event.state);

    if (event.state === 'finished') {
      this.notifyFinished(event.max);
    }
  }

  private notifyFinished(maxSeconds: number) {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const minutes = Math.floor(maxSeconds / 60);
    const body = `${minutes} min box has finished \u{1F308}`;

    const notification = new Notification('Box Timer', {
      body,
      icon: 'icons/icon-192x192.png',
      badge: 'icons/icon-96x96.png',
      tag: 'timey-finished',
    } as NotificationOptions);

    notification.addEventListener('click', () => {
      window.focus();
      notification.close();
    });
  }
}
