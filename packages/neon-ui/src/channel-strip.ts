/**
 * Neon UI Kit - Channel Strip Component
 *
 * Compact rack card for one studio channel: name, instrument label, mini
 * gain/pan knobs, mute/solo LEDs, and an EDIT button opening the channel
 * drawer. The always-visible anchor for sound design.
 */

import { createKnob } from './knob';
import type { KnobComponent } from './types';

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .neon-chstrip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 10px;
      background: linear-gradient(180deg, #2a0044 0%, #1a0033 100%);
      border: 1px solid rgba(191,95,255,0.3);
      border-radius: 6px;
      flex-shrink: 0;
      cursor: pointer;
      transition: all 0.2s;
    }
    .neon-chstrip:hover {
      box-shadow: 0 0 12px rgba(191,95,255,0.3);
    }
    .neon-chstrip.selected {
      border-color: #ff00ff;
      box-shadow: 0 0 14px rgba(255,0,255,0.4);
    }
    .neon-chstrip.ai-focus {
      border-color: #00ffff;
      box-shadow: 0 0 16px rgba(0,255,255,0.5);
    }

    .neon-chstrip-names {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 62px;
    }

    .neon-chstrip-name {
      font-weight: 900;
      font-size: 0.65em;
      letter-spacing: 2px;
      color: #fff;
      white-space: nowrap;
    }

    .neon-chstrip-inst {
      font-size: 0.5em;
      font-weight: 900;
      letter-spacing: 1px;
      color: #bf5fff;
      white-space: nowrap;
    }

    .neon-chstrip-knobs {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .neon-chstrip-knobs .neon-knob {
      transform: scale(0.75);
      transform-origin: center;
      margin: -6px -4px;
    }

    .neon-chstrip-btns {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .neon-chstrip-led {
      background: none;
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 3px;
      color: rgba(255,255,255,0.6);
      font-family: inherit;
      font-size: 0.55em;
      font-weight: 900;
      padding: 3px 7px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .neon-chstrip-led.mute.on {
      background: #ff3355;
      border-color: #ff3355;
      color: #fff;
      box-shadow: 0 0 8px rgba(255,51,85,0.6);
    }
    .neon-chstrip-led.solo.on {
      background: #ffe14d;
      border-color: #ffe14d;
      color: #1a0033;
      box-shadow: 0 0 8px rgba(255,225,77,0.6);
    }

    .neon-chstrip-edit {
      background: rgba(0,255,255,0.08);
      border: 1px solid rgba(0,255,255,0.35);
      border-radius: 3px;
      color: #00ffff;
      font-family: inherit;
      font-size: 0.55em;
      font-weight: 900;
      letter-spacing: 1px;
      padding: 3px 8px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .neon-chstrip-edit:hover {
      box-shadow: 0 0 10px rgba(0,255,255,0.4);
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

export interface ChannelStripOptions {
  name: string;
  instrumentLabel: string;
  gain?: number;
  pan?: number;
  muted?: boolean;
  soloed?: boolean;
  onGain?: (value: number) => void;
  onPan?: (value: number) => void;
  onMute?: (muted: boolean) => void;
  onSolo?: (soloed: boolean) => void;
  onEdit?: () => void;
  onSelect?: () => void;
}

export interface ChannelStripComponent {
  element: HTMLElement;
  setName(name: string): void;
  setInstrumentLabel(label: string): void;
  setGain(value: number): void;
  setPan(value: number): void;
  setMuted(muted: boolean): void;
  setSoloed(soloed: boolean): void;
  setSelected(selected: boolean): void;
  setFocus(focused: boolean): void;
  destroy(): void;
}

export function createChannelStrip(options: ChannelStripOptions): ChannelStripComponent {
  injectStyles();

  let muted = options.muted ?? false;
  let soloed = options.soloed ?? false;

  const element = document.createElement('div');
  element.className = 'neon-chstrip';

  const names = document.createElement('div');
  names.className = 'neon-chstrip-names';
  const nameEl = document.createElement('span');
  nameEl.className = 'neon-chstrip-name';
  nameEl.textContent = options.name;
  const instEl = document.createElement('span');
  instEl.className = 'neon-chstrip-inst';
  instEl.textContent = options.instrumentLabel;
  names.append(nameEl, instEl);

  const knobs = document.createElement('div');
  knobs.className = 'neon-chstrip-knobs';
  const gainKnob: KnobComponent = createKnob({
    label: 'GAIN',
    value: Math.round((options.gain ?? 0.8) * 100),
    min: 0,
    max: 100,
    onChange: v => options.onGain?.(v / 100)
  });
  const panKnob: KnobComponent = createKnob({
    label: 'PAN',
    value: Math.round((options.pan ?? 0) * 50) + 50,
    min: 0,
    max: 100,
    onChange: v => options.onPan?.((v - 50) / 50)
  });
  knobs.append(gainKnob.element, panKnob.element);

  const btns = document.createElement('div');
  btns.className = 'neon-chstrip-btns';
  const muteBtn = document.createElement('button');
  muteBtn.className = 'neon-chstrip-led mute' + (muted ? ' on' : '');
  muteBtn.textContent = 'M';
  muteBtn.title = 'Mute';
  muteBtn.addEventListener('click', e => {
    e.stopPropagation();
    muted = !muted;
    muteBtn.classList.toggle('on', muted);
    options.onMute?.(muted);
  });
  const soloBtn = document.createElement('button');
  soloBtn.className = 'neon-chstrip-led solo' + (soloed ? ' on' : '');
  soloBtn.textContent = 'S';
  soloBtn.title = 'Solo';
  soloBtn.addEventListener('click', e => {
    e.stopPropagation();
    soloed = !soloed;
    soloBtn.classList.toggle('on', soloed);
    options.onSolo?.(soloed);
  });
  const editBtn = document.createElement('button');
  editBtn.className = 'neon-chstrip-edit';
  editBtn.textContent = 'EDIT';
  editBtn.addEventListener('click', e => {
    e.stopPropagation();
    options.onEdit?.();
  });
  btns.append(muteBtn, soloBtn, editBtn);

  element.append(names, knobs, btns);
  element.addEventListener('click', () => options.onSelect?.());

  return {
    element,
    setName: n => { nameEl.textContent = n; },
    setInstrumentLabel: l => { instEl.textContent = l; },
    setGain: v => gainKnob.setValue(Math.round(v * 100)),
    setPan: v => panKnob.setValue(Math.round(v * 50) + 50),
    setMuted: m => { muted = m; muteBtn.classList.toggle('on', m); },
    setSoloed: s => { soloed = s; soloBtn.classList.toggle('on', s); },
    setSelected: sel => element.classList.toggle('selected', sel),
    setFocus: f => element.classList.toggle('ai-focus', f),
    destroy: () => {
      gainKnob.destroy();
      panKnob.destroy();
      element.remove();
    }
  };
}
