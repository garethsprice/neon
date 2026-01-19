declare module '@tonejs/midi' {
  export class Midi {
    constructor(data?: ArrayBuffer);
    tracks: MidiTrack[];
    header: MidiHeader;
    duration: number;
    toArray(): Uint8Array<ArrayBuffer>;
    addTrack(): WritableMidiTrack;
    static fromUrl(url: string): Promise<Midi>;
  }

  export interface WritableMidiTrack {
    name: string;
    channel: number;
    notes: MidiNote[];
    instrument: { number: number; name: string };
    controlChanges: Record<number, MidiCC[]>;
    pitchBends: MidiPitchBend[];
    endOfTrackTicks?: number;
    addNote(options: { midi: number; time: number; duration: number; velocity?: number }): MidiNote;
  }

  export interface MidiTrack {
    name: string;
    channel: number;
    notes: MidiNote[];
    instrument: { number: number; name: string };
    controlChanges: Record<number, MidiCC[]>;
    pitchBends: MidiPitchBend[];
    endOfTrackTicks?: number;
  }

  export interface MidiNote {
    name: string;
    midi: number;
    ticks: number;
    time: number;
    duration: number;
    durationTicks: number;
    velocity: number;
  }

  export interface MidiCC {
    ticks: number;
    time: number;
    value: number;
  }

  export interface MidiPitchBend {
    ticks: number;
    time: number;
    value: number;
  }

  export interface MidiHeader {
    name: string;
    ppq: number;
    tempos: MidiTempo[];
    timeSignatures: MidiTimeSignature[];
    keySignatures: MidiKeySignature[];
    meta: MidiMeta[];
    setTempo(bpm: number): void;
  }

  export interface MidiTempo {
    bpm: number;
    ticks: number;
    time: number;
  }

  export interface MidiTimeSignature {
    ticks: number;
    timeSignature: [number, number];
    measures?: number;
  }

  export interface MidiKeySignature {
    ticks: number;
    key: string;
    scale: string;
  }

  export interface MidiMeta {
    type: string;
    text: string;
    ticks: number;
  }
}
