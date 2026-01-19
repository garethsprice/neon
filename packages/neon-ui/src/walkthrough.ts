/**
 * Neon UI - AI Walkthrough Framework
 *
 * Animated walkthrough for AI generation, showing steps as they happen.
 * Apps define their own step handlers for their specific operations.
 *
 * @example
 * import { createWalkthrough, WalkthroughStep } from '@neon/ui';
 *
 * const steps: WalkthroughStep[] = [
 *   { type: 'message', message: 'Setting tempo...', duration: 500 },
 *   { type: 'custom', handler: async () => { setBpm(128); } },
 *   { type: 'animate', target: '#bpm-knob', property: 'value', from: 120, to: 128 }
 * ];
 *
 * const walkthrough = createWalkthrough({
 *   onMessage: (msg) => showToast(msg, 'info'),
 *   onComplete: () => showToast('Complete!', 'success'),
 *   onAbort: () => showToast('Stopped', 'info')
 * });
 *
 * await walkthrough.run(steps);
 */

import { showToast } from './toast';

// =============================================================================
// TYPES
// =============================================================================

/** Base step interface */
export interface WalkthroughStepBase {
  /** Optional reasoning message to show */
  reasoning?: string;
  /** Duration in ms (for timing, not animation) */
  duration?: number;
}

/** Show a toast message */
export interface MessageStep extends WalkthroughStepBase {
  type: 'message';
  message: string;
  variant?: 'info' | 'success' | 'error';
}

/** Pause for a duration */
export interface PauseStep extends WalkthroughStepBase {
  type: 'pause';
  duration: number;
}

/** Highlight an element */
export interface HighlightStep extends WalkthroughStepBase {
  type: 'highlight';
  selector: string;
  className?: string;
  duration?: number;
}

/** Type text into an input */
export interface TypeTextStep extends WalkthroughStepBase {
  type: 'typeText';
  selector: string;
  text: string;
  speed?: number; // ms per character
  onUpdate?: (value: string) => void;
}

/** Animate a numeric value */
export interface AnimateValueStep extends WalkthroughStepBase {
  type: 'animateValue';
  from: number;
  to: number;
  steps?: number;
  stepDelay?: number;
  onUpdate: (value: number) => void;
}

/** Custom async handler */
export interface CustomStep extends WalkthroughStepBase {
  type: 'custom';
  handler: (context: WalkthroughContext) => Promise<void> | void;
}

/** Sequential steps (run in order) */
export interface SequenceStep extends WalkthroughStepBase {
  type: 'sequence';
  steps: WalkthroughStep[];
}

/** All step types */
export type WalkthroughStep =
  | MessageStep
  | PauseStep
  | HighlightStep
  | TypeTextStep
  | AnimateValueStep
  | CustomStep
  | SequenceStep;

/** Walkthrough configuration */
export interface WalkthroughConfig {
  /** Called when a reasoning message should be shown */
  onReasoning?: (message: string) => void;
  /** Called when a regular message should be shown */
  onMessage?: (message: string, variant?: 'info' | 'success' | 'error') => void;
  /** Called when walkthrough completes */
  onComplete?: () => void;
  /** Called when walkthrough is aborted */
  onAbort?: () => void;
  /** Called on step start */
  onStepStart?: (step: WalkthroughStep, index: number) => void;
  /** Called on step complete */
  onStepComplete?: (step: WalkthroughStep, index: number) => void;
}

/** Context passed to step handlers */
export interface WalkthroughContext {
  /** Check if walkthrough was aborted */
  checkAbort: () => void;
  /** Show a reasoning message */
  showReasoning: (message: string) => void;
  /** Show a regular message */
  showMessage: (message: string, variant?: 'info' | 'success' | 'error') => void;
  /** Sleep for a duration */
  sleep: (ms: number) => Promise<void>;
  /** Highlight an element temporarily */
  highlight: (selector: string, className?: string, duration?: number) => Promise<void>;
  /** Type text into an input */
  typeText: (selector: string, text: string, speed?: number, onUpdate?: (value: string) => void) => Promise<void>;
  /** Animate a numeric value */
  animateValue: (from: number, to: number, onUpdate: (value: number) => void, steps?: number, stepDelay?: number) => Promise<void>;
}

/** Walkthrough controller */
export interface WalkthroughController {
  /** Run the walkthrough with given steps */
  run: (steps: WalkthroughStep[]) => Promise<void>;
  /** Abort the walkthrough */
  abort: () => void;
  /** Check if currently running */
  isRunning: () => boolean;
}

// =============================================================================
// UTILITIES
// =============================================================================

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

// =============================================================================
// CREATE WALKTHROUGH
// =============================================================================

/**
 * Create a walkthrough controller
 */
