/**
 * @neon/cloud Playground
 * Cloud utilities demonstration
 */

import {
  diffState,
  hasChanges,
  generateSimpleCommitMessage,
  timeAgo,
  createDiffConfig
} from '@neon/cloud';

// State management
interface AppState {
  bpm: number;
  volume: number;
  tracks: string[];
  effects: Record<string, boolean>;
}

let currentState: AppState = {
  bpm: 120,
  volume: 80,
  tracks: ['kick', 'snare'],
  effects: {
    reverb: true,
    delay: false
  }
};

let previousState: AppState = JSON.parse(JSON.stringify(currentState));
let stateHistory: Array<{ timestamp: Date; description: string }> = [];

// Create diff config for our state structure
const diffConfig = createDiffConfig({
  scalarFields: ['bpm', 'volume'],
  objectFields: ['effects'],
  arrayFields: ['tracks']
});

function updateStateDisplay(): void {
  const stateEl = document.getElementById('current-state');
  const historyEl = document.getElementById('state-history');

  if (stateEl) {
    stateEl.textContent = JSON.stringify(currentState, null, 2);
  }

  if (historyEl) {
    const recentHistory = stateHistory.slice(-5).reverse();
    historyEl.textContent = recentHistory.map(h =>
      `${timeAgo(h.timestamp)}: ${h.description}`
    ).join('\n') || '(no changes yet)';
  }
}

function recordChange(description: string): void {
  previousState = JSON.parse(JSON.stringify(currentState));
  stateHistory.push({
    timestamp: new Date(),
    description
  });
  updateStateDisplay();
}

// Initialize state display
updateStateDisplay();

// ============ DIFF UTILITIES ============

document.getElementById('compute-diff')?.addEventListener('click', () => {
  const oldTextarea = document.getElementById('diff-old') as HTMLTextAreaElement;
  const newTextarea = document.getElementById('diff-new') as HTMLTextAreaElement;
  const output = document.getElementById('diff-output');

  try {
    const oldObj = JSON.parse(oldTextarea.value) as Record<string, unknown>;
    const newObj = JSON.parse(newTextarea.value) as Record<string, unknown>;

    const diff = diffState(oldObj, newObj, diffConfig);

    if (output) {
      output.innerHTML = '';
      const pre = document.createElement('pre');

      if (!diff.hasChanges) {
        pre.textContent = 'No differences found.';
        pre.className = 'diff-unchanged';
      } else {
        // Display summary
        if (diff.summary.length > 0) {
          const header = document.createElement('div');
          header.style.color = 'var(--accent)';
          header.style.marginBottom = '8px';
          header.textContent = '=== Change Summary ===';
          pre.appendChild(header);

          diff.summary.forEach((line: string) => {
            const div = document.createElement('div');
            div.className = line.startsWith('+') ? 'diff-add' :
                           line.startsWith('-') ? 'diff-remove' : 'diff-unchanged';
            div.textContent = line;
            pre.appendChild(div);
          });
        }

        // Display scalar changes
        const scalarKeys = Object.keys(diff.scalar);
        if (scalarKeys.length > 0) {
          const header = document.createElement('div');
          header.style.color = 'var(--accent)';
          header.style.margin = '12px 0 8px 0';
          header.textContent = '=== Value Changes ===';
          pre.appendChild(header);

          scalarKeys.forEach((key: string) => {
            const change = diff.scalar[key];
            const line = document.createElement('div');
            line.className = 'diff-remove';
            line.textContent = `- ${key}: ${JSON.stringify(change.prev)}`;
            pre.appendChild(line);

            const addLine = document.createElement('div');
            addLine.className = 'diff-add';
            addLine.textContent = `+ ${key}: ${JSON.stringify(change.curr)}`;
            pre.appendChild(addLine);
          });
        }
      }

      output.appendChild(pre);
    }
  } catch (e) {
    if (output) {
      output.innerHTML = `<div style="color: var(--red)">Error parsing JSON: ${(e as Error).message}</div>`;
    }
  }
});

