/**
 * Player - Converts pattern cells into scheduled NoteEvents.
 *
 * Subscribes to the Transport's StepEvents and, for every audible channel,
 * reads the pattern's cell grid and triggers the channel's instrument with
 * the event's absolute time.
 *
 * Cell interpretation is strictly a function of the channel's noteMode:
 *  - 'pitched': cell value is a MIDI note number; velocity is fixed 0.8
 *  - 'lanes':   column index is the lane; cell value is a velocity code
 *               (1 -> 0.8, 2 -> accent 1.0)
 * [value, durSteps] extends the gate; durations follow the NOMINAL step
 * duration (unswung), matching the piano-roll's behavior.
 */

import type { InstrumentModule, NoteMode } from '@neon/instruments';
import type { TrackerNoteData } from './song-model';
import type { StepEvent, Transport } from './transport';

export interface ChannelDispatch {
  id: string;
  instrument: InstrumentModule;
  instrumentId: string;
  noteMode: NoteMode;
  /** Mute/solo already resolved: false = don't trigger new notes. */
  audible: boolean;
}

export interface PlayerOptions {
  /** channelId -> [column][row] cells for a pattern (undefined = silent). */
  getPatternChannels: (patternId: string) => Record<string, TrackerNoteData[][]> | undefined;
  getDispatch: () => ChannelDispatch[];
}

const HIT_VELOCITY = 0.8;
const ACCENT_VELOCITY = 1.0;

export class Player {
  private transport: Transport;
  private opts: PlayerOptions;

  /** UI/mod hook: fired after audio is scheduled for a step. */
  onStep: ((ev: StepEvent) => void) | null = null;
  /** Fired when a channel triggers >= 1 note (feeds mod envelopes). */
  onChannelTrigger: ((channelId: string, time: number) => void) | null = null;
  /** Fired on drum-kit kick-lane hits (lane 0) — drives sidechain ducking. */
  onKick: ((channelId: string, time: number) => void) | null = null;

  constructor(transport: Transport, options: PlayerOptions) {
    this.transport = transport;
    this.opts = options;
    transport.onStep = ev => this._handleStep(ev);
    transport.onStop = t => this.allNotesOff(t);
  }

  allNotesOff(afterTime?: number): void {
    for (const ch of this.opts.getDispatch()) {
      ch.instrument.allNotesOff(afterTime);
    }
  }

  private _handleStep(ev: StepEvent): void {
    const channels = this.opts.getPatternChannels(ev.patternId);
    if (channels) {
      const stepDur = this.transport.stepDuration;
      for (const ch of this.opts.getDispatch()) {
        if (!ch.audible) continue;
        const cols = channels[ch.id];
        if (!cols) continue;

        let triggered = false;
        for (let colIdx = 0; colIdx < cols.length; colIdx++) {
          const cell = cols[colIdx][ev.row];
          if (cell === null || cell === undefined) continue;

          let value: number;
          let durSteps = 1;
          let velocity127: number | undefined;
          if (Array.isArray(cell)) {
            value = cell[0];
            durSteps = Math.max(1, cell[1] ?? 1);
            if (typeof cell[2] === 'number') {
              velocity127 = Math.max(1, Math.min(127, cell[2]));
            }
          } else {
            value = cell;
          }

          if (ch.noteMode === 'lanes') {
            ch.instrument.trigger({
              time: ev.time,
              note: colIdx,
              velocity: value >= 2 ? ACCENT_VELOCITY : HIT_VELOCITY,
              duration: durSteps * stepDur
            });
            if (colIdx === 0 && ch.instrumentId === 'tr909-kit') {
              this.onKick?.(ch.id, ev.time);
            }
          } else {
            ch.instrument.trigger({
              time: ev.time,
              note: value,
              velocity: velocity127 !== undefined ? velocity127 / 127 : HIT_VELOCITY,
              duration: durSteps * stepDur
            });
          }
          triggered = true;
        }
        if (triggered) {
          this.onChannelTrigger?.(ch.id, ev.time);
        }
      }
    }
    this.onStep?.(ev);
  }
}
