/**
 * Neon UI Kit - Toast Component
 * Notification toast messages with CSS-in-JS
 */

import type { ToastType, ToastResult } from './types';

let stylesInjected = false;
let containerEl: HTMLElement | null = null;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .neon-toast-container {
      position: fixed;
      bottom: 25px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    }
    .neon-toast {
      background: linear-gradient(180deg, rgba(13,0,24,0.98) 0%, rgba(5,0,10,0.98) 100%);
      color: #fff;
      padding: 14px 24px;
      border-radius: 6px;
      font-size: 0.9em;
      font-weight: 900;
      letter-spacing: 1px;
      border-left: 4px solid #00ffff;
      box-shadow: 0 5px 30px rgba(0,0,0,0.6), 0 0 30px rgba(0,255,255,0.2);
      min-width: 280px;
      max-width: 90vw;
      display: flex;
      justify-content: space-between;
      align-items: center;
      pointer-events: auto;
      animation: neon-toast-in 0.3s cubic-bezier(0.175,0.885,0.32,1.275) forwards;
    }
    .neon-toast.error {
      border-left-color: #ff3366;
      color: #ffcccc;
      box-shadow: 0 5px 30px rgba(0,0,0,0.6), 0 0 30px rgba(255,51,102,0.2);
    }
    .neon-toast.info {
      border-left-color: #bf5fff;
      color: #bf5fff;
      box-shadow: 0 5px 30px rgba(0,0,0,0.6), 0 0 30px rgba(191,95,255,0.2);
    }
    .neon-toast.success {
      border-left-color: #39ff14;
      color: #39ff14;
      box-shadow: 0 5px 30px rgba(0,0,0,0.6), 0 0 30px rgba(57,255,20,0.2);
    }
    .neon-toast.warning {
      border-left-color: #ffff00;
      color: #ffff00;
      box-shadow: 0 5px 30px rgba(0,0,0,0.6), 0 0 30px rgba(255,255,0,0.2);
    }
    .neon-toast.ai {
      border-left-color: #00ffcc;
      color: #00ffcc;
      box-shadow: 0 5px 30px rgba(0,0,0,0.6), 0 0 30px rgba(0,255,204,0.3);
      background: linear-gradient(180deg, rgba(0,20,20,0.98) 0%, rgba(0,10,15,0.98) 100%);
    }
    .neon-toast.ai .toast-icon {
      margin-right: 10px;
      font-size: 1.1em;
    }
    @keyframes neon-toast-in {
      from { opacity: 0; transform: translateY(30px) scale(0.9); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes neon-toast-out {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.9); }
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

function getContainer(): HTMLElement {
  if (containerEl && document.body.contains(containerEl)) {
    return containerEl;
  }
  containerEl = document.createElement('div');
  containerEl.className = 'neon-toast-container';
  document.body.appendChild(containerEl);
  return containerEl;
}

/**
 * Show a toast notification
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  duration: number = 4000
): ToastResult {
  injectStyles();

  const container = getContainer();
  const toast = document.createElement('div');
  toast.className = `neon-toast ${type}`;

  // Add robot icon for AI toasts
  const icon = type === 'ai' ? '<span class="toast-icon">🤖</span>' : '';
  toast.innerHTML = `${icon}<span>${message}</span>`;
  container.appendChild(toast);

  let dismissed = false;

  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    toast.style.animation = 'neon-toast-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  };

  const timeoutId = setTimeout(dismiss, duration);

  return {
    dismiss: () => {
      clearTimeout(timeoutId);
      dismiss();
    }
  };
}

export interface ConfigureToastOptions {
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

/**
 * Configure toast defaults
 */
export function configureToast(options: ConfigureToastOptions = {}): void {
  injectStyles();

  const { position = 'bottom-center' } = options;
  const container = getContainer();

  // Reset positioning
  container.style.top = '';
  container.style.bottom = '';
  container.style.left = '';
  container.style.right = '';
  container.style.transform = '';

  const positions: Record<string, Partial<CSSStyleDeclaration>> = {
    'top-left': { top: '25px', left: '25px' },
    'top-center': { top: '25px', left: '50%', transform: 'translateX(-50%)' },
    'top-right': { top: '25px', right: '25px' },
    'bottom-left': { bottom: '25px', left: '25px' },
    'bottom-center': { bottom: '25px', left: '50%', transform: 'translateX(-50%)' },
    'bottom-right': { bottom: '25px', right: '25px' }
  };

  const pos = positions[position] || positions['bottom-center'];
  Object.assign(container.style, pos);
}
