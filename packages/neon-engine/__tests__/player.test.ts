/**
 * Player tests: TrackerNoteData cell interpretation per noteMode, mute/solo
 * dispatch, and all-notes-off on transport stop.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { InstrumentModule, NoteEvent } from '@neon/instruments';
import { Player, type ChannelDispatch } from '../src/player';
import { Transport } from '../src/transport';
import type { TrackerNoteData } from '../src/song-model';

interface StubInstrument {
  triggers: NoteEvent[];
  offs: Array<number | undefined>;
  asModule(): InstrumentModule;
}

function stubInstrument(): StubInstrument {
  const stub: StubInstrument = {
    triggers: [],
    offs: [],
    asModule() {
      return {
        trigger: (ev: NoteEvent) => stub.triggers.push(ev),
        allNotesOff: (t?: number) => stub.offs.push(t)
      } as unknown as InstrumentModule;
    }
  };
  return stub;
}

describe('Player', () => {
  let ctx: { currentTime: number };
  let transport: Transport;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = { currentTime: 0 };
    transport = new Transport(ctx as unknown as AudioContext, {
      getPatternLength: () => 16,
      getSongOrder: () => ['A']
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makePlayer(
    patternChannels: Record<string, TrackerNoteData[][]>,
    dispatch: ChannelDispatch[]
  ): Player {
    return new Player(transport, {
      getPatternChannels: () => patternChannels,
      getDispatch: () => dispatch
    });
  }

  it('interprets pitched cells as MIDI notes with step-multiple durations', () => {
    const synth = stubInstrument();
    makePlayer(
      { ch1: [[60, null, [64, 4], null]] },
      [{ id: 'ch1', instrument: synth.asModule(), instrumentId: 'poly-synth', noteMode: 'pitched', audible: true }]
    );
    const stepDur = transport.stepDuration; // 0.125 @ 120bpm

    transport.onStep!({ time: 1.0, patternId: 'A', row: 0, songPos: null });
    transport.onStep!({ time: 1.25, patternId: 'A', row: 2, songPos: null });

    expect(synth.triggers).toEqual([
      { time: 1.0, note: 60, velocity: 0.8, duration: stepDur },
      { time: 1.25, note: 64, velocity: 0.8, duration: 4 * stepDur }
    ]);
  });

  it('interprets lanes cells as lane index + velocity code', () => {
    const drums = stubInstrument();
    makePlayer(
      // col 0 (bassDrum): accent on row 0; col 1 (snare): hit on row 0
      { ch1: [[2, null], [1, null]] },
      [{ id: 'ch1', instrument: drums.asModule(), instrumentId: 'tr909-kit', noteMode: 'lanes', audible: true }]
    );

    transport.onStep!({ time: 2.0, patternId: 'A', row: 0, songPos: null });

    expect(drums.triggers).toEqual([
      expect.objectContaining({ note: 0, velocity: 1.0, time: 2.0 }),
      expect.objectContaining({ note: 1, velocity: 0.8, time: 2.0 })
    ]);
  });

  it('skips channels that are not audible but still silences them on stop', () => {
    const muted = stubInstrument();
    makePlayer(
      { ch1: [[60]] },
      [{ id: 'ch1', instrument: muted.asModule(), instrumentId: 'poly-synth', noteMode: 'pitched', audible: false }]
    );

    transport.onStep!({ time: 1.0, patternId: 'A', row: 0, songPos: null });
    expect(muted.triggers).toEqual([]);

    transport.onStop!(3.5);
    expect(muted.offs).toEqual([3.5]);
  });

  it('ignores channels with no cells in the pattern', () => {
    const synth = stubInstrument();
    makePlayer(
      { other: [[60]] },
      [{ id: 'ch1', instrument: synth.asModule(), instrumentId: 'poly-synth', noteMode: 'pitched', audible: true }]
    );
    transport.onStep!({ time: 1.0, patternId: 'A', row: 0, songPos: null });
    expect(synth.triggers).toEqual([]);
  });

  it('fires onChannelTrigger once per triggering channel per step', () => {
    const synth = stubInstrument();
    const player = makePlayer(
      { ch1: [[60, null], [72, null]] }, // two columns, both trigger on row 0
      [{ id: 'ch1', instrument: synth.asModule(), instrumentId: 'poly-synth', noteMode: 'pitched', audible: true }]
    );
    const notified: Array<[string, number]> = [];
    player.onChannelTrigger = (id, time) => notified.push([id, time]);

    transport.onStep!({ time: 1.0, patternId: 'A', row: 0, songPos: null });
    transport.onStep!({ time: 1.125, patternId: 'A', row: 1, songPos: null });

    expect(synth.triggers.length).toBe(2);
    expect(notified).toEqual([['ch1', 1.0]]); // row 1 had no notes
  });
});
