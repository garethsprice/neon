/**
 * neon-ui/utils.ts
 * Common DOM utilities and helpers
 */

import type { ElementAttributes } from './types';

/**
 * Get element by ID
 */
export const el = (id: string): HTMLElement | null => document.getElementById(id);

/**
 * Query all elements matching selector
 */
export const queryAll = <T extends Element = Element>(
  selector: string,
  parent: Document | HTMLElement = document
): NodeListOf<T> => parent.querySelectorAll<T>(selector);

/**
 * Query single element matching selector
 */
export const query = <T extends Element = Element>(
  selector: string,
  parent: Document | HTMLElement = document
): T | null => parent.querySelector<T>(selector);

/**
 * Sleep for specified milliseconds
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function(this: unknown, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;
  return function(this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      return fn.apply(this, args) as ReturnType<T>;
    }
    return undefined;
  };
}

/**
 * Add event listener with automatic cleanup
 */
export function on<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  event: K,
  handler: (ev: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions
): () => void {
  element.addEventListener(event, handler, options);
  return () => element.removeEventListener(event, handler, options);
}

/**
 * Create element with attributes and children
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: ElementAttributes = {},
  children: (string | Node)[] | string = []
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className' && typeof value === 'string') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object' && value !== null) {
      Object.assign(element.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(
        key.slice(2).toLowerCase(),
        value as EventListener
      );
    } else if (key === 'dataset' && typeof value === 'object' && value !== null) {
      Object.assign(element.dataset, value);
    } else if (typeof value === 'string' || typeof value === 'number') {
      element.setAttribute(key, String(value));
    }
  }

  if (typeof children === 'string') {
    element.textContent = children;
  } else if (Array.isArray(children)) {
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    });
  }

  return element;
}
