/**
 * Transport scheduler tests: exact StepEvent.time sequences under bpm/swing
 * changes, pattern queueing at boundaries, song-mode advancement, and the
 * sounding-position query.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Transport, type StepEvent } from '../src/transport';

interface TestRig {
  ctx: { currentTime: number };
  transport: Transport;
  events: StepEvent[];
  lengths: Record<string, number>;
  order: string[];
}

function createRig(opts: { lengths?: Record<string, number>; order?: string[] } = {}): TestRig {
  const ctx = { currentTime: 0 };
  const lengths = opts.lengths ?? { A: 16, B: 16 };
  const order = opts.order ?? ['A'];
  const transport = new Transport(ctx as unknown as AudioContext, {
    getPatternLength: id => lengths[id] ?? 16,
    getSongOrder: () => order
  });
  const events: StepEvent[] = [];
  transport.onStep = ev => events.push(ev);
  return { ctx, transport, events, lengths, order };
}

describe('Transport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits 16th-note steps on an exact absolute-time grid', () => {
    const { ctx, transport, events } = createRig();
    transport.start(); // first tick runs immediately at currentTime=0

    ctx.currentTime = 1.0;
    vi.advanceTimersByTime(25); // one scheduler tick fills the window

    expect(events.length).toBeGreaterThan(8);
    events.forEach((ev, k) => {
      expect(ev.time).toBeCloseTo(0.05 + k * 0.125, 9); // bpm 120 -> 0.125s steps
      expect(ev.patternId).toBe('A');
      expect(ev.songPos).toBeNull();
      expect(ev.row).toBe(k % 16);
    });
  });

  it('swing delays odd rows on absolute timestamps without accumulating', () => {
    const { ctx, transport, events } = createRig();
    transport.swing = 50; // offset = 0.125 * 0.5 * 0.5 = 0.03125
    transport.start();
    ctx.currentTime = 1.0;
    vi.advanceTimersByTime(25);

    expect(events[0].time).toBeCloseTo(0.05, 9);
    expect(events[1].time).toBeCloseTo(0.175 + 0.03125, 9);
    expect(events[2].time).toBeCloseTo(0.3, 9);      // even row back on the grid
    expect(events[3].time).toBeCloseTo(0.425 + 0.03125, 9);
  });

  it('bpm changes take effect from the next scheduled step', () => {
    const { ctx, transport, events } = createRig();
    transport.start(); // schedules row 0 (horizon 0.15)
    expect(events.length).toBe(1);

    transport.bpm = 60; // stepDuration 0.25 from here on
    ctx.currentTime = 1.0;
    vi.advanceTimersByTime(25);

    // row1 time was already computed with the old tempo; deltas after are 0.25
    expect(events[1].time).toBeCloseTo(0.175, 9);
    for (let k = 2; k < events.length; k++) {
      expect(events[k].time - events[k - 1].time).toBeCloseTo(0.25, 9);
    }
  });

  it('clamps bpm and swing to sane ranges', () => {
    const { transport } = createRig();
    transport.bpm = 5;
    expect(transport.bpm).toBe(20);
    transport.bpm = 900;
    expect(transport.bpm).toBe(300);
    transport.swing = 150;
    expect(transport.swing).toBe(100);
  });

  it('queued pattern switches exactly at the pattern boundary', () => {
    const { ctx, transport, events } = createRig({ lengths: { A: 4, B: 4 } });
    const changes: Array<{ id: string; atTime: number }> = [];
    transport.onPatternChange = (id, atTime) => changes.push({ id, atTime });

    transport.start();
    transport.queuePattern('B');
    expect(transport.queuedPatternId).toBe('B');

    ctx.currentTime = 2.0;
    vi.advanceTimersByTime(25);

    const aEvents = events.filter(e => e.patternId === 'A');
    const bEvents = events.filter(e => e.patternId === 'B');
    expect(aEvents.map(e => e.row)).toEqual([0, 1, 2, 3]); // full pattern of A
    expect(bEvents[0].row).toBe(0);
    // boundary = start delay + 4 steps
    expect(bEvents[0].time).toBeCloseTo(0.05 + 4 * 0.125, 9);
    expect(changes).toEqual([{ id: 'B', atTime: expect.closeTo(0.55, 9) }]);
    expect(transport.queuedPatternId).toBeNull();
  });

  it('switches immediately when queueing while stopped', () => {
    const { transport } = createRig({ lengths: { A: 4, B: 4 } });
    transport.queuePattern('B');
    expect(transport.patternId).toBe('B');
    expect(transport.queuedPatternId).toBeNull();
  });

  it('song mode walks the order list and loops', () => {
    const { ctx, transport, events } = createRig({
      lengths: { A: 2, B: 2 },
      order: ['A', 'B']
    });
    transport.playMode = 'song';
    transport.start();
    ctx.currentTime = 1.0;
    vi.advanceTimersByTime(25);

    const seq = events.slice(0, 6).map(e => `${e.patternId}${e.row}@${e.songPos}`);
    expect(seq).toEqual(['A0@0', 'A1@0', 'B0@1', 'B1@1', 'A0@0', 'A1@0']);
  });

  it('song mode without loop stops at the end and reports the stop time', () => {
    const { ctx, transport, events } = createRig({
      lengths: { A: 2, B: 2 },
      order: ['A', 'B']
    });
    transport.playMode = 'song';
    transport.loopSong = false;
    const stops: number[] = [];
    transport.onStop = t => stops.push(t);

    transport.start();
    ctx.currentTime = 2.0;
    vi.advanceTimersByTime(50);

    expect(events.length).toBe(4); // A0 A1 B0 B1, then stop
    expect(transport.isPlaying).toBe(false);
    expect(stops).toEqual([expect.closeTo(0.05 + 4 * 0.125, 9)]);
  });

  it('queueSongPosition jumps at the next boundary while playing', () => {
    const { ctx, transport, events } = createRig({
      lengths: { A: 2, B: 2, C: 2 },
      order: ['A', 'B', 'C']
    });
    transport.playMode = 'song';
    transport.start();
    transport.queueSongPosition(2); // skip B

    ctx.currentTime = 1.0;
    vi.advanceTimersByTime(25);

    const seq = events.slice(0, 4).map(e => `${e.patternId}@${e.songPos}`);
    expect(seq).toEqual(['A@0', 'A@0', 'C@2', 'C@2']);
  });

  it('getPositionAt returns the row sounding at a time, not the scheduling cursor', () => {
    const { ctx, transport } = createRig();
    transport.start();
    ctx.currentTime = 1.0;
    vi.advanceTimersByTime(25); // scheduled far ahead of 0.2s

    expect(transport.getPositionAt(0.01)).toBeNull(); // before first row sounds
    expect(transport.getPositionAt(0.2)).toMatchObject({ patternId: 'A', row: 1 });
    expect(transport.getPositionAt(0.3)).toMatchObject({ row: 2 });
  });

  it('getStepScale stretches a pattern\'s step duration (and its swing offset)', () => {
    const ctx = { currentTime: 0 };
    const transport = new Transport(ctx as unknown as AudioContext, {
      getPatternLength: () => 16,
      getSongOrder: () => [],
      getStepScale: () => 2, // 8th-note steps at 120bpm -> 0.25s
      getSwing: () => 50
    });
    const events: StepEvent[] = [];
    transport.onStep = ev => events.push(ev);
    transport.start();
    ctx.currentTime = 2.0;
    vi.advanceTimersByTime(25);

    expect(events[1].time).toBeCloseTo(0.05 + 0.25 + 0.25 * 0.5 * 0.5, 9); // swung odd row
    expect(events[2].time).toBeCloseTo(0.05 + 0.5, 9);                     // even row on grid
  });

  it('getBpm overrides the transport bpm live', () => {
    const ctx = { currentTime: 0 };
    let bpm = 60;
    const transport = new Transport(ctx as unknown as AudioContext, {
      getPatternLength: () => 16,
      getSongOrder: () => [],
      getBpm: () => bpm
    });
    expect(transport.stepDuration).toBeCloseTo(0.25, 9);
    bpm = 120;
    expect(transport.stepDuration).toBeCloseTo(0.125, 9);
    bpm = 5; // clamped
    expect(transport.bpm).toBe(20);
  });

  it('start(startPos) begins song playback mid-order', () => {
    const { ctx, transport, events } = createRig({
      lengths: { A: 2, B: 2, C: 2 },
      order: ['A', 'B', 'C']
    });
    transport.playMode = 'song';
    transport.start(1);
    ctx.currentTime = 0.6;
    vi.advanceTimersByTime(25);

    const seq = events.slice(0, 4).map(e => `${e.patternId}@${e.songPos}`);
    expect(seq).toEqual(['B@1', 'B@1', 'C@2', 'C@2']);
  });

  it('getPositionAt exposes the sounding row\'s own timestamp', () => {
    const { ctx, transport } = createRig();
    transport.start();
    ctx.currentTime = 1.0;
    vi.advanceTimersByTime(25);

    const pos = transport.getPositionAt(0.2)!;
    expect(pos.row).toBe(1);
    expect(pos.time).toBeCloseTo(0.175, 9);
  });

  it('stop() clears queues and fires play-state callbacks', () => {
    const { transport } = createRig({ lengths: { A: 4, B: 4 } });
    const states: boolean[] = [];
    transport.onPlayStateChange = s => states.push(s);
    transport.start();
    transport.queuePattern('B');
    transport.stop();
    expect(states).toEqual([true, false]);
    expect(transport.queuedPatternId).toBeNull();
    expect(transport.isPlaying).toBe(false);
  });
});
