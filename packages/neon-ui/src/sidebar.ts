/**
 * Neon UI Kit - Sidebar Component
 * Slide-out sidebar panel
 */

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .neon-sidebar {
      position: fixed;
      top: 0;
      right: -320px;
      width: 320px;
      height: 100vh;
      background: linear-gradient(180deg, #0d0018 0%, #05000a 100%);
      border-left: 2px solid #ff00ff;
      box-shadow: -20px 0 60px rgba(255,0,255,0.3), 0 0 100px rgba(0,0,0,0.8);
      padding: 15px;
      z-index: 2000;
      transition: right 0.4s cubic-bezier(0.165,0.84,0.44,1);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .neon-sidebar.open { right: 0; }

    /* Position variants */
    .neon-sidebar.position-left {
      right: auto;
      left: -320px;
      border-left: none;
      border-right: 2px solid #ff00ff;
      box-shadow: 20px 0 60px rgba(255,0,255,0.3), 0 0 100px rgba(0,0,0,0.8);
    }
    .neon-sidebar.position-left.open { left: 0; }

    /* Color variants */
    .neon-sidebar.color-cyan {
      border-color: #00ffff;
      box-shadow: -20px 0 60px rgba(0,255,255,0.3), 0 0 100px rgba(0,0,0,0.8);
    }
    .neon-sidebar.color-green {
      border-color: #39ff14;
      box-shadow: -20px 0 60px rgba(57,255,20,0.3), 0 0 100px rgba(0,0,0,0.8);
    }
    .neon-sidebar.color-purple {
      border-color: #bf5fff;
      box-shadow: -20px 0 60px rgba(191,95,255,0.3), 0 0 100px rgba(0,0,0,0.8);
    }

    /* Close button row */
    .neon-sidebar-close-row {
      display: flex;
      justify-content: flex-end;
      margin-bottom: -10px;
      position: relative;
      z-index: 10;
    }
    .neon-sidebar-close {
      background: rgba(191,95,255,0.08);
      border: 1px solid rgba(191,95,255,0.2);
      color: rgba(191,95,255,0.6);
      cursor: pointer;
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease-out;
      border-radius: 4px;
    }
    .neon-sidebar-close:hover {
      color: #00ffff;
      border-color: #00ffff;
      background: rgba(0,255,255,0.08);
      box-shadow: 0 0 20px rgba(0,255,255,0.3), inset 0 0 15px rgba(0,255,255,0.05);
    }
    .neon-sidebar-close svg {
      width: 18px;
      height: 18px;
      stroke-width: 2.5px;
    }

    /* Header */
    .neon-sidebar-header {
      font-size: 0.75em;
      font-weight: 900;
      background: linear-gradient(135deg, #00ffff, #ff00ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-align: center;
      margin-bottom: 8px;
      margin-top: -15px;
      padding-top: 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid;
      border-image: linear-gradient(135deg, #00ffff, #ff00ff) 1;
      letter-spacing: 3px;
      filter: drop-shadow(0 0 5px rgba(0,255,255,0.5));
    }

    /* Content area */
    .neon-sidebar-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    /* Backdrop overlay */
    .neon-sidebar-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    .neon-sidebar-backdrop.visible {
      opacity: 1;
      pointer-events: auto;
    }

    /* Mobile responsive */
    @media (max-width: 800px) {
      .neon-sidebar {
        width: 100%;
        right: -100%;
      }
      .neon-sidebar.position-left { left: -100%; }
    }

    /* AI Focus state */
    .neon-sidebar.ai-focus {
      border-color: #ff00ff !important;
      box-shadow: -30px 0 80px rgba(255,0,255,0.5) !important;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

/** Sidebar position options */
export type SidebarPosition = 'left' | 'right';

/** Sidebar color options */
export type SidebarColor = 'magenta' | 'cyan' | 'green' | 'purple';

/** Options for creating a sidebar */
export interface SidebarOptions {
  /** Header title */
  title?: string;
  /** Position: right, left */
  position?: SidebarPosition;
  /** Border color: magenta, cyan, green, purple */
  color?: SidebarColor;
  /** Show backdrop when open */
  showBackdrop?: boolean;
  /** Close when clicking backdrop */
  closeOnBackdrop?: boolean;
  /** Initial content */
  content?: HTMLElement | string | null;
  /** Called when sidebar opens */
  onOpen?: (() => void) | null;
  /** Called when sidebar closes */
  onClose?: (() => void) | null;
}

/** Sidebar component interface */
export interface SidebarComponent {
  /** The sidebar element */
  element: HTMLElement;
  /** The content container element */
  contentContainer: HTMLElement;
  /** Open the sidebar */
  open: () => void;
  /** Close the sidebar */
  close: () => void;
  /** Toggle the sidebar */
  toggle: () => void;
  /** Check if sidebar is open */
  isOpen: () => boolean;
  /** Set sidebar content */
  setContent: (content: HTMLElement | string | null) => void;
  /** Append a child to the content container */
  appendChild: (child: HTMLElement) => void;
  /** Set the sidebar title */
  setTitle: (title: string) => void;
  /** Set AI focus state */
  setFocus: (focused: boolean) => void;
  /** Destroy the sidebar and clean up */
  destroy: () => void;
}

/**
 * Create a slide-out sidebar
 */
export function createSidebar(options: SidebarOptions = {}): SidebarComponent {
  injectStyles();

  const {
    title = '',
    position = 'right',
    color = 'magenta',
    showBackdrop = true,
    closeOnBackdrop = true,
    content = null,
    onOpen = null,
    onClose = null
  } = options;

  let isOpen = false;

  // Create sidebar element
  const sidebar = document.createElement('div');
  sidebar.className = `neon-sidebar position-${position} color-${color}`;

  // Close button row
  const closeRow = document.createElement('div');
  closeRow.className = 'neon-sidebar-close-row';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'neon-sidebar-close';
  closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

  closeRow.appendChild(closeBtn);
  sidebar.appendChild(closeRow);

  // Header
  if (title) {
    const header = document.createElement('div');
    header.className = 'neon-sidebar-header';
    header.textContent = title;
    sidebar.appendChild(header);
  }

  // Content container
  const contentContainer = document.createElement('div');
  contentContainer.className = 'neon-sidebar-content';
  sidebar.appendChild(contentContainer);

  if (content) {
    if (typeof content === 'string') {
      contentContainer.innerHTML = content;
    } else {
      contentContainer.appendChild(content);
    }
  }

  // Backdrop
  let backdrop: HTMLElement | null = null;
  if (showBackdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'neon-sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  // Add sidebar to body
  document.body.appendChild(sidebar);

  const open = (): void => {
    if (isOpen) return;
    isOpen = true;
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('visible');
    onOpen?.();
  };

  const close = (): void => {
    if (!isOpen) return;
    isOpen = false;
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('visible');
    onClose?.();
  };

  const toggle = (): void => {
    if (isOpen) close();
    else open();
  };

  // Event handlers
  closeBtn.addEventListener('click', close);

  if (backdrop && closeOnBackdrop) {
    backdrop.addEventListener('click', close);
  }

  // Handle escape key
  const handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && isOpen) {
      close();
    }
  };
  document.addEventListener('keydown', handleKeydown);

  return {
    element: sidebar,
    contentContainer,
    open,
    close,
    toggle,
    isOpen: () => isOpen,
    setContent: (newContent: HTMLElement | string | null): void => {
      contentContainer.innerHTML = '';
      if (typeof newContent === 'string') {
        contentContainer.innerHTML = newContent;
      } else if (newContent) {
        contentContainer.appendChild(newContent);
      }
    },
    appendChild: (child: HTMLElement): void => {
      contentContainer.appendChild(child);
    },
    setTitle: (newTitle: string): void => {
      const header = sidebar.querySelector('.neon-sidebar-header');
      if (header) header.textContent = newTitle;
    },
    setFocus: (focused: boolean): void => {
      sidebar.classList.toggle('ai-focus', focused);
    },
    destroy: (): void => {
      closeBtn.removeEventListener('click', close);
      document.removeEventListener('keydown', handleKeydown);
      if (backdrop) {
        backdrop.removeEventListener('click', close);
        backdrop.remove();
      }
      sidebar.remove();
    }
  };
}
