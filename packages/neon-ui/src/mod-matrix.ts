/**
 * Neon UI Kit - Mod Matrix Component
 *
 * Dead-simple modulation routing for a channel: up to `maxRoutes` rows of
 * source -> target -> depth. Sources are the channel's LFOs/mod envelope;
 * targets are resolved parameter addresses supplied by the rack
 * ('inst.cutoff', 'fx0.mix', 'channel.gain', ...).
 */

import { createKnob } from './knob';
import type { KnobComponent } from './types';

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .neon-modmx-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .neon-modmx-label {
      font-size: 0.6em;
      font-weight: 900;
      letter-spacing: 3px;
      color: #bf5fff;
      text-shadow: 0 0 8px rgba(191,95,255,0.5);
    }

    .neon-modmx-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(191,95,255,0.15);
      border-radius: 5px;
    }

    .neon-modmx-select {
      background: rgba(0,0,0,0.45);
      border: 1px solid rgba(0,255,255,0.3);
      border-radius: 4px;
      color: #00ffff;
      font-family: inherit;
      font-weight: 900;
      font-size: 0.6em;
      letter-spacing: 1px;
      padding: 4px;
    }
    .neon-modmx-select.source { width: 68px; }
    .neon-modmx-select.target { flex: 1; }

    .neon-modmx-arrow {
      color: #ff00ff;
      font-weight: 900;
      font-size: 0.7em;
    }

    .neon-modmx-row .neon-knob {
      transform: scale(0.7);
      transform-origin: center;
      margin: -10px -8px;
    }

    .neon-modmx-remove {
      background: none;
      border: 1px solid rgba(255,51,85,0.5);
      border-radius: 3px;
      color: #ff3355;
      font-weight: 900;
      font-size: 0.6em;
      width: 20px;
      height: 20px;
      cursor: pointer;
    }

    .neon-modmx-add {
      background: rgba(57,255,20,0.06);
      border: 1px dashed rgba(57,255,20,0.4);
      border-radius: 4px;
      color: #39ff14;
      font-family: inherit;
      font-weight: 900;
      font-size: 0.6em;
      letter-spacing: 2px;
      padding: 6px;
      cursor: pointer;
    }
    .neon-modmx-add:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .neon-modmx-empty {
      font-size: 0.65em;
      color: rgba(191,95,255,0.5);
      font-weight: 900;
      letter-spacing: 1px;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

export interface ModMatrixRoute {
  source: string;
  target: string;
  /** -1..1 */
  depth: number;
}

export interface ModMatrixOptions {
  label?: string;
  sources: Array<{ id: string; name: string }>;
  /** Grouped for <optgroup>: INSTRUMENT / FX / MIX */
  targets: Array<{ id: string; name: string; group: string }>;
  routes?: ModMatrixRoute[];
  maxRoutes?: number;
  onChange?: (routes: ModMatrixRoute[]) => void;
}

export interface ModMatrixComponent {
  element: HTMLElement;
  getRoutes(): ModMatrixRoute[];
  setRoutes(routes: ModMatrixRoute[]): void;
  setTargets(targets: ModMatrixOptions['targets']): void;
  destroy(): void;
}

export function createModMatrix(options: ModMatrixOptions): ModMatrixComponent {
  injectStyles();

  let routes: ModMatrixRoute[] = [...(options.routes ?? [])];
  let targets = [...options.targets];
  const maxRoutes = options.maxRoutes ?? 8;
  let knobs: KnobComponent[] = [];

  const wrapper = document.createElement('div');
  wrapper.className = 'neon-modmx-wrapper';

  const label = document.createElement('div');
  label.className = 'neon-modmx-label';
  label.textContent = options.label ?? 'MOD MATRIX';

  const rows = document.createElement('div');
  rows.className = 'neon-modmx-wrapper';

  const addBtn = document.createElement('button');
  addBtn.className = 'neon-modmx-add';
  addBtn.textContent = '+ ROUTE';
  addBtn.addEventListener('click', () => {
    if (routes.length >= maxRoutes || !targets.length) return;
    routes.push({
      source: options.sources[0]?.id ?? 'lfo1',
      target: targets[0].id,
      depth: 0.3
    });
    render();
    emit();
  });

  wrapper.append(label, rows, addBtn);

  function emit(): void {
    options.onChange?.(routes.map(r => ({ ...r })));
  }

  function buildTargetSelect(route: ModMatrixRoute): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'neon-modmx-select target';
    const groups = new Map<string, HTMLOptGroupElement>();
    for (const t of targets) {
      let group = groups.get(t.group);
      if (!group) {
        group = document.createElement('optgroup');
        group.label = t.group;
        groups.set(t.group, group);
        select.appendChild(group);
      }
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      opt.selected = t.id === route.target;
      group.appendChild(opt);
    }
    return select;
  }

  function render(): void {
    knobs.forEach(k => k.destroy());
    knobs = [];
    rows.innerHTML = '';

    if (!routes.length) {
      const empty = document.createElement('div');
      empty.className = 'neon-modmx-empty';
      empty.textContent = 'NO MODULATION';
      rows.appendChild(empty);
    }

    routes.forEach((route, index) => {
      const row = document.createElement('div');
      row.className = 'neon-modmx-row';

      const source = document.createElement('select');
      source.className = 'neon-modmx-select source';
      for (const s of options.sources) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        opt.selected = s.id === route.source;
        source.appendChild(opt);
      }
      source.addEventListener('change', () => {
        route.source = source.value;
        emit();
      });

      const arrow = document.createElement('span');
      arrow.className = 'neon-modmx-arrow';
      arrow.textContent = '➜';

      const target = buildTargetSelect(route);
      target.addEventListener('change', () => {
        route.target = target.value;
        emit();
      });

      const depth = createKnob({
        label: 'DEPTH',
        value: Math.round(route.depth * 50) + 50,
        min: 0,
        max: 100,
        onChange: v => {
          route.depth = (v - 50) / 50;
          emit();
        }
      });
      knobs.push(depth);

      const remove = document.createElement('button');
      remove.className = 'neon-modmx-remove';
      remove.textContent = '✕';
      remove.addEventListener('click', () => {
        routes.splice(index, 1);
        render();
        emit();
      });

      row.append(source, arrow, target, depth.element, remove);
      rows.appendChild(row);
    });

    addBtn.disabled = routes.length >= maxRoutes;
  }

  render();

  return {
    element: wrapper,
    getRoutes: () => routes.map(r => ({ ...r })),
    setRoutes(next) {
      routes = [...next];
      render();
    },
    setTargets(next) {
      targets = [...next];
      // drop routes whose target no longer exists (FX slot changed)
      routes = routes.filter(r => targets.some(t => t.id === r.target));
      render();
      emit();
    },
    destroy() {
      knobs.forEach(k => k.destroy());
      wrapper.remove();
    }
  };
}
