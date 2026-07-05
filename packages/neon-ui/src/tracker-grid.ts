/**
 * Neon UI Kit - Tracker Grid Component (v2)
 *
 * Classic multi-channel tracker grid for Neon Studio. Unlike the legacy
 * tracker component this grid is PASSIVE: it has no clock. The app drives
 * the playhead from its transport via setPlayhead(row) (typically polling
 * transport.getPositionAt(ctx.currentTime) in a rAF loop).
 *
 * Channels have typed columns:
 *  - kind 'note': cells are MIDI note numbers (displayed C-4), sustained
 *    notes as [note, durationSteps] with dim continuation markers
 *  - kind 'drum': one column per lane; cells are velocity codes
 *    (1 hit, 2 accent) displayed as glyphs
 *
 * Keyboard entry is bound to the grid element itself (tabindex=0) — never
 * to document — so typing in inputs elsewhere can never write notes. The
 * FastTracker two-row mapping uses e.code and therefore survives non-QWERTY
 * layouts.
 */

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .neon-tgrid-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      min-height: 0;
    }

    .neon-tgrid-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .neon-tgrid-label {
      font-size: 0.6em;
      font-weight: 900;
      letter-spacing: 3px;
      color: #bf5fff;
      text-shadow: 0 0 8px rgba(191,95,255,0.5);
    }

    .neon-tgrid-status {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 0.6em;
      font-weight: 900;
      letter-spacing: 1px;
    }

    .neon-tgrid-chip {
      color: #00ffff;
      background: rgba(0,255,255,0.08);
      border: 1px solid rgba(0,255,255,0.25);
      border-radius: 3px;
      padding: 3px 8px;
    }

    .neon-tgrid-armed {
      color: #0d0018;
      background: #00ffff;
      border-radius: 3px;
      padding: 3px 8px;
      letter-spacing: 2px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .neon-tgrid-armed.on {
      opacity: 1;
      box-shadow: 0 0 12px rgba(0,255,255,0.6);
    }

    .neon-tgrid-scroll {
      flex: 1;
      overflow: auto;
      background: rgba(0,0,0,0.35);
      border: 1px solid rgba(191,95,255,0.2);
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.72em;
      min-height: 150px;
      outline: none;
    }
    .neon-tgrid-scroll:focus {
      border-color: #00ffff;
      box-shadow: 0 0 18px rgba(0,255,255,0.25), inset 0 0 12px rgba(0,255,255,0.06);
    }
    .neon-tgrid-scroll::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    .neon-tgrid-scroll::-webkit-scrollbar-track {
      background: rgba(0,0,0,0.3);
    }
    .neon-tgrid-scroll::-webkit-scrollbar-thumb {
      background: rgba(191,95,255,0.5);
      border-radius: 4px;
    }

    .neon-tgrid-headrow {
      display: flex;
      position: sticky;
      top: 0;
      background: linear-gradient(180deg, #1a0033 0%, #0d0018 100%);
      border-bottom: 1px solid rgba(191,95,255,0.3);
      z-index: 10;
      width: max-content;
      min-width: 100%;
    }

    .neon-tgrid-rownum-head,
    .neon-tgrid-rownum {
      width: 30px;
      padding: 3px 4px;
      text-align: center;
      color: rgba(191,95,255,0.5);
      font-weight: 900;
      flex-shrink: 0;
      position: sticky;
      left: 0;
      background: #12002455;
      backdrop-filter: blur(2px);
    }

    .neon-tgrid-chhead {
      display: flex;
      flex-direction: column;
      border-left: 1px solid rgba(191,95,255,0.25);
      cursor: pointer;
      transition: background 0.15s;
    }
    .neon-tgrid-chhead:hover {
      background: rgba(191,95,255,0.08);
    }
    .neon-tgrid-chhead.selected .neon-tgrid-chname {
      color: #ff00ff;
      text-shadow: 0 0 10px #ff00ff;
    }
    .neon-tgrid-chhead.ai-focus {
      background: rgba(0,255,255,0.12);
    }

    .neon-tgrid-chname {
      padding: 4px 8px 2px;
      text-align: center;
      color: #bf5fff;
      font-weight: 900;
      letter-spacing: 1px;
    }

    .neon-tgrid-collabels {
      display: flex;
    }

    .neon-tgrid-collabel {
      text-align: center;
      color: rgba(0,255,255,0.5);
      font-weight: 900;
      font-size: 0.85em;
      padding: 1px 0 3px;
    }

    .neon-tgrid-row {
      display: flex;
      width: max-content;
      min-width: 100%;
    }
    .neon-tgrid-row.beat {
      background: rgba(191,95,255,0.05);
    }
    .neon-tgrid-row.playing {
      background: rgba(0,255,255,0.14);
    }
    .neon-tgrid-row.playing .neon-tgrid-rownum {
      color: #00ffff;
      text-shadow: 0 0 8px #00ffff;
    }

    .neon-tgrid-chcells {
      display: flex;
      border-left: 1px solid rgba(191,95,255,0.15);
    }
    .neon-tgrid-chcells.ai-focus {
      background: rgba(0,255,255,0.08);
    }

    .neon-tgrid-cell {
      padding: 3px 2px;
      text-align: center;
      color: rgba(255,255,255,0.85);
      white-space: pre;
      cursor: pointer;
      border-left: 1px solid rgba(191,95,255,0.06);
      transition: background 0.1s;
    }
    .neon-tgrid-cell.empty {
      color: rgba(191,95,255,0.25);
    }
    .neon-tgrid-cell.cont {
      color: rgba(0,255,255,0.4);
    }
    .neon-tgrid-cell.accent {
      color: #ff00ff;
      text-shadow: 0 0 8px rgba(255,0,255,0.7);
      font-weight: 900;
    }
    .neon-tgrid-cell.vel-lo {
      color: rgba(255,255,255,0.45);
    }
    .neon-tgrid-cell.cursor {
      outline: 1px solid #00ffff;
      outline-offset: -1px;
      background: rgba(0,255,255,0.15);
    }
    .neon-tgrid-cell.flash {
      animation: neon-tgrid-flash 0.35s ease-out;
    }

    @keyframes neon-tgrid-flash {
      0% { background: rgba(0,255,255,0.7); }
      100% { background: transparent; }
    }

    .neon-tgrid-wrapper.disabled {
      opacity: 0.5;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

/**
 * rest | value | [value, durationSteps] | [value, durationSteps, velocity]
 * The optional third element is a 1-127 velocity for note channels.
 */
export type TrackerCell = null | number | [number, number] | [number, number, number];

export interface TrackerGridChannel {
  id: string;
  name: string;
  kind: 'note' | 'drum';
  /** note: polyphony columns; drum: lanes count (= noteLabels.length) */
  columns: number;
  /** drum lane short labels, e.g. ['BD','SD','LT',...] */
  noteLabels?: string[];
}

export interface TrackerGridOptions {
  label?: string;
  steps?: number;
  channels?: TrackerGridChannel[];
  data?: Record<string, TrackerCell[][]>;
  baseOctave?: number;
  editStep?: number;
  rowsPerBeat?: number;
  onCellChange?: (channelId: string, col: number, row: number, cell: TrackerCell) => void;
  onChannelSelect?: (channelId: string) => void;
  onCursorMove?: (channelId: string, col: number, row: number) => void;
  /** Preview a note as it is entered (note channels: MIDI; drum: lane idx). */
  onAudition?: (channelId: string, note: number) => void;
  onOctaveChange?: (octave: number) => void;
}

export interface TrackerGridComponent {
  element: HTMLElement;
  focus(): void;
  readonly steps: number;
  readonly baseOctave: number;
  readonly cursor: { channelId: string | null; col: number; row: number };
  setChannels(channels: TrackerGridChannel[]): void;
  setPattern(data: Record<string, TrackerCell[][]>, steps: number): void;
  getPattern(): Record<string, TrackerCell[][]>;
  setCell(channelId: string, col: number, row: number, cell: TrackerCell): void;
  setCursor(channelId: string, col: number, row: number): void;
  selectChannel(channelId: string): void;
  setBaseOctave(octave: number): void;
  /** Shared entry path for computer keyboard AND on-screen piano. */
  enterNoteAtCursor(note: number): void;
  setPlayhead(row: number | null): void;
  setFollowPlayhead(enabled: boolean): void;
  flashCell(channelId: string, col: number, row: number): void;
  setChannelFocus(channelId: string, focused: boolean): void;
  setDisabled(disabled: boolean): void;
  destroy(): void;
}

const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];

/** FastTracker II two-row mapping, physical-key based. */
const NOTE_KEY_OFFSETS: Record<string, number> = {
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7,
  KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11, Comma: 12, KeyL: 13, Period: 14,
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18,
  KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25,
  KeyO: 26, Digit0: 27, KeyP: 28
};

function noteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${octave}`;
}

export function createTrackerGrid(options: TrackerGridOptions = {}): TrackerGridComponent {
  injectStyles();

  let steps = options.steps ?? 16;
  let channels: TrackerGridChannel[] = options.channels ?? [];
  let data: Record<string, TrackerCell[][]> = options.data ?? {};
  let baseOctave = options.baseOctave ?? 4;
  let editStep = options.editStep ?? 1;
  const rowsPerBeat = options.rowsPerBeat ?? 4;

  let cursor = { chIdx: channels.length ? 0 : -1, col: 0, row: 0 };
  let playheadRow: number | null = null;
  let followPlayhead = true;
  let selectedChannelIdx = channels.length ? 0 : -1;

  // element refs for cell patching
  let cellEls: HTMLElement[][][] = []; // [chIdx][col][row]
  let rowEls: HTMLElement[] = [];
  let chHeadEls: HTMLElement[] = [];
  let chCellGroupEls: HTMLElement[][] = []; // [chIdx][row]

  const wrapper = document.createElement('div');
  wrapper.className = 'neon-tgrid-wrapper';

  const header = document.createElement('div');
  header.className = 'neon-tgrid-header';
  const label = document.createElement('div');
  label.className = 'neon-tgrid-label';
  label.textContent = options.label ?? 'TRACKER';
  const status = document.createElement('div');
  status.className = 'neon-tgrid-status';
  const octChip = document.createElement('span');
  octChip.className = 'neon-tgrid-chip';
  const stepChip = document.createElement('span');
  stepChip.className = 'neon-tgrid-chip';
  const lenChip = document.createElement('span');
  lenChip.className = 'neon-tgrid-chip';
  const armed = document.createElement('span');
  armed.className = 'neon-tgrid-armed';
  armed.textContent = 'ARMED';
  status.append(octChip, stepChip, lenChip, armed);
  header.append(label, status);

  const scroll = document.createElement('div');
  scroll.className = 'neon-tgrid-scroll';
  scroll.tabIndex = 0;

  wrapper.append(header, scroll);

  function updateChips(): void {
    octChip.textContent = `OCT ${baseOctave}`;
    stepChip.textContent = `STEP ${editStep}`;
    lenChip.textContent = `LEN ${steps}`;
  }

  function ensureChannelData(ch: TrackerGridChannel): TrackerCell[][] {
    let cells = data[ch.id];
    if (!cells) {
      cells = Array.from({ length: ch.columns }, () =>
        Array.from({ length: steps }, () => null as TrackerCell)
      );
      data[ch.id] = cells;
    }
    // normalize shape defensively (pattern length or column changes)
    while (cells.length < ch.columns) {
      cells.push(Array.from({ length: steps }, () => null as TrackerCell));
    }
    for (const col of cells) {
      while (col.length < steps) col.push(null);
    }
    return cells;
  }

  function colWidth(ch: TrackerGridChannel): number {
    return ch.kind === 'note' ? 52 : 26;
  }

  function cellText(ch: TrackerGridChannel, col: number, row: number): { text: string; cls: string } {
    const cells = ensureChannelData(ch);
    const cell = cells[col][row];

    // continuation marker: a sustained note covers this row
    if (cell === null) {
      for (let r = row - 1; r >= 0; r--) {
        const above = cells[col][r];
        if (above === null) continue;
        const dur = Array.isArray(above) ? above[1] : 1;
        if (r + dur > row) return { text: ch.kind === 'note' ? ' | ' : '·', cls: 'cont' };
        break;
      }
      return { text: ch.kind === 'note' ? '···' : '·', cls: 'empty' };
    }

    const value = Array.isArray(cell) ? cell[0] : cell;
    const dur = Array.isArray(cell) ? cell[1] : 1;
    const vel = Array.isArray(cell) && cell.length > 2 ? cell[2] : undefined;

    if (ch.kind === 'drum') {
      return value >= 2 ? { text: '▮', cls: 'accent' } : { text: '▸', cls: '' };
    }
    let cls = '';
    if (vel !== undefined && vel >= 112) cls = 'accent';
    else if (vel !== undefined && vel < 64) cls = 'vel-lo';
    const durSuffix = dur > 1 ? String(Math.min(dur, 99)).padStart(2, '0') : '';
    return { text: durSuffix ? `${noteName(value)} ${durSuffix}` : noteName(value), cls };
  }

  function render(): void {
    scroll.innerHTML = '';
    cellEls = channels.map(ch => Array.from({ length: ch.columns }, () => [] as HTMLElement[]));
    rowEls = [];
    chHeadEls = [];
    chCellGroupEls = channels.map(() => []);

    // header row
    const headRow = document.createElement('div');
    headRow.className = 'neon-tgrid-headrow';
    const numHead = document.createElement('div');
    numHead.className = 'neon-tgrid-rownum-head';
    numHead.textContent = '##';
    headRow.appendChild(numHead);

    channels.forEach((ch, chIdx) => {
      const chHead = document.createElement('div');
      chHead.className = 'neon-tgrid-chhead' + (chIdx === selectedChannelIdx ? ' selected' : '');
      chHead.style.width = `${colWidth(ch) * ch.columns}px`;
      const name = document.createElement('div');
      name.className = 'neon-tgrid-chname';
      name.textContent = ch.name;
      chHead.appendChild(name);
      const colLabels = document.createElement('div');
      colLabels.className = 'neon-tgrid-collabels';
      for (let c = 0; c < ch.columns; c++) {
        const cl = document.createElement('div');
        cl.className = 'neon-tgrid-collabel';
        cl.style.width = `${colWidth(ch)}px`;
        cl.textContent = ch.kind === 'drum' ? (ch.noteLabels?.[c] ?? String(c + 1)) : String(c + 1);
        colLabels.appendChild(cl);
      }
      chHead.appendChild(colLabels);
      chHead.addEventListener('click', () => selectChannel(ch.id));
      chHeadEls.push(chHead);
      headRow.appendChild(chHead);
    });
    scroll.appendChild(headRow);

    // body rows
    for (let row = 0; row < steps; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'neon-tgrid-row' + (row % rowsPerBeat === 0 ? ' beat' : '');
      const num = document.createElement('div');
      num.className = 'neon-tgrid-rownum';
      num.textContent = row.toString(16).toUpperCase().padStart(2, '0');
      rowEl.appendChild(num);

      channels.forEach((ch, chIdx) => {
        const group = document.createElement('div');
        group.className = 'neon-tgrid-chcells';
        for (let col = 0; col < ch.columns; col++) {
          const cellEl = document.createElement('div');
          cellEl.className = 'neon-tgrid-cell';
          cellEl.style.width = `${colWidth(ch)}px`;
          paintCell(cellEl, ch, col, row);
          cellEl.addEventListener('mousedown', e => {
            e.preventDefault();
            scroll.focus();
            moveCursor(chIdx, col, row);
            if (e.button === 2) return;
            if (ch.kind === 'drum' && e.button === 0 && e.detail >= 1) {
              // single click on drum cells cycles (matches the drums app culture)
              cycleDrumCell(chIdx, col, row);
            }
          });
          cellEl.addEventListener('contextmenu', e => {
            e.preventDefault();
            moveCursor(chIdx, col, row);
            writeCell(chIdx, col, row, null);
          });
          cellEls[chIdx][col][row] = cellEl;
          group.appendChild(cellEl);
        }
        chCellGroupEls[chIdx][row] = group;
        rowEl.appendChild(group);
      });
      rowEls.push(rowEl);
      scroll.appendChild(rowEl);
    }

    applyCursorClass();
    if (playheadRow !== null && rowEls[playheadRow]) {
      rowEls[playheadRow].classList.add('playing');
    }
    updateChips();
  }

  function paintCell(el: HTMLElement, ch: TrackerGridChannel, col: number, row: number): void {
    const { text, cls } = cellText(ch, col, row);
    el.textContent = text;
    el.className = `neon-tgrid-cell${cls ? ' ' + cls : ''}`;
    el.style.width = `${colWidth(ch)}px`;
  }

  /** Repaint a column from `row` downward until past any sustain influence. */
  function repaintColumnFrom(chIdx: number, col: number, row: number): void {
    const ch = channels[chIdx];
    for (let r = Math.max(0, row); r < steps; r++) {
      const el = cellEls[chIdx]?.[col]?.[r];
      if (el) paintCell(el, ch, col, r);
    }
    applyCursorClass();
  }

  function applyCursorClass(): void {
    scroll.querySelectorAll('.neon-tgrid-cell.cursor').forEach(el => el.classList.remove('cursor'));
    const el = cellEls[cursor.chIdx]?.[cursor.col]?.[cursor.row];
    el?.classList.add('cursor');
  }

  function moveCursor(chIdx: number, col: number, row: number): void {
    if (!channels.length) return;
    chIdx = Math.max(0, Math.min(channels.length - 1, chIdx));
    col = Math.max(0, Math.min(channels[chIdx].columns - 1, col));
    row = ((row % steps) + steps) % steps;
    cursor = { chIdx, col, row };
    if (selectedChannelIdx !== chIdx) {
      selectedChannelIdx = chIdx;
      chHeadEls.forEach((el, i) => el.classList.toggle('selected', i === chIdx));
      options.onChannelSelect?.(channels[chIdx].id);
    }
    applyCursorClass();
    options.onCursorMove?.(channels[chIdx].id, col, row);
    cellEls[chIdx]?.[cursor.col]?.[cursor.row]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function writeCell(chIdx: number, col: number, row: number, cell: TrackerCell): void {
    const ch = channels[chIdx];
    if (!ch) return;
    const cells = ensureChannelData(ch);
    cells[col][row] = cell;
    repaintColumnFrom(chIdx, col, row);
    options.onCellChange?.(ch.id, col, row, cell);
  }

  function advanceCursor(): void {
    moveCursor(cursor.chIdx, cursor.col, cursor.row + editStep);
  }

  function cycleDrumCell(chIdx: number, col: number, row: number): void {
    const ch = channels[chIdx];
    const cells = ensureChannelData(ch);
    const current = cells[col][row];
    const value = current === null ? null : (Array.isArray(current) ? current[0] : current);
    const next: TrackerCell = value === null ? 1 : value === 1 ? 2 : null;
    writeCell(chIdx, col, row, next);
    if (next !== null) options.onAudition?.(ch.id, col);
  }

  function enterNote(note: number): void {
    const ch = channels[cursor.chIdx];
    if (!ch) return;
    if (ch.kind === 'drum') {
      cycleDrumCell(cursor.chIdx, cursor.col, cursor.row);
      advanceCursor();
      return;
    }
    writeCell(cursor.chIdx, cursor.col, cursor.row, note);
    options.onAudition?.(ch.id, note);
    advanceCursor();
  }

  function adjustDuration(delta: number): void {
    const ch = channels[cursor.chIdx];
    if (!ch || ch.kind === 'drum') return;
    const cells = ensureChannelData(ch);
    const cell = cells[cursor.col][cursor.row];
    if (cell === null) return;
    const value = Array.isArray(cell) ? cell[0] : cell;
    const dur = Array.isArray(cell) ? cell[1] : 1;
    const vel = Array.isArray(cell) && cell.length > 2 ? cell[2] : undefined;
    const next = Math.max(1, Math.min(steps - cursor.row, dur + delta));
    const out: TrackerCell = vel !== undefined
      ? [value, next, vel]
      : (next === 1 ? value : [value, next]);
    writeCell(cursor.chIdx, cursor.col, cursor.row, out);
  }

  /** Alt+Up/Down: note channels adjust 1-127 velocity; drums toggle accent. */
  function adjustVelocity(delta: number): void {
    const ch = channels[cursor.chIdx];
    if (!ch) return;
    const cells = ensureChannelData(ch);
    const cell = cells[cursor.col][cursor.row];
    if (cell === null) return;
    const value = Array.isArray(cell) ? cell[0] : cell;
    const dur = Array.isArray(cell) ? cell[1] : 1;

    if (ch.kind === 'drum') {
      writeCell(cursor.chIdx, cursor.col, cursor.row, value >= 2 ? 1 : 2);
      return;
    }
    const vel = (Array.isArray(cell) && cell.length > 2 ? cell[2] : undefined) ?? 100;
    const next = Math.max(16, Math.min(127, vel + delta));
    writeCell(cursor.chIdx, cursor.col, cursor.row, [value, dur, next]);
  }

  function handleKeyDown(e: KeyboardEvent): void {
    const ch = channels[cursor.chIdx];
    if (!ch) return;

    // navigation
    switch (e.code) {
      case 'ArrowUp':
        if (e.altKey) { adjustVelocity(16); }
        else if (e.shiftKey) { adjustDuration(-1); }
        else { moveCursor(cursor.chIdx, cursor.col, cursor.row - 1); }
        e.preventDefault();
        return;
      case 'ArrowDown':
        if (e.altKey) { adjustVelocity(-16); }
        else if (e.shiftKey) { adjustDuration(1); }
        else { moveCursor(cursor.chIdx, cursor.col, cursor.row + 1); }
        e.preventDefault();
        return;
      case 'ArrowLeft': {
        if (cursor.col > 0) moveCursor(cursor.chIdx, cursor.col - 1, cursor.row);
        else if (cursor.chIdx > 0) {
          const prev = channels[cursor.chIdx - 1];
          moveCursor(cursor.chIdx - 1, prev.columns - 1, cursor.row);
        }
        e.preventDefault();
        return;
      }
      case 'ArrowRight': {
        if (cursor.col < ch.columns - 1) moveCursor(cursor.chIdx, cursor.col + 1, cursor.row);
        else if (cursor.chIdx < channels.length - 1) moveCursor(cursor.chIdx + 1, 0, cursor.row);
        e.preventDefault();
        return;
      }
      case 'Tab':
        moveCursor(cursor.chIdx + (e.shiftKey ? -1 : 1), 0, cursor.row);
        e.preventDefault();
        return;
      case 'PageUp':
        moveCursor(cursor.chIdx, cursor.col, Math.max(0, cursor.row - 16));
        e.preventDefault();
        return;
      case 'PageDown':
        moveCursor(cursor.chIdx, cursor.col, Math.min(steps - 1, cursor.row + 16));
        e.preventDefault();
        return;
      case 'Home':
        moveCursor(cursor.chIdx, cursor.col, 0);
        e.preventDefault();
        return;
      case 'End':
        moveCursor(cursor.chIdx, cursor.col, steps - 1);
        e.preventDefault();
        return;
      case 'Delete':
      case 'Backspace':
        writeCell(cursor.chIdx, cursor.col, cursor.row, null);
        advanceCursor();
        e.preventDefault();
        return;
      case 'Escape':
        scroll.blur();
        e.preventDefault();
        return;
      case 'Minus':
        setBaseOctave(baseOctave - 1);
        e.preventDefault();
        return;
      case 'Equal':
        setBaseOctave(baseOctave + 1);
        e.preventDefault();
        return;
      case 'BracketLeft':
        editStep = Math.max(0, editStep - 1);
        updateChips();
        e.preventDefault();
        return;
      case 'BracketRight':
        editStep = Math.min(8, editStep + 1);
        updateChips();
        e.preventDefault();
        return;
    }

    // note entry (ignore with modifier keys held — those are app shortcuts)
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const offset = NOTE_KEY_OFFSETS[e.code];
    if (offset !== undefined) {
      enterNote((baseOctave + 1) * 12 + offset);
      e.preventDefault();
    }
  }

  function selectChannel(channelId: string): void {
    const idx = channels.findIndex(c => c.id === channelId);
    if (idx < 0) return;
    moveCursor(idx, 0, cursor.row);
  }

  function setBaseOctave(octave: number): void {
    baseOctave = Math.max(0, Math.min(8, octave));
    updateChips();
    options.onOctaveChange?.(baseOctave);
  }

  scroll.addEventListener('keydown', handleKeyDown);
  scroll.addEventListener('focus', () => armed.classList.add('on'));
  scroll.addEventListener('blur', () => armed.classList.remove('on'));

  render();

  const component: TrackerGridComponent = {
    element: wrapper,
    focus: () => scroll.focus(),
    get steps() {
      return steps;
    },
    get baseOctave() {
      return baseOctave;
    },
    get cursor() {
      return {
        channelId: channels[cursor.chIdx]?.id ?? null,
        col: cursor.col,
        row: cursor.row
      };
    },
    setChannels(next) {
      channels = next;
      cursor = { chIdx: channels.length ? 0 : -1, col: 0, row: 0 };
      selectedChannelIdx = channels.length ? 0 : -1;
      render();
    },
    setPattern(next, nextSteps) {
      data = next;
      steps = nextSteps;
      cursor = { ...cursor, row: Math.min(cursor.row, steps - 1) };
      render();
    },
    getPattern() {
      const out: Record<string, TrackerCell[][]> = {};
      for (const ch of channels) {
        out[ch.id] = ensureChannelData(ch).map(col => [...col]);
      }
      return out;
    },
    setCell(channelId, col, row, cell) {
      const chIdx = channels.findIndex(c => c.id === channelId);
      if (chIdx < 0) return;
      const cells = ensureChannelData(channels[chIdx]);
      if (col < 0 || col >= cells.length || row < 0 || row >= steps) return;
      cells[col][row] = cell;
      repaintColumnFrom(chIdx, col, row);
    },
    setCursor(channelId, col, row) {
      const chIdx = channels.findIndex(c => c.id === channelId);
      if (chIdx >= 0) moveCursor(chIdx, col, row);
    },
    selectChannel,
    setBaseOctave,
    enterNoteAtCursor(note) {
      enterNote(note);
    },
    setPlayhead(row) {
      if (playheadRow !== null && rowEls[playheadRow]) {
        rowEls[playheadRow].classList.remove('playing');
      }
      playheadRow = row;
      if (row !== null && rowEls[row]) {
        rowEls[row].classList.add('playing');
        if (followPlayhead) {
          rowEls[row].scrollIntoView({ block: 'nearest' });
        }
      }
    },
    setFollowPlayhead(enabled) {
      followPlayhead = enabled;
    },
    flashCell(channelId, col, row) {
      const chIdx = channels.findIndex(c => c.id === channelId);
      const el = cellEls[chIdx]?.[col]?.[row];
      if (!el) return;
      el.classList.remove('flash');
      // restart the animation
      void el.offsetWidth;
      el.classList.add('flash');
    },
    setChannelFocus(channelId, focused) {
      const chIdx = channels.findIndex(c => c.id === channelId);
      if (chIdx < 0) return;
      chHeadEls[chIdx]?.classList.toggle('ai-focus', focused);
      chCellGroupEls[chIdx]?.forEach(el => el.classList.toggle('ai-focus', focused));
    },
    setDisabled(disabled) {
      wrapper.classList.toggle('disabled', disabled);
    },
    destroy() {
      wrapper.remove();
    }
  };

  return component;
}
