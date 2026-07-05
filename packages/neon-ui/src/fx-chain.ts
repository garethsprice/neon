/**
 * Neon UI Kit - FX Chain Component
 *
 * Ordered, editable list of FX modules for a channel rack: each slot is a
 * createFxModule panel (toggle + knobs) with move-up/move-down/remove
 * controls, plus an add-plugin picker fed from the fx plugin registry
 * descriptors. Touch-safe buttons, no drag-and-drop.
 */

import { createFxModule, type FxModuleComponent } from './fx-module';

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .neon-fxchain-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .neon-fxchain-label {
      font-size: 0.6em;
      font-weight: 900;
      letter-spacing: 3px;
      color: #bf5fff;
      text-shadow: 0 0 8px rgba(191,95,255,0.5);
    }

    .neon-fxchain-slot {
      display: flex;
      gap: 6px;
      align-items: flex-start;
    }

    .neon-fxchain-slot > .neon-fx-module {
      flex: 1;
    }

    .neon-fxchain-slot-btns {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .neon-fxchain-btn {
      background: linear-gradient(180deg, #2a0044 0%, #1a0033 100%);
      color: #fff;
      border: 1px solid rgba(191,95,255,0.3);
      border-radius: 3px;
      width: 22px;
      height: 20px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 900;
      font-size: 0.6em;
      line-height: 1;
      transition: all 0.15s;
    }
    .neon-fxchain-btn:hover:not(:disabled) {
      box-shadow: 0 0 10px rgba(191,95,255,0.35);
    }
    .neon-fxchain-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .neon-fxchain-btn.remove {
      border-color: rgba(255,51,85,0.5);
      color: #ff3355;
    }

    .neon-fxchain-add {
      display: flex;
      gap: 6px;
    }

    .neon-fxchain-select {
      flex: 1;
      background: rgba(0,0,0,0.45);
      border: 1px solid rgba(0,255,255,0.3);
      border-radius: 4px;
      color: #00ffff;
      font-family: inherit;
      font-weight: 900;
      font-size: 0.65em;
      letter-spacing: 1px;
      padding: 5px;
    }

    .neon-fxchain-addbtn {
      background: linear-gradient(180deg, #103300 0%, #0a2000 100%);
      color: #39ff14;
      border: 1px solid rgba(57,255,20,0.4);
      border-radius: 4px;
      padding: 5px 12px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 900;
      font-size: 0.65em;
      letter-spacing: 1px;
    }
    .neon-fxchain-addbtn:hover {
      box-shadow: 0 0 12px rgba(57,255,20,0.35);
    }

    .neon-fxchain-empty {
      font-size: 0.65em;
      color: rgba(191,95,255,0.5);
      font-weight: 900;
      letter-spacing: 1px;
      padding: 6px 0;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

/** What the picker knows about an addable plugin (from the fx registry). */
export interface FxChainPluginDescriptor {
  id: string;
  name: string;
  params: Array<{ name: string; label?: string; min: number; max: number; default: number }>;
}

export interface FxChainSlotState {
  pluginId: string;
  enabled: boolean;
  params: Record<string, number>;
}

export interface FxChainOptions {
  label?: string;
  available: FxChainPluginDescriptor[];
  chain?: FxChainSlotState[];
  onAdd?: (pluginId: string) => void;
  onRemove?: (index: number) => void;
  onMove?: (from: number, to: number) => void;
  onParamChange?: (index: number, param: string, value: number) => void;
  onToggle?: (index: number, enabled: boolean) => void;
}

export interface FxChainComponent {
  element: HTMLElement;
  setChain(chain: FxChainSlotState[]): void;
  getSlotModule(index: number): FxModuleComponent | undefined;
  destroy(): void;
}

export function createFxChain(options: FxChainOptions): FxChainComponent {
  injectStyles();

  let chain: FxChainSlotState[] = [...(options.chain ?? [])];
  let slotModules: FxModuleComponent[] = [];

  const wrapper = document.createElement('div');
  wrapper.className = 'neon-fxchain-wrapper';

  const label = document.createElement('div');
  label.className = 'neon-fxchain-label';
  label.textContent = options.label ?? 'FX CHAIN';

  const slots = document.createElement('div');
  slots.className = 'neon-fxchain-wrapper';

  const addRow = document.createElement('div');
  addRow.className = 'neon-fxchain-add';
  const select = document.createElement('select');
  select.className = 'neon-fxchain-select';
  for (const desc of options.available) {
    const opt = document.createElement('option');
    opt.value = desc.id;
    opt.textContent = desc.name.toUpperCase();
    select.appendChild(opt);
  }
  const addBtn = document.createElement('button');
  addBtn.className = 'neon-fxchain-addbtn';
  addBtn.textContent = '+ FX';
  addBtn.addEventListener('click', () => {
    if (select.value) options.onAdd?.(select.value);
  });
  addRow.append(select, addBtn);

  wrapper.append(label, slots, addRow);

  function render(): void {
    slotModules.forEach(m => m.destroy());
    slotModules = [];
    slots.innerHTML = '';

    if (chain.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'neon-fxchain-empty';
      empty.textContent = 'NO FX — DRY SIGNAL';
      slots.appendChild(empty);
      return;
    }

    chain.forEach((slot, index) => {
      const desc = options.available.find(d => d.id === slot.pluginId);
      const slotEl = document.createElement('div');
      slotEl.className = 'neon-fxchain-slot';

      const module = createFxModule({
        name: desc?.name ?? slot.pluginId,
        enabled: slot.enabled,
        controls: (desc?.params ?? []).map(p => ({
          label: p.label ?? p.name,
          value: slot.params[p.name] ?? p.default,
          min: p.min,
          max: p.max,
          onChange: value => options.onParamChange?.(index, p.name, value)
        })),
        onToggle: enabled => options.onToggle?.(index, enabled)
      });
      slotModules.push(module);

      const btns = document.createElement('div');
      btns.className = 'neon-fxchain-slot-btns';
      const up = document.createElement('button');
      up.className = 'neon-fxchain-btn';
      up.textContent = '↑';
      up.disabled = index === 0;
      up.addEventListener('click', () => options.onMove?.(index, index - 1));
      const down = document.createElement('button');
      down.className = 'neon-fxchain-btn';
      down.textContent = '↓';
      down.disabled = index === chain.length - 1;
      down.addEventListener('click', () => options.onMove?.(index, index + 1));
      const remove = document.createElement('button');
      remove.className = 'neon-fxchain-btn remove';
      remove.textContent = '✕';
      remove.addEventListener('click', () => options.onRemove?.(index));
      btns.append(up, down, remove);

      slotEl.append(module.element, btns);
      slots.appendChild(slotEl);
    });
  }

  render();

  return {
    element: wrapper,
    setChain(next) {
      chain = [...next];
      render();
    },
    getSlotModule(index) {
      return slotModules[index];
    },
    destroy() {
      slotModules.forEach(m => m.destroy());
      wrapper.remove();
    }
  };
}
