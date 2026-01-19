/**
 * Neon AI - Genre Library
 *
 * Default genres for electronic music production.
 * Each genre is in its own file for easy editing.
 *
 * @example
 * // Import specific genres
 * import { techno, house } from '@neon/ai';
 *
 * // Import the full library
 * import { DEFAULT_GENRES } from '@neon/ai';
 */

import type { GenreLibrary } from '../types';

// Individual genre exports
export { house } from './house';
export { techno } from './techno';
export { techHouse } from './tech-house';
export { trance } from './trance';
export { hardTrance } from './hard-trance';
export { psytrance } from './psytrance';
export { acid } from './acid';
export { garage } from './garage';
export { dnb } from './dnb';
export { hiphop } from './hiphop';
export { ebm } from './ebm';
export { italo } from './italo';
export { eurodance } from './eurodance';
export { nuDisco } from './nu-disco';
export { ambient } from './ambient';
export { hardcore } from './hardcore';
export { hardstyle } from './hardstyle';
export { gabber } from './gabber';
export { donk } from './donk';
export { world } from './world';
export { synthwave } from './synthwave';
export { dubstep } from './dubstep';
export { edm } from './edm';
export { nightcore } from './nightcore';
export { glitchHop } from './glitch-hop';
export { chiptune } from './chiptune';
export { pop } from './pop';
export { experimental } from './experimental';
export { chillwave } from './chillwave';
export { darksynth } from './darksynth';
export { vaporwave } from './vaporwave';
export { cinematic } from './cinematic';
export { witchHouse } from './witch-house';

// Import for library construction
import { house } from './house';
import { techno } from './techno';
import { techHouse } from './tech-house';
import { trance } from './trance';
import { hardTrance } from './hard-trance';
import { psytrance } from './psytrance';
import { acid } from './acid';
import { garage } from './garage';
import { dnb } from './dnb';
import { hiphop } from './hiphop';
import { ebm } from './ebm';
import { italo } from './italo';
import { eurodance } from './eurodance';
import { nuDisco } from './nu-disco';
import { ambient } from './ambient';
import { hardcore } from './hardcore';
import { hardstyle } from './hardstyle';
import { gabber } from './gabber';
import { donk } from './donk';
import { world } from './world';
import { synthwave } from './synthwave';
import { dubstep } from './dubstep';
import { edm } from './edm';
import { nightcore } from './nightcore';
import { glitchHop } from './glitch-hop';
import { chiptune } from './chiptune';
import { pop } from './pop';
import { experimental } from './experimental';
import { chillwave } from './chillwave';
import { darksynth } from './darksynth';
import { vaporwave } from './vaporwave';
import { cinematic } from './cinematic';
import { witchHouse } from './witch-house';

/**
 * Default genre library with all electronic music genres.
 * Apps can extend this with custom genres.
 */
export const DEFAULT_GENRES: GenreLibrary = {
  // House & Disco
  house,
  'tech-house': techHouse,
  'nu-disco': nuDisco,

  // Techno & Industrial
  techno,
  ebm,

  // Trance
  trance,
  'hard-trance': hardTrance,
  psytrance,

  // Hardcore & Hard Dance
  hardcore,
  hardstyle,
  gabber,
  donk,
  nightcore,

  // Bass Music
  dnb,
  dubstep,
  garage,

  // Hip-Hop & Beats
  hiphop,
  'glitch-hop': glitchHop,

  // Retro & Synth
  italo,
  eurodance,
  synthwave,
  chiptune,

  // Other
  acid,
  ambient,
  world,
  edm,
  pop,
  experimental,
  chillwave,
  darksynth,
  vaporwave,
  cinematic,
  'witch-house': witchHouse,
};

/**
 * Get a genre by ID, with fallback to custom genres
 */
export function getGenre(id: string, customGenres?: GenreLibrary) {
  return customGenres?.[id] ?? DEFAULT_GENRES[id];
}

/**
 * Merge custom genres with defaults (custom takes precedence)
 */
export function mergeGenres(customGenres?: GenreLibrary): GenreLibrary {
  return { ...DEFAULT_GENRES, ...customGenres };
}
