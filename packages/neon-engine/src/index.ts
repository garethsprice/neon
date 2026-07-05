/**
 * @neon/engine - Shared transport, sequencing, and channel-rack engine
 * for the Neon suite.
 *
 * Provides the lookahead-scheduled Transport, the pattern/song Player,
 * the canonical ProjectState song model, per-channel rack audio graphs
 * (instrument -> FX chain -> mix), and the control-rate modulation engine.
 */

export { Transport, type StepEvent, type PlayMode, type TransportOptions } from './transport';
export { Player, type ChannelDispatch, type PlayerOptions } from './player';
export { ChannelRack, type RackChannel, type ResolvedModTarget } from './channel-rack';
export { ModEngine, type ModEngineOptions } from './mod-engine';
export {
  PATTERN_IDS,
  STUDIO_DIFF_CONFIG,
  createChannelState,
  createDefaultMods,
  createDefaultProject,
  createEmptyCells,
  createEmptyPattern,
  cellsAreEmpty,
  ensurePatternChannel,
  prunePattern,
  type ChannelId,
  type ChannelModsState,
  type ChannelState,
  type LfoState,
  type ModEnvState,
  type ModRouteState,
  type ModSourceId,
  type PatternId,
  type PatternLength,
  type PatternState,
  type ProjectState,
  type TrackerNoteData
} from './song-model';