export function createWalkthrough(config: WalkthroughConfig = {}): WalkthroughController {
  let aborted = false;
  let running = false;

  const checkAbort = (): void => {
    if (aborted) throw new Error('WALKTHROUGH_ABORTED');
  };

  const showReasoning = (message: string): void => {
    if (config.onReasoning) {
      config.onReasoning(message);
    } else if (config.onMessage) {
      config.onMessage(`[AI] ${message}`, 'info');
    } else {
      showToast(`[AI] ${message}`, 'info');
    }
  };

  const showMessage = (message: string, variant: 'info' | 'success' | 'error' = 'info'): void => {
    if (config.onMessage) {
      config.onMessage(message, variant);
    } else {
      showToast(message, variant);
    }
  };

  const highlight = async (selector: string, className = 'ai-focus', duration = 500): Promise<void> => {
    checkAbort();
    const el = document.querySelector(selector);
    if (el) {
      el.classList.add(className);
      await sleep(duration);
      checkAbort();
      el.classList.remove(className);
    }
  };

  const typeText = async (
    selector: string,
    text: string,
    speed = 25,
    onUpdate?: (value: string) => void
  ): Promise<void> => {
    checkAbort();
    const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;

    el.value = '';
    for (let i = 0; i < text.length; i++) {
      checkAbort();
      el.value += text[i];
      onUpdate?.(el.value);
      if (i % 3 === 0) await sleep(speed);
    }
  };

  const animateValue = async (
    from: number,
    to: number,
    onUpdate: (value: number) => void,
    steps = 10,
    stepDelay = 20
  ): Promise<void> => {
    for (let i = 0; i <= steps; i++) {
      checkAbort();
      const value = Math.round(from + (to - from) * (i / steps));
      onUpdate(value);
      await sleep(stepDelay);
    }
  };

  const context: WalkthroughContext = {
    checkAbort,
    showReasoning,
    showMessage,
    sleep: async (ms: number) => {
      checkAbort();
      await sleep(ms);
      checkAbort();
    },
    highlight,
    typeText,
    animateValue
  };

  const runStep = async (step: WalkthroughStep): Promise<void> => {
    checkAbort();

    // Show reasoning if present
    if (step.reasoning) {
      showReasoning(step.reasoning);
      await sleep(600);
    }

    switch (step.type) {
      case 'message':
        showMessage(step.message, step.variant);
        if (step.duration) await sleep(step.duration);
        break;

      case 'pause':
        await sleep(step.duration);
        break;

      case 'highlight':
        await highlight(step.selector, step.className, step.duration);
        break;

      case 'typeText':
        await typeText(step.selector, step.text, step.speed, step.onUpdate);
        break;

      case 'animateValue':
        await animateValue(step.from, step.to, step.onUpdate, step.steps, step.stepDelay);
        break;

      case 'custom':
        await step.handler(context);
        break;

      case 'sequence':
        for (const subStep of step.steps) {
          await runStep(subStep);
        }
        break;
    }

    if (step.duration && step.type !== 'pause') {
      await sleep(step.duration);
    }
  };

  return {
    async run(steps: WalkthroughStep[]): Promise<void> {
      if (running) return;

      running = true;
      aborted = false;

      try {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          config.onStepStart?.(step, i);
          await runStep(step);
          config.onStepComplete?.(step, i);
        }
        config.onComplete?.();
      } catch (err) {
        if ((err as Error).message === 'WALKTHROUGH_ABORTED') {
          config.onAbort?.();
        } else {
          throw err;
        }
      } finally {
        running = false;
      }
    },

    abort(): void {
      aborted = true;
    },

    isRunning(): boolean {
      return running;
    }
  };
}

// =============================================================================
// STEP BUILDERS (convenience functions)
// =============================================================================

/** Create a message step */
export function message(msg: string, variant?: 'info' | 'success' | 'error', duration?: number): MessageStep {
  return { type: 'message', message: msg, variant, duration };
}

/** Create a pause step */
export function pause(duration: number): PauseStep {
  return { type: 'pause', duration };
}

/** Create a highlight step */
export function highlight(selector: string, duration = 500, className = 'ai-focus'): HighlightStep {
  return { type: 'highlight', selector, className, duration };
}

/** Create a type text step */
export function typeText(
  selector: string,
  text: string,
  speed = 25,
  onUpdate?: (value: string) => void
): TypeTextStep {
  return { type: 'typeText', selector, text, speed, onUpdate };
}

/** Create an animate value step */
export function animateValue(
  from: number,
  to: number,
  onUpdate: (value: number) => void,
  steps = 10,
  stepDelay = 20
): AnimateValueStep {
  return { type: 'animateValue', from, to, onUpdate, steps, stepDelay };
}

/** Create a custom step */
export function custom(handler: (context: WalkthroughContext) => Promise<void> | void): CustomStep {
  return { type: 'custom', handler };
}

/** Create a sequence step */
export function sequence(...steps: WalkthroughStep[]): SequenceStep {
  return { type: 'sequence', steps };
}

/** Add reasoning to a step */
export function withReasoning<T extends WalkthroughStep>(step: T, reasoning: string): T {
  return { ...step, reasoning };
}
