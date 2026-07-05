/**
 * NEON STUDIO - AI Handler
 *
 * Builds capability-scoped system prompts (core + capability section, per
 * the suite's "system prompt is the router" convention), serializes a
 * sparse, token-cheap view of the project, and applies diff-only JSON
 * responses back onto the project — instantly or as a narrated, animated
 * walkthrough over the tracker grid.
 */

import type { TrackerGridComponent } from '@neon/ui';
import {
  ensurePatternChannel,
  createEmptyPattern,
  type PatternId,
  type PatternLength,
  type ProjectState,
  type TrackerNoteData
} from '@neon/engine';
import { TR909Kit, PolySynth, NoiseModule } from '@neon/instruments';
import promptsConfig from '../ai-prompts.json';

/** Param surfaces per instrument, so the model uses real units and ranges. */
const INSTRUMENT_PARAM_DEFS: Record<string, ReadonlyArray<{
  name: string; min: number; max: number; default: number; unit?: string;
}>> = {
  'tr909-kit': TR909Kit.parameterDefinitions,
  'poly-synth': PolySynth.parameterDefinitions,
  'noise': NoiseModule.parameterDefinitions
};

export type AICapability = 'pattern' | 'arrange' | 'sound' | 'mix';

export interface AIPatternResponse {
  bpm?: number;
  trackName?: string;
  patterns?: Record<string, {
    length?: number;
    channels?: Record<string, unknown>;
  }>;
  order?: string[];
  reasoning?: string[];
}

export interface AIContext {
  project: ProjectState;
  currentPatternId: PatternId;
  trackerGrid: TrackerGridComponent;
  logFeed: (message: string, isError?: boolean) => void;
  setBpm: (bpm: number) => void;
  refreshPattern: () => void;
  refreshMeta: () => void;
}

const VALID_LENGTHS: PatternLength[] = [8, 16, 32, 64];

export function buildSystemPrompt(capability: AICapability): string {
  const sections: Record<AICapability, string> = {
    pattern: promptsConfig.pattern,
    arrange: promptsConfig.arrange,
    sound: promptsConfig.sound,
    mix: promptsConfig.mix
  };
  return `${promptsConfig.core}\n\n${sections[capability]}`;
}

/**
 * Sparse project state for the model: full cells only for the current
 * pattern; other patterns as density digests.
 */
export function buildCurrentState(project: ProjectState, currentPatternId: PatternId): string {
  const channelTable = project.channelOrder.map(id => {
    const ch = project.channels[id];
    return {
      id,
      name: ch.name,
      instrument: ch.instrument.id,
      kind: ch.instrument.id === 'poly-synth' ? 'pitched' : 'lanes',
      columns: ch.columns,
      paramRanges: (INSTRUMENT_PARAM_DEFS[ch.instrument.id] ?? []).map(d =>
        `${d.name}: ${d.min}-${d.max}${d.unit ? ` ${d.unit}` : ''} (default ${d.default})`
      ),
      ...(ch.instrument.id === 'tr909-kit' && {
        lanes: ['bassDrum', 'snareDrum', 'lowTom', 'midTom', 'highTom', 'rimshot',
          'handclap', 'closedHiHat', 'openHiHat', 'crashCymbal', 'rideCymbal']
      }),
      ...(ch.instrument.id === 'noise' && { lanes: ['white', 'pink', 'brown', 'green'] })
    };
  });

  const patternDigests: Record<string, unknown> = {};
  for (const [id, pattern] of Object.entries(project.patterns)) {
    if (id === currentPatternId) continue;
    const density: Record<string, number> = {};
    for (const [chId, cols] of Object.entries(pattern.channels)) {
      density[chId] = cols.flat().filter(c => c !== null).length;
    }
    patternDigests[id] = { length: pattern.length, notes: density };
  }

  const current = project.patterns[currentPatternId];

  return JSON.stringify({
    bpm: project.bpm,
    swing: project.swing,
    trackName: project.name,
    channels: channelTable,
    songOrder: project.songOrder,
    otherPatterns: patternDigests,
    currentPatternId,
    currentPattern: current ?? null
  });
}