document.getElementById('format-diff')?.addEventListener('click', () => {
  const oldTextarea = document.getElementById('diff-old') as HTMLTextAreaElement;
  const newTextarea = document.getElementById('diff-new') as HTMLTextAreaElement;
  const output = document.getElementById('diff-output');

  try {
    const oldObj = JSON.parse(oldTextarea.value) as Record<string, unknown>;
    const newObj = JSON.parse(newTextarea.value) as Record<string, unknown>;

    const diff = diffState(oldObj, newObj, diffConfig);

    if (output) {
      const scalarCount = Object.keys(diff.scalar).length;
      const objectCount = Object.keys(diff.objects).length;
      const arrayCount = Object.keys(diff.arrays).length;

      const html = `
        <div style="font-family: monospace; font-size: 0.85em;">
          <div style="color: var(--cyan); margin-bottom: 8px;">
            <strong>Summary:</strong> ${scalarCount} value changes,
            ${objectCount} object changes,
            ${arrayCount} array changes
          </div>
          <div style="color: var(--text-dim);">
            Has changes: <span style="color: ${diff.hasChanges ? 'var(--green)' : 'var(--text-dim)'}">
              ${diff.hasChanges ? 'Yes' : 'No'}
            </span>
          </div>
          <div style="margin-top: 12px;">
            ${diff.summary.map((s: string) => `<div>${s}</div>`).join('')}
          </div>
        </div>
      `;
      output.innerHTML = html;
    }
  } catch (e) {
    if (output) {
      output.innerHTML = `<div style="color: var(--red)">Error parsing JSON: ${(e as Error).message}</div>`;
    }
  }
});

// ============ COMMIT MESSAGE GENERATOR ============

document.getElementById('generate-commit')?.addEventListener('click', async () => {
  const oldTextarea = document.getElementById('diff-old') as HTMLTextAreaElement;
  const newTextarea = document.getElementById('diff-new') as HTMLTextAreaElement;
  const output = document.getElementById('commit-output');

  try {
    const oldObj = JSON.parse(oldTextarea.value) as Record<string, unknown>;
    const newObj = JSON.parse(newTextarea.value) as Record<string, unknown>;

    const diff = diffState(oldObj, newObj, diffConfig);
    const message = generateSimpleCommitMessage(diff, oldObj, newObj);

    if (output) {
      output.innerHTML = `
        <div class="commit-message">${message}</div>
        <div class="commit-body">
          <strong>Changes detected:</strong><br>
          ${diff.summary.map((s: string) => `• ${s}`).join('<br>') || 'No changes'}
        </div>
        <div style="margin-top: 12px; font-size: 0.75em; color: var(--text-dim)">
          Generated by @neon/cloud commit generator
        </div>
      `;
    }
  } catch (e) {
    if (output) {
      output.innerHTML = `<div style="color: var(--red)">Error: ${(e as Error).message}</div>`;
    }
  }
});

// ============ STATE SIMULATION ============

document.getElementById('state-change-bpm')?.addEventListener('click', () => {
  const oldBpm = currentState.bpm;
  currentState.bpm = Math.floor(Math.random() * 80) + 80; // 80-160 BPM
  recordChange(`Changed BPM: ${oldBpm} → ${currentState.bpm}`);
});

document.getElementById('state-add-track')?.addEventListener('click', () => {
  const trackNames = ['kick', 'snare', 'hihat', 'clap', 'tom', 'cymbal', 'perc', 'bass'];
  const available = trackNames.filter(t => !currentState.tracks.includes(t));
  if (available.length > 0) {
    const newTrack = available[Math.floor(Math.random() * available.length)];
    currentState.tracks.push(newTrack);
    recordChange(`Added track: ${newTrack}`);
  } else {
    recordChange('All tracks already added');
  }
});

document.getElementById('state-toggle-fx')?.addEventListener('click', () => {
  const fxNames = ['reverb', 'delay', 'filter', 'chorus', 'distortion'];
  const fx = fxNames[Math.floor(Math.random() * fxNames.length)];
  currentState.effects[fx] = !currentState.effects[fx];
  recordChange(`Toggled ${fx}: ${currentState.effects[fx] ? 'ON' : 'OFF'}`);
});

document.getElementById('state-reset')?.addEventListener('click', () => {
  currentState = {
    bpm: 120,
    volume: 80,
    tracks: ['kick', 'snare'],
    effects: {
      reverb: true,
      delay: false
    }
  };
  previousState = JSON.parse(JSON.stringify(currentState));
  stateHistory = [];
  recordChange('State reset to defaults');
});

console.log('@neon/cloud Playground loaded');
