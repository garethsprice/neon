import type { Skill } from '../types';

export const synthSoundDesign: Skill = {
  name: 'Synth Sound Design',
  description: 'Creating unique synthesizer patches',
  category: 'sound-design',
  applicableTo: ['synth', 'all'],
  augment: `SYNTH SOUND DESIGN PRINCIPLES:
- Oscillators: saw for brightness, square for hollow, sine for pure
- Detune: slight detuning (5-15 cents) creates width and warmth
- Filter: cutoff shapes tone, resonance adds character
- Envelopes: attack shapes transient, release shapes sustain
- LFO modulation: subtle movement keeps sounds alive
- Layer sounds: combine simple patches for complexity
- Less is more: start subtractive, add only what's needed`,
};
