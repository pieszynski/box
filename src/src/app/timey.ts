import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  OnDestroy,
  OnInit,
  model,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type TimeyState = 'idle' | 'running' | 'paused' | 'finished';

export interface TimeyEvent {
  state: TimeyState;
  remaining: number;
  max: number;
  progress: number;
  display: string;
}

function parseTime(value: string): number {
  const parts = value.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Number(value) || 0;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const STORAGE_KEY = 'timey-state';

interface TimeySnapshot {
  state: TimeyState;
  remaining: number;
  max: string;
  savedAt: number; // Date.now()
}

@Component({
  selector: 'box-timey',
  template: `
    <svg [attr.viewBox]="'0 0 ' + svgSize + ' ' + svgSize" class="timey-ring">
      <!-- track -->
      <circle
        [attr.cx]="center"
        [attr.cy]="center"
        [attr.r]="radius"
        fill="none"
        stroke="var(--bg-elevated, #e4e4de)"
        [attr.stroke-width]="strokeWidth"
      />
      <!-- progress arc -->
      <circle
        class="timey-progress"
        [attr.cx]="center"
        [attr.cy]="center"
        [attr.r]="radius"
        fill="none"
        stroke="var(--primary, #3a6fd8)"
        [attr.stroke-width]="strokeWidth"
        stroke-linecap="round"
        [attr.stroke-dasharray]="circumference"
        [attr.stroke-dashoffset]="dashOffset()"
        [attr.transform]="'rotate(-90 ' + center + ' ' + center + ')'"
      />
      <!-- time display -->
      <text
        [attr.x]="center"
        [attr.y]="center"
        text-anchor="middle"
        dominant-baseline="central"
        class="timey-text"
      >
        {{ display() }}
      </text>
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }

      .timey-ring {
        width: 100%;
        height: 100%;
      }

      .timey-progress {
        transition: stroke-dashoffset 0.3s linear;
      }

      .timey-text {
        font-size: 1.6rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        fill: var(--text, #2d2d2a);
        font-family: system-ui, -apple-system, sans-serif;
      }
    `,
  ],
})
export class Timey implements OnInit, OnDestroy {
  /** Maximum time expressed as "MM:SS" or "HH:MM:SS". */
  readonly max = input<string>('60:00');

  /** Command signal: write 'start', 'start:45:00', 'pause', 'resume', 'stop' */
  readonly command = model<string>('');

  /** Single event stream for all state + progress changes. */
  readonly tick = output<TimeyEvent>();

  // ── SVG dimensions ──
  readonly svgSize = 200;
  readonly strokeWidth = 12;
  readonly center = this.svgSize / 2;
  readonly radius = (this.svgSize - this.strokeWidth) / 2;
  readonly circumference = 2 * Math.PI * this.radius;

  // ── Internal state ──
  private readonly maxSeconds = computed(() => parseTime(this.max()));
  readonly remaining = signal(0);
  readonly state = signal<TimeyState>('idle');

  readonly progress = computed(() => {
    const m = this.maxSeconds();
    return m > 0 ? this.remaining() / m : 0;
  });

  readonly display = computed(() => formatTime(this.remaining()));

  readonly dashOffset = computed(
    () => this.circumference * (1 - this.progress()),
  );

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly isBrowser: boolean;

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);

    // Sync remaining to max whenever max changes and timer is idle
    effect(() => {
      const m = this.maxSeconds();
      if (this.state() === 'idle') {
        this.remaining.set(m);
      }
    });

    // React to command changes
    effect(() => {
      const cmd = this.command();
      if (!cmd) return;
      this.handleCommand(cmd);
    });

    // Persist state on every change
    effect(() => {
      const snapshot: TimeySnapshot = {
        state: this.state(),
        remaining: this.remaining(),
        max: this.max(),
        savedAt: Date.now(),
      };
      this.saveSnapshot(snapshot);
    });
  }

  ngOnInit() {
    this.restoreFromSnapshot();
  }

  ngOnDestroy() {
    this.clearInterval();
  }

  // ── Persistence ──

  private saveSnapshot(snapshot: TimeySnapshot) {
    if (!this.isBrowser) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch { /* quota exceeded — ignore */ }
  }

  private restoreFromSnapshot() {
    if (!this.isBrowser) return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const snap: TimeySnapshot = JSON.parse(raw);

      if (snap.state === 'idle' || snap.state === 'finished') return;

      if (snap.state === 'paused') {
        this.remaining.set(Math.max(0, snap.remaining));
        this.state.set('paused');
        this.emit();
        return;
      }

      // state was 'running' — account for elapsed time since snapshot
      const elapsedSec = Math.floor((Date.now() - snap.savedAt) / 1000);
      const adjusted = snap.remaining - elapsedSec;

      if (adjusted <= 0) {
        this.remaining.set(0);
        this.state.set('finished');
        this.emit();
        return;
      }

      this.remaining.set(adjusted);
      this.state.set('running');
      this.emit();
      this.startInterval();
    } catch { /* corrupt data — ignore */ }
  }

  private clearSnapshot() {
    if (!this.isBrowser) return;
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  private handleCommand(cmd: string) {
    if (cmd === 'start') {
      this.start(this.maxSeconds());
    } else if (cmd.startsWith('start:')) {
      const time = parseTime(cmd.slice('start:'.length));
      this.start(Math.min(time, this.maxSeconds()));
    } else if (cmd === 'pause') {
      this.pause();
    } else if (cmd === 'resume') {
      this.resume();
    } else if (cmd === 'stop') {
      this.stop();
    }
    // Reset command so the same command can be sent again
    this.command.set('');
  }

  private start(fromSeconds: number) {
    this.clearInterval();
    this.remaining.set(fromSeconds);
    this.state.set('running');
    this.emit();
    this.startInterval();
  }

  private pause() {
    if (this.state() !== 'running') return;
    this.clearInterval();
    this.state.set('paused');
    this.emit();
  }

  private resume() {
    if (this.state() !== 'paused') return;
    this.state.set('running');
    this.emit();
    this.startInterval();
  }

  private stop() {
    this.clearInterval();
    this.remaining.set(this.maxSeconds());
    this.state.set('idle');
    this.clearSnapshot();
    this.emit();
  }

  private startInterval() {
    this.intervalId = setInterval(() => {
      this.remaining.update((r) => {
        const next = r - 1;
        if (next <= 0) {
          this.clearInterval();
          this.state.set('finished');
          // Use 0 explicitly
          return 0;
        }
        return next;
      });
      this.emit();
    }, 1000);
  }

  private clearInterval() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private emit() {
    this.tick.emit({
      state: this.state(),
      remaining: this.remaining(),
      max: this.maxSeconds(),
      progress: this.progress(),
      display: this.display(),
    });
  }
}
