/**
 * Neon AI - Skills Library
 *
 * Default production skills for music apps.
 * Each skill is in its own file for easy editing.
 *
 * @example
 * // Import specific skills
 * import { mixing, mastering } from '@neon/ai';
 *
 * // Import the full library
 * import { DEFAULT_SKILLS } from '@neon/ai';
 */

import type { SkillLibrary, Skill } from '../types';

// Individual skill exports
export { drumProgramming } from './drum-programming';
export { grooveDesign } from './groove-design';
export { synthSoundDesign } from './synth-sound-design';
export { bassDesign } from './bass-design';
export { mixing } from './mixing';
export { mastering } from './mastering';
export { arrangement } from './arrangement';
export { buildupDesign } from './buildup-design';
export { livePerformance } from './live-performance';

// Import for library construction
import { drumProgramming } from './drum-programming';
import { grooveDesign } from './groove-design';
import { synthSoundDesign } from './synth-sound-design';
import { bassDesign } from './bass-design';
import { mixing } from './mixing';
import { mastering } from './mastering';
import { arrangement } from './arrangement';
import { buildupDesign } from './buildup-design';
import { livePerformance } from './live-performance';

/**
 * Default skills library with all production skills.
 * Apps can extend this with custom skills.
 */
export const DEFAULT_SKILLS: SkillLibrary = {
  'drum-programming': drumProgramming,
  'groove-design': grooveDesign,
  'synth-sound-design': synthSoundDesign,
  'bass-design': bassDesign,
  'mixing': mixing,
  'mastering': mastering,
  'arrangement': arrangement,
  'buildup-design': buildupDesign,
  'live-performance': livePerformance,
};

/**
 * Get a skill by ID, with fallback to custom skills
 */
export function getSkill(id: string, customSkills?: SkillLibrary): Skill | undefined {
  return customSkills?.[id] ?? DEFAULT_SKILLS[id];
}

/**
 * Merge custom skills with defaults (custom takes precedence)
 */
export function mergeSkills(customSkills?: SkillLibrary): SkillLibrary {
  return { ...DEFAULT_SKILLS, ...customSkills };
}

/**
 * Get skills applicable to a specific app type
 */
export function getSkillsForApp(
  appType: 'drums' | 'synth' | 'noise',
  customSkills?: SkillLibrary
): SkillLibrary {
  const allSkills = mergeSkills(customSkills);
  const result: SkillLibrary = {};

  for (const [id, skill] of Object.entries(allSkills)) {
    const applicableTo = skill.applicableTo || ['all'];
    if (applicableTo.includes('all') || applicableTo.includes(appType)) {
      result[id] = skill;
    }
  }

  return result;
}

/**
 * Get skills by category
 */
export function getSkillsByCategory(
  category: Skill['category'],
  customSkills?: SkillLibrary
): SkillLibrary {
  const allSkills = mergeSkills(customSkills);
  const result: SkillLibrary = {};

  for (const [id, skill] of Object.entries(allSkills)) {
    if (skill.category === category) {
      result[id] = skill;
    }
  }

  return result;
}
