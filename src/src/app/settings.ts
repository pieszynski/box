import { Component, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

@Component({
  selector: 'box-settings',
  template: `
    <div class="settings-host">
      <button
        class="icon-btn"
        (click)="toggle()"
        [attr.aria-label]="'Settings'"
        [attr.aria-expanded]="open()"
      >⚙️</button>

      @if (open()) {
        <div class="settings-overlay" (click)="close()"></div>
        <div class="settings-panel" role="dialog" aria-label="Settings">
          <h2>Settings</h2>

          @if (notifSupported()) {
            <section class="settings-section">
              <h3>Notifications</h3>
              @switch (notifPermission()) {
                @case ('granted') {
                  <p class="status status--ok">✅ Notifications are enabled</p>
                }
                @case ('denied') {
                  <p class="status status--err">🚫 Notifications are blocked</p>
                  <p class="hint">To enable notifications, update your browser site permissions for this page.</p>
                }
                @case ('default') {
                  <p class="status">Notifications are not yet enabled.</p>
                  <button class="btn-primary" (click)="requestPermission()">Enable Notifications</button>
                }
              }
            </section>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .settings-host {
      position: relative;
    }

    .icon-btn {
      font-size: 1.25rem;
      padding: 0.5rem 0.75rem;
      background: transparent;
      border: 1px solid transparent;
      cursor: pointer;
      border-radius: 0.375rem;
      line-height: 1;
    }

    .icon-btn:hover {
      background: var(--primary);
      color: var(--primary-text);
      border-color: var(--primary);
    }

    .settings-overlay {
      position: fixed;
      inset: 0;
      z-index: 10;
    }

    .settings-panel {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      z-index: 20;
      min-width: 18rem;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 1rem 1.25rem;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    }

    h2 {
      margin: 0 0 0.75rem;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text);
    }

    .settings-section h3 {
      margin: 0 0 0.5rem;
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .status {
      margin: 0 0 0.5rem;
      font-size: 0.9rem;
      color: var(--text);
    }

    .status--ok { color: var(--success); }
    .status--err { color: var(--danger); }

    .hint {
      margin: 0 0 0.5rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .btn-primary {
      font-size: 0.875rem;
      padding: 0.4rem 0.875rem;
      background: var(--primary);
      color: var(--primary-text);
      border: 1px solid var(--primary);
      border-radius: 0.375rem;
      cursor: pointer;
    }

    .btn-primary:hover {
      background: var(--primary-hover);
      border-color: var(--primary-hover);
    }
  `],
})
export class Settings {
  private readonly platformId = inject(PLATFORM_ID);

  readonly open = signal(false);
  readonly notifSupported = signal(
    isPlatformBrowser(this.platformId) && 'Notification' in window
  );
  readonly notifPermission = signal<NotifPermission>(this.currentPermission());

  toggle() {
    this.open.update(v => !v);
  }

  close() {
    this.open.set(false);
  }

  async requestPermission() {
    const result = await Notification.requestPermission();
    console.log(`permission action: ${result}`);
    this.notifPermission.set(result);
  }

  private currentPermission(): NotifPermission {
    if (!isPlatformBrowser(this.platformId) || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission as NotifPermission;
  }
}
