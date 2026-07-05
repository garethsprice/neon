/**
 * Transport - Lookahead scheduler ("A Tale of Two Clocks").
 *
 * A coarse JS interval (default 25ms) wakes up and schedules every step that
 * falls inside the schedule-ahead window (default 150ms), timestamped on the
 * AudioContext clock. Consumers receive StepEvents with absolute `time`
 * values and must schedule audio AT those times (see @neon/instruments).
 *
 * Swing shifts odd 16th rows late on the emitted absolute timestamps; the
 * underlying unswung grid drives cursor advancement, so swing never
 * accumulates drift (the correctness fix over the legacy setTimeout
 * sequencers, which slept swung intervals).
 *
 * UI playheads must NOT track scheduling (it runs up to 150ms early):
 * poll getPositionAt(ctx.currentTime) from rAF to show the row currently
 * sounding.
 */

export interface StepEvent {
  /** Absolute AudioContext time this row sounds (swing included). */
  time: number;
  patternId: string;
  row: number;
  /** Index into songOrder, or null in pattern mode. */
  songPos: number | null;
}

export type PlayMode = 'pattern' | 'song';

export interface TransportOptions {
  /** Scheduler tick interval in ms (default 25). */
  lookaheadMs?: number;
  /** Schedule-ahead window in seconds (default 0.15). */
  scheduleAheadSec?: number;
  /** Rows in the given pattern (16th notes). */
  getPatternLength: (patternId: string) => number;
  getSongOrder: () => string[];
  /**
   * Live bpm source (e.g. an app whose bpm lives elsewhere). When provided
   * it overrides the transport's own bpm property.
   */
  getBpm?: () => number;
  /**
   * Per-pattern step-duration multiplier (e.g. the drums app's `scale`:
   * 2 = 8th-note steps). Default 1.
   */
  getStepScale?: (patternId: string) => number;
  /**
   * Per-pattern swing 0-100 (e.g. the drums app's per-pattern `shuffle`).
   * When provided it overrides the transport's own swing property.
   */
  getSwing?: (patternId: string) => number;
}

const MIN_BPM = 20;
const MAX_BPM = 300;
const START_DELAY_SEC = 0.05;
const HISTORY_MAX = 512;

export class Transport {
  private ctx: AudioContext;
  private opts: Required<Pick<TransportOptions, 'lookaheadMs' | 'scheduleAheadSec'>> &
    Omit<TransportOptions, 'lookaheadMs' | 'scheduleAheadSec'>;

  private _bpm = 120;
  private _swing = 0;
  private _playMode: PlayMode = 'pattern';
  private _patternId = 'A';
  private _queuedPatternId: string | null = null;
  private _queuedSongPos: number | null = null;
  private _isPlaying = false;
  private _timer: ReturnType<typeof setInterval> | null = null;

  /** Unswung time of the next row to schedule. */
  private _nextStepTime = 0;
  private _row = 0;
  private _songPos: number | null = null;
  private _history: StepEvent[] = [];

  /** Song-mode looping (pattern mode always loops). */
  loopSong = true;

  /** Single consumer (the Player); UI reads getPositionAt instead. */
  onStep: ((ev: StepEvent) => void) | null = null;
  onPatternChange: ((patternId: string, atTime: number) => void) | null = null;
  onPlayStateChange: ((isPlaying: boolean) => void) | null = null;
  /** Fired on stop with the time after which nothing should sound. */
  onStop: ((atTime: number) => void) | null = null;

  constructor(audioContext: AudioContext, options: TransportOptions) {
    this.ctx = audioContext;
    this.opts = {
      lookaheadMs: options.lookaheadMs ?? 25,
      scheduleAheadSec: options.scheduleAheadSec ?? 0.15,
      getPatternLength: options.getPatternLength,
      getSongOrder: options.getSongOrder,
      getBpm: options.getBpm,
      getStepScale: options.getStepScale,
      getSwing: options.getSwing
    };
  }

  get bpm(): number {
    if (this.opts.getBpm) {
      return Math.max(MIN_BPM, Math.min(MAX_BPM, this.opts.getBpm()));
    }
    return this._bpm;
  }

