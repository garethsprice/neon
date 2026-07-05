/**
 * Neon UI Kit - Component Library
 * Export all components from this barrel file
 */

// Types
export * from './types';

// Utilities
export { el, queryAll, query, sleep, debounce, throttle, on, createElement } from './utils';

// Knob - Rotary control
export { createKnob, createKnobElement } from './knob';
export type { KnobElement } from './knob';

// Toast - Notifications
export { showToast, configureToast } from './toast';
export type { ConfigureToastOptions } from './toast';

// LED Button - Toggle button with LED indicator
export { createLedButton } from './led-button';

// Machine Button - Square machine-style buttons
export { createMachineButton } from './machine-button';
export type { MachineButtonOptions, MachineButtonComponent } from './machine-button';

// Action Button - Primary action buttons
export { createActionButton } from './action-button';
export type { ActionButtonVariant, ActionButtonOptions, ActionButtonComponent } from './action-button';

// Step Button - Sequencer steps
export { createStepButton, createStepGrid } from './step-button';
export type {
  StepValue,
  StepButtonOptions,
  StepButtonComponent,
  StepGridOptions,
  StepGridComponent
} from './step-button';

// FX Module - Collapsible effect modules
export { createFxModule, createFxPager } from './fx-module';
export type {
  FxModuleOptions,
  FxModuleComponent,
  FxControlDefinition,
  FxPagerOptions,
  FxPagerComponent
} from './fx-module';

// Panel - Container panels
export { createPanel } from './panel';
export type { PanelColor } from './panel';

// Input - Text, number, and textarea inputs
export { createInput, createTextarea } from './input';
export type {
  InputColor,
  InputType,
  InputOptions,
  InputComponent,
  TextareaOptions,
  TextareaComponent
} from './input';

// Sidebar - Slide-out panels
export { createSidebar } from './sidebar';
export type { SidebarOptions, SidebarComponent } from './sidebar';

// Feed Item - Activity feed cards
export { createFeedItem, createFeed } from './feed-item';
export type {
  FeedItemOptions,
  FeedItemComponent,
  FeedOptions,
  FeedComponent
} from './feed-item';

// Spectrum Analyzer - Audio frequency visualization
export { createSpectrumAnalyzer } from './spectrum-analyzer';
export type {
  SpectrumAnalyzerOptions,
  SpectrumAnalyzerComponent
} from './spectrum-analyzer';

// Keyboard - Interactive piano keyboard
export { createKeyboard, Keyboard } from './keyboard';
export type {
  KeyboardOptions,
  KeyboardComponent,
  KeyboardRange
} from './keyboard';

// Tracker - Step sequencer/tracker
/** @deprecated superseded by createTrackerGrid (passive, keyboard-driven) */
export { createTracker } from './tracker';
export type {
  TrackerOptions,
  TrackerComponent,
  TrackerState,
  StepNote
} from './tracker';

// Tracker Grid v2 - Passive multi-channel tracker for Neon Studio
export { createTrackerGrid } from './tracker-grid';
export type {
  TrackerCell,
  TrackerGridChannel,
  TrackerGridOptions,
  TrackerGridComponent
} from './tracker-grid';

// Order List - Song order editor for Neon Studio
export { createOrderList } from './order-list';
export type {
  OrderListOptions,
  OrderListComponent
} from './order-list';

// FX Chain - Editable FX chain for channel racks
export { createFxChain } from './fx-chain';
export type {
  FxChainPluginDescriptor,
  FxChainSlotState,
  FxChainOptions,
  FxChainComponent
} from './fx-chain';

// Channel Strip - Compact rack card for Neon Studio
export { createChannelStrip } from './channel-strip';
export type {
  ChannelStripOptions,
  ChannelStripComponent
} from './channel-strip';

// Mod Matrix - Source -> target -> depth modulation routing
export { createModMatrix } from './mod-matrix';
export type {
  ModMatrixRoute,
  ModMatrixOptions,
  ModMatrixComponent
} from './mod-matrix';

// Piano Roll - Vertical piano roll editor
export { createPianoRoll } from './piano-roll';
export type {
  PianoRollNote,
  PianoRollState,
  TrackerNoteData,
  PianoRollOptions,
  PianoRollComponent
} from './piano-roll';

// Pattern Bank - Pattern selector grid (A-H)
export { createPatternBank } from './pattern-bank';
export type {
  PatternId,
  PatternBankOptions,
  PatternBankComponent
} from './pattern-bank';

// Track Panel - Track metadata with thumbnail
export { createTrackPanel } from './track-panel';
export type {
  TrackPanelOptions,
  TrackPanelComponent
} from './track-panel';

// Visualizer - WebGL mesh gradient background
export { createVisualizer } from './visualizer';
export type {
  VisualizerConfig,
  VisualizerComponent
} from './visualizer';

// Thumbnail Modal - Image viewing and regeneration
export { createThumbnailModal } from './thumbnail-modal';
export type {
  ThumbnailModalOptions,
  ThumbnailModalComponent
} from './thumbnail-modal';

// Walkthrough - AI generation walkthrough framework
export {
  createWalkthrough,
  message,
  pause,
  highlight,
  typeText,
  animateValue,
  custom,
  sequence,
  withReasoning
} from './walkthrough';
export type {
  WalkthroughStep,
  WalkthroughConfig,
  WalkthroughContext,
  WalkthroughController,
  MessageStep,
  PauseStep,
  HighlightStep,
  TypeTextStep,
  AnimateValueStep,
  CustomStep,
  SequenceStep
} from './walkthrough';
