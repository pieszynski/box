import { Component, signal, computed, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';

type Theme = 'light' | 'dark';

@Component({
  selector: 'box-root',
  imports: [RouterOutlet],
  template: `
    <div class="box-container">
      <header>
        <h1>Hello, {{ title() }}</h1>
        <button (click)="toggleTheme()" [attr.aria-label]="'Switch to ' + (theme() === 'dark' ? 'light' : 'dark') + ' mode'">
          {{ theme() === 'dark' ? '☀️' : '🌙' }}
        </button>
      </header>
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
      background: var(--bg-surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 0.5rem 0.75rem;
      font-size: 1.25rem;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    button:hover {
      background: var(--accent);
      color: #fff;
    }
  `],
})
export class App {
  protected readonly title = signal('box');

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
}