  /** Takes effect from the next scheduled step. */
  set bpm(value: number) {
    this._bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, value));
  }

  get swing(): number {
    return this._swing;
  }

  set swing(value: number) {
    this._swing = Math.max(0, Math.min(100, value));
  }

  get playMode(): PlayMode {
    return this._playMode;
  }

  /** Switching modes while playing takes effect on restart. */
  set playMode(mode: PlayMode) {
    this._playMode = mode;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get patternId(): string {
    return this._patternId;
  }

  get songPosition(): number | null {
    return this._songPos;
  }

  get queuedPatternId(): string | null {
    return this._queuedPatternId;
  }

  get queuedSongPosition(): number | null {
    return this._queuedSongPos;
  }

  /** Nominal (unswung) 16th-note duration in seconds. */
  get stepDuration(): number {
    return 60 / this.bpm / 4;
  }

  /** Step duration for a pattern, including its step-scale multiplier. */
  private _stepDurationFor(patternId: string): number {
    return this.stepDuration * (this.opts.getStepScale?.(patternId) ?? 1);
  }

  /** Effective swing 0-100 for a pattern. */
  private _swingFor(patternId: string): number {
    return this.opts.getSwing?.(patternId) ?? this._swing;
  }

  /** @param startPos song-mode starting position in the order (default 0) */
  start(startPos?: number): void {
    if (this._isPlaying) return;
    this._isPlaying = true;
    this._history = [];
    this._row = 0;
    if (this._playMode === 'song') {
      const order = this.opts.getSongOrder();
      const pos = Math.max(0, Math.min(order.length - 1, startPos ?? 0));
      this._songPos = order.length ? pos : 0;
      this._patternId = order[this._songPos] ?? this._patternId;
    } else {
      this._songPos = null;
    }
    this._nextStepTime = this.ctx.currentTime + START_DELAY_SEC;
    this._timer = setInterval(() => this._tick(), this.opts.lookaheadMs);
    this.onPlayStateChange?.(true);
    this._tick();
  }

  stop(afterTime?: number): void {
    if (!this._isPlaying) return;
    this._isPlaying = false;
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._queuedPatternId = null;
    this._queuedSongPos = null;
    this.onPlayStateChange?.(false);
    this.onStop?.(afterTime ?? this.ctx.currentTime);
  }

  toggle(): void {
    if (this._isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  }

  /**
   * Pattern mode: switch patterns at the next pattern boundary (immediately
   * when stopped).
   */
  queuePattern(id: string): void {
    if (!this._isPlaying || this._playMode !== 'pattern') {
      const changed = this._patternId !== id;
      this._patternId = id;
      this._queuedPatternId = null;
      if (changed) {
        this.onPatternChange?.(id, this.ctx.currentTime);
      }
      return;
    }
    this._queuedPatternId = id === this._patternId ? null : id;
  }

  /**
   * Song mode: jump to an order position at the next pattern boundary
   * (immediately when stopped).
   */
  queueSongPosition(pos: number): void {
    const order = this.opts.getSongOrder();
    if (pos < 0 || pos >= order.length) return;
    if (!this._isPlaying || this._playMode !== 'song') {
      this._songPos = pos;
      this._patternId = order[pos] ?? this._patternId;
      this._queuedSongPos = null;
      return;
    }
    this._queuedSongPos = pos;
  }

  /**
   * Position sounding at an AudioContext time (draws from scheduled history,
   * not the scheduling cursor, which runs ahead). `time` is the sounding
   * row's own timestamp, letting UIs derive continuous sub-row progress.
   * Null before the first row sounds or when stopped with no history.
   */
  getPositionAt(
    ctxTime: number
  ): { patternId: string; row: number; songPos: number | null; time: number } | null {
    for (let i = this._history.length - 1; i >= 0; i--) {
      const ev = this._history[i];
      if (ev.time <= ctxTime) {
        return { patternId: ev.patternId, row: ev.row, songPos: ev.songPos, time: ev.time };
      }
    }
    return null;
  }

  private _tick(): void {
    const horizon = this.ctx.currentTime + this.opts.scheduleAheadSec;
    while (this._isPlaying && this._nextStepTime < horizon) {
      const swingOffset =
        this._row % 2 === 1
          ? this._stepDurationFor(this._patternId) * (this._swingFor(this._patternId) / 100) * 0.5
          : 0;
      const ev: StepEvent = {
        time: this._nextStepTime + swingOffset,
        patternId: this._patternId,
        row: this._row,
        songPos: this._songPos
      };
      this._history.push(ev);
      if (this._history.length > HISTORY_MAX) {
        this._history.splice(0, this._history.length - HISTORY_MAX);
      }
      this.onStep?.(ev);
      this._advance();
    }
  }

  private _advance(): void {
    this._nextStepTime += this._stepDurationFor(this._patternId);
    this._row++;
    const length = Math.max(1, this.opts.getPatternLength(this._patternId));
    if (this._row < length) return;

    // Pattern boundary — queued switches and song advancement resolve here.
    this._row = 0;
    const boundaryTime = this._nextStepTime;

    if (this._playMode === 'pattern') {
      if (this._queuedPatternId !== null) {
        this._patternId = this._queuedPatternId;
        this._queuedPatternId = null;
        this.onPatternChange?.(this._patternId, boundaryTime);
      }
      return;
    }

    const order = this.opts.getSongOrder();
    let next = this._queuedSongPos ?? (this._songPos ?? 0) + 1;
    this._queuedSongPos = null;
    if (next >= order.length) {
      if (!this.loopSong) {
        this.stop(boundaryTime);
        return;
      }
      next = 0;
    }
    this._songPos = next;
    const nextPattern = order[next] ?? this._patternId;
    if (nextPattern !== this._patternId) {
      this._patternId = nextPattern;
      this.onPatternChange?.(nextPattern, boundaryTime);
    }
  }
}
