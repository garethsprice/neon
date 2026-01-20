/**
 * Neon UI - Type Definitions
 */

/** Color variants for components */
export type NeonColor = 'cyan' | 'magenta' | 'yellow' | 'green' | 'orange' | 'purple' | 'red';

/** Size variants */
export type NeonSize = 'small' | 'medium' | 'large';

/** Toast notification type */
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'ai';

/** Knob options */
export interface KnobOptions {
  label?: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  onRelease?: (value: number) => void;
  color?: NeonColor;
  size?: NeonSize;
  formatValue?: (value: number) => string | number;
}

/** Knob component interface */
export interface KnobComponent {
  element: HTMLElement;
  getValue: () => number;
  setValue: (value: number) => void;
  setDisplayValue: (text: string) => void;
  destroy: () => void;
}

/** LED button options */
export interface LedButtonOptions {
  label?: string;
  active?: boolean;
  color?: NeonColor;
  onClick?: (active: boolean) => void;
  toggle?: boolean;
  disabled?: boolean;
  size?: NeonSize;
}

/** LED button component interface */
export interface LedButtonComponent {
  element: HTMLElement;
  button: HTMLButtonElement;
  isActive: () => boolean;
  setActive: (value: boolean) => void;
  setDisabled: (value: boolean) => void;
  setColor: (color: NeonColor) => void;
  destroy: () => void;
}

/** Machine button options */
export interface MachineButtonOptions {
  label?: string;
  icon?: string;
  onClick?: () => void;
  color?: NeonColor;
  size?: NeonSize;
  disabled?: boolean;
  active?: boolean;
}

/** Machine button component interface */
export interface MachineButtonComponent {
  element: HTMLElement;
  setActive: (value: boolean) => void;
  setDisabled: (value: boolean) => void;
  setLabel: (label: string) => void;
  destroy: () => void;
}

/** Action button options */
export interface ActionButtonOptions {
  label: string;
  icon?: string;
  onClick?: () => void;
  color?: NeonColor;
  size?: NeonSize;
  disabled?: boolean;
  loading?: boolean;
}

/** Action button component interface */
export interface ActionButtonComponent {
  element: HTMLButtonElement;
  setLoading: (loading: boolean) => void;
  setDisabled: (value: boolean) => void;
  setLabel: (label: string) => void;
  destroy: () => void;
}

/** Step button options */
export interface StepButtonOptions {
  active?: boolean;
  color?: NeonColor;
  accent?: boolean;
  onClick?: (active: boolean) => void;
}

/** Step button component interface */
export interface StepButtonComponent {
  element: HTMLButtonElement;
  isActive: () => boolean;
  setActive: (value: boolean) => void;
  setAccent: (value: boolean) => void;
  destroy: () => void;
}

/** Panel options */
export interface PanelOptions {
  tag?: string;
  color?: 'default' | NeonColor;
  content?: HTMLElement | string | null;
}

/** Panel component interface */
export interface PanelComponent {
  element: HTMLElement;
  contentContainer: HTMLElement;
  setTag: (tag: string) => void;
  setContent: (content: HTMLElement | string | null) => void;
  appendChild: (child: HTMLElement) => void;
  setLoading: (loading: boolean) => void;
  setFocus: (focused: boolean) => void;
  setColor: (color: 'default' | NeonColor) => void;
  destroy: () => void;
}

/** Input options */
export interface InputOptions {
  label?: string;
  value?: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'email' | 'password';
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  disabled?: boolean;
}

/** Input component interface */
export interface InputComponent {
  element: HTMLElement;
  input: HTMLInputElement;
  getValue: () => string;
  setValue: (value: string) => void;
  setDisabled: (disabled: boolean) => void;
  focus: () => void;
  destroy: () => void;
}

/** Sidebar options */
export interface SidebarOptions {
  position?: 'left' | 'right';
  width?: string;
  header?: string;
  content?: HTMLElement | string;
  onClose?: () => void;
}

/** Sidebar component interface */
export interface SidebarComponent {
  element: HTMLElement;
  contentContainer: HTMLElement;
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  setContent: (content: HTMLElement | string) => void;
  setHeader: (header: string) => void;
  destroy: () => void;
}

/** FX module options */
export interface FxModuleOptions {
  title: string;
  color?: NeonColor;
  collapsed?: boolean;
  content?: HTMLElement;
  onToggle?: (collapsed: boolean) => void;
}

/** FX module component interface */
export interface FxModuleComponent {
  element: HTMLElement;
  contentContainer: HTMLElement;
  setCollapsed: (collapsed: boolean) => void;
  isCollapsed: () => boolean;
  setTitle: (title: string) => void;
  setContent: (content: HTMLElement) => void;
  destroy: () => void;
}

/** Feed item options */
export interface FeedItemOptions {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail?: string;
  stats?: {
    plays?: number;
    likes?: number;
    commits?: number;
  };
  isLiked?: boolean;
  isOwner?: boolean;
  onClick?: () => void;
  onLike?: () => void;
  onPlay?: () => void;
  onDelete?: () => void;
  onRemix?: () => void;
}

/** Feed item component interface */
export interface FeedItemComponent {
  element: HTMLElement;
  setLiked: (liked: boolean) => void;
  setStats: (stats: { plays?: number; likes?: number; commits?: number }) => void;
  destroy: () => void;
}

/** Spectrum analyzer options */
export interface SpectrumAnalyzerOptions {
  audioContext: AudioContext;
  width?: number;
  height?: number;
  color?: NeonColor;
  fftSize?: number;
}

/** Spectrum analyzer component interface */
export interface SpectrumAnalyzerComponent {
  element: HTMLCanvasElement;
  analyser: AnalyserNode;
  connect: (source: AudioNode) => void;
  start: () => void;
  stop: () => void;
  destroy: () => void;
}

/** Keyboard options */
export interface KeyboardOptions {
  octaves?: number;
  startOctave?: number;
  onNoteOn?: (note: number, velocity: number) => void;
  onNoteOff?: (note: number) => void;
}

/** Keyboard component interface */
export interface KeyboardComponent {
  element: HTMLElement;
  setActiveNote: (note: number | null) => void;
  destroy: () => void;
}

/** Toast result */
export interface ToastResult {
  dismiss: () => void;
}

/** createElement attributes */
export interface ElementAttributes {
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  dataset?: Record<string, string>;
  [key: string]: unknown;
}
