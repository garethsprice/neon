/**
 * Neon UI Kit - Order List Component
 *
 * Song-order editor for Neon Studio: an ordered list of pattern references
 * (00 A, 01 A, 02 B ...) with add/duplicate/delete/reorder controls, a
 * playing-position glow, and a queued-position pulse for bar-boundary jumps.
 */

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .neon-olist-wrapper {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 0;
    }

    .neon-olist-label {
      font-size: 0.6em;
      font-weight: 900;
      letter-spacing: 3px;
      color: #bf5fff;
      text-shadow: 0 0 8px rgba(191,95,255,0.5);
    }

    .neon-olist-rows {
      overflow-y: auto;
      background: rgba(0,0,0,0.35);
      border: 1px solid rgba(191,95,255,0.2);
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.75em;
      min-height: 60px;
      max-height: 240px;
    }
    .neon-olist-rows::-webkit-scrollbar {
      width: 6px;
    }
    .neon-olist-rows::-webkit-scrollbar-thumb {
      background: rgba(191,95,255,0.5);
      border-radius: 3px;
    }

    .neon-olist-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 3px 8px;
      cursor: pointer;
      color: rgba(255,255,255,0.85);
      font-weight: 900;
      letter-spacing: 1px;
      transition: background 0.15s;
      border-left: 2px solid transparent;
    }
    .neon-olist-row:hover {
      background: rgba(191,95,255,0.1);
    }
    .neon-olist-row.selected {
      background: rgba(255,0,255,0.15);
      border-left-color: #ff00ff;
    }
    .neon-olist-row.playing {
      background: rgba(0,255,255,0.15);
      border-left-color: #00ffff;
    }
    .neon-olist-row.playing .neon-olist-pos {
      color: #00ffff;
      text-shadow: 0 0 8px #00ffff;
    }
    .neon-olist-row.queued .neon-olist-next {
      display: inline;
    }

    .neon-olist-pos {
      color: rgba(191,95,255,0.6);
      width: 22px;
    }

    .neon-olist-pattern {
      color: #fff;
      flex: 1;
    }

    .neon-olist-next {
      display: none;
      color: #ff00ff;
      font-size: 0.85em;
      letter-spacing: 0;
      animation: neon-olist-pulse 0.8s ease-in-out infinite;
    }

    @keyframes neon-olist-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .neon-olist-controls {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .neon-olist-btn {
      background: linear-gradient(180deg, #2a0044 0%, #1a0033 100%);
      color: #fff;
      border: 1px solid rgba(191,95,255,0.3);
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 900;
      font-size: 0.6em;
      letter-spacing: 1px;
      transition: all 0.2s;
    }
    .neon-olist-btn:hover {
      background: linear-gradient(180deg, #3a0066 0%, #2a0044 100%);
      box-shadow: 0 0 12px rgba(191,95,255,0.3);
    }
    .neon-olist-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

export interface OrderListOptions {
  label?: string;
  order?: string[];
  /** Pattern id appended by +ADD (the currently selected bank pattern). */
  getAddPatternId?: () => string;
  onChange?: (order: string[]) => void;
  /** Stopped/editing: show this position's pattern in the tracker. */
  onSelectPosition?: (pos: number) => void;
  /** Playing: request a queued jump at the next pattern boundary. */
  onQueuePosition?: (pos: number) => void;
  /** Ask the app whether the transport is running (routes row clicks). */
  isPlaying?: () => boolean;
}

export interface OrderListComponent {
  element: HTMLElement;
  getOrder(): string[];
  setOrder(order: string[]): void;
  setSelectedPosition(pos: number): void;
  setPlayingPosition(pos: number | null): void;
  setQueuedPosition(pos: number | null): void;
  destroy(): void;
}

export function createOrderList(options: OrderListOptions = {}): OrderListComponent {
  injectStyles();

  let order: string[] = [...(options.order ?? [])];
  let selected = order.length ? 0 : -1;
  let playing: number | null = null;
  let queued: number | null = null;
  let rowEls: HTMLElement[] = [];

  const wrapper = document.createElement('div');
  wrapper.className = 'neon-olist-wrapper';

  const label = document.createElement('div');
  label.className = 'neon-olist-label';
  label.textContent = options.label ?? 'SONG';

  const rows = document.createElement('div');
  rows.className = 'neon-olist-rows';

  const controls = document.createElement('div');
  controls.className = 'neon-olist-controls';

  function makeButton(text: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'neon-olist-btn';
    btn.textContent = text;
    btn.title = title;
    btn.addEventListener('click', onClick);
    return btn;
  }

  const addBtn = makeButton('+ADD', 'Append the selected pattern', () => {
    const id = options.getAddPatternId?.() ?? order[selected] ?? 'A';
    order.push(id);
    selected = order.length - 1;
    render();
    emitChange();
  });
  const dupBtn = makeButton('DUP', 'Duplicate the selected position', () => {
    if (selected < 0) return;
    order.splice(selected + 1, 0, order[selected]);
    selected++;
    render();
    emitChange();
  });
  const delBtn = makeButton('✕', 'Delete the selected position', () => {
    if (selected < 0 || order.length <= 1) return;
    order.splice(selected, 1);
    selected = Math.min(selected, order.length - 1);
    render();
    emitChange();
  });
  const upBtn = makeButton('↑', 'Move the selected position up', () => {
    if (selected <= 0) return;
    [order[selected - 1], order[selected]] = [order[selected], order[selected - 1]];
    selected--;
    render();
    emitChange();
  });
  const downBtn = makeButton('↓', 'Move the selected position down', () => {
    if (selected < 0 || selected >= order.length - 1) return;
    [order[selected + 1], order[selected]] = [order[selected], order[selected + 1]];
    selected++;
    render();
    emitChange();
  });

  controls.append(addBtn, dupBtn, delBtn, upBtn, downBtn);
  wrapper.append(label, rows, controls);

  function emitChange(): void {
    options.onChange?.([...order]);
  }

  function render(): void {
    rows.innerHTML = '';
    rowEls = [];
    order.forEach((patternId, pos) => {
      const row = document.createElement('div');
      row.className = 'neon-olist-row';
      if (pos === selected) row.classList.add('selected');
      if (pos === playing) row.classList.add('playing');
      if (pos === queued) row.classList.add('queued');

      const posEl = document.createElement('span');
      posEl.className = 'neon-olist-pos';
      posEl.textContent = pos.toString(16).toUpperCase().padStart(2, '0');
      const patEl = document.createElement('span');
      patEl.className = 'neon-olist-pattern';
      patEl.textContent = patternId;
      const nextEl = document.createElement('span');
      nextEl.className = 'neon-olist-next';
      nextEl.textContent = 'NEXT>';

      row.append(posEl, patEl, nextEl);
      row.addEventListener('click', () => {
        selected = pos;
        render();
        if (options.isPlaying?.()) {
          options.onQueuePosition?.(pos);
        } else {
          options.onSelectPosition?.(pos);
        }
      });
      rowEls.push(row);
      rows.appendChild(row);
    });
    delBtn.disabled = order.length <= 1;
  }

  render();

  return {
    element: wrapper,
    getOrder: () => [...order],
    setOrder(next) {
      order = [...next];
      selected = Math.min(Math.max(selected, 0), order.length - 1);
      render();
    },
    setSelectedPosition(pos) {
      if (pos < 0 || pos >= order.length) return;
      selected = pos;
      render();
    },
    setPlayingPosition(pos) {
      playing = pos;
      queued = pos === queued ? null : queued;
      render();
      if (pos !== null && rowEls[pos]) {
        rowEls[pos].scrollIntoView({ block: 'nearest' });
      }
    },
    setQueuedPosition(pos) {
      queued = pos;
      render();
    },
    destroy() {
      wrapper.remove();
    }
  };
}