/** Coerce one column of unknown AI output into valid TrackerNoteData cells. */
function normalizeColumn(raw: unknown, length: number): TrackerNoteData[] {
  const col: TrackerNoteData[] = Array.from({ length }, () => null);
  if (!Array.isArray(raw)) return col;
  for (let row = 0; row < Math.min(raw.length, length); row++) {
    const cell = raw[row];
    if (typeof cell === 'number' && Number.isFinite(cell)) {
      col[row] = Math.round(cell);
    } else if (
      Array.isArray(cell) && cell.length >= 2 &&
      typeof cell[0] === 'number' && typeof cell[1] === 'number'
    ) {
      const note = Math.round(cell[0]);
      const dur = Math.max(1, Math.round(cell[1]));
      if (typeof cell[2] === 'number') {
        col[row] = [note, dur, Math.max(1, Math.min(127, Math.round(cell[2])))];
      } else {
        col[row] = [note, dur];
      }
    }
  }
  return col;
}

/**
 * Normalize a channel's cells. Accepts the canonical array-of-columns and
 * also a single flat column (models love flattening) — defensive per the
 * drums remapPatternIds precedent.
 */
function normalizeChannelCells(raw: unknown, columns: number, length: number): TrackerNoteData[][] {
  const out: TrackerNoteData[][] = [];
  if (Array.isArray(raw) && raw.length > 0 && !Array.isArray(raw[0]) && raw.some(c => c !== null)) {
    // flat single column
    out.push(normalizeColumn(raw, length));
  } else if (Array.isArray(raw)) {
    for (const col of raw.slice(0, columns)) {
      out.push(normalizeColumn(col, length));
    }
  }
  while (out.length < columns) {
    out.push(Array.from({ length }, () => null));
  }
  return out;
}

export async function requestGeneration(
  capability: AICapability,
  userPrompt: string,
  project: ProjectState,
  currentPatternId: PatternId
): Promise<AIPatternResponse> {
  const system = buildSystemPrompt(capability);
  const state = buildCurrentState(project, currentPatternId);

  const response = await websim.chat.completions.create({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `CURRENT STATE:\n${state}\n\nREQUEST: ${userPrompt}` }
    ],
    json: true
  });

  const parsed = JSON.parse(response.content) as AIPatternResponse;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('AI returned a non-object response');
  }
  return parsed;
}

/**
 * Apply a pattern-mode response onto the project. `animate` streams cells
 * into the tracker grid with flashes (the narrated walkthrough path);
 * without it everything lands instantly.
 */
export async function applyPatternResponse(
  result: AIPatternResponse,
  ctx: AIContext,
  animate: boolean
): Promise<void> {
  const { project } = ctx;

  for (const line of result.reasoning ?? []) {
    ctx.logFeed(line);
  }

  if (typeof result.bpm === 'number') {
    ctx.setBpm(result.bpm);
  }
  if (typeof result.trackName === 'string' && result.trackName.trim()) {
    project.name = result.trackName.trim();
    ctx.refreshMeta();
  }

  const patterns = result.patterns ?? {};
  for (const [rawId, patch] of Object.entries(patterns)) {
    // normalize arbitrary AI pattern names onto A-P slots
    const id = (rawId.trim().toUpperCase()[0] ?? 'A') as PatternId;
    if (!/^[A-P]$/.test(id)) continue;

    let pattern = project.patterns[id];
    if (!pattern) {
      const len = VALID_LENGTHS.includes(patch.length as PatternLength)
        ? (patch.length as PatternLength) : 16;
      pattern = createEmptyPattern(len);
      project.patterns[id] = pattern;
    }

    for (const [chId, rawCells] of Object.entries(patch.channels ?? {})) {
      const channel = project.channels[chId];
      if (!channel) continue;
      const cells = normalizeChannelCells(rawCells, channel.columns, pattern.length);

      if (id === ctx.currentPatternId && animate) {
        ctx.trackerGrid.setChannelFocus(chId, true);
        ensurePatternChannel(pattern, chId, channel.columns);
        for (let row = 0; row < pattern.length; row++) {
          for (let col = 0; col < cells.length; col++) {
            const cell = cells[col][row];
            pattern.channels[chId][col][row] = cell;
            ctx.trackerGrid.setCell(chId, col, row, cell);
            if (cell !== null) {
              ctx.trackerGrid.flashCell(chId, col, row);
            }
          }
          if (row % 4 === 3) {
            await new Promise(r => setTimeout(r, 45));
          }
        }
        ctx.trackerGrid.setChannelFocus(chId, false);
      } else {
        pattern.channels[chId] = cells;
      }
    }
  }

  if (Array.isArray(result.order) && result.order.length) {
    project.songOrder = result.order
      .map(id => String(id).trim().toUpperCase()[0])
      .filter((id): id is string => /^[A-P]$/.test(id ?? ''));
  }

  ctx.refreshPattern();
}
