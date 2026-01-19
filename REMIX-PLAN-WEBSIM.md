# Neon Apps Remix Simplification Plan

## Goal

Make neon apps as simple as possible for humans and LLMs to understand and remix on websim. Offload complexity to shared packages so app code focuses on what makes each app unique.

## Current State

| App | Total LOC | Files | Complexity |
|-----|-----------|-------|------------|
| neon-drums | 3,642 | 7 | High (sequencer, AI, visualizer) |
| neon-synth | 3,434 | 6 | High (1,491 LOC main.ts!) |
| neon-noise | 1,764 | 4 | Medium (cleanest) |
| **Total** | **8,840** | 17 | |

### Key Problems

1. **Cloud code is 87% duplicated** - 1,365 LOC across 3 apps doing the same thing
2. **AI handlers overlap 40%** - skill detection, thumbnails, briefs repeated
3. **Apps contain boilerplate** - feed rendering, pagination, history UI
4. **No standard app interface** - each app structures state differently
5. **Token-heavy for LLMs** - too much code to parse for simple remixes

## Target State

| App | Target LOC | Reduction | Focus |
|-----|------------|-----------|-------|
| neon-drums | ~1,800 | 50% | Sequencer + drum-specific logic only |
| neon-synth | ~1,600 | 53% | Synth voices + piano roll logic only |
| neon-noise | ~800 | 55% | Noise algorithms + vinyl only |
| **Total** | **~4,200** | **52%** | |

## Strategy: Extract to Packages

### Phase 1: Cloud UI Abstraction (Save ~900 LOC)

**Problem:** Each app reimplements feed rendering, pagination, history display.

**Solution:** Add to `@neon/cloud`:

```typescript
// New exports from @neon/cloud
import {
  createFeedUI,      // Handles feed rendering, pagination, filters
  createCloudApp,    // Wires up save/load/history with minimal config
  FeedRenderer,      // Low-level feed rendering
  HistoryManager     // History navigation UI
} from '@neon/cloud';

// App usage becomes:
const cloud = createCloudApp({
  room,
  audioContext: ctx,
  appType: 'drums',
  getState: () => sequencer.serialize(),
  setState: (data) => sequencer.deserialize(data),
  onLoad: () => updateUI(),
  feedContainer: '#project-feed',
  elements: { saveBtn, loadBtn, feedToggle, ... }
});
```

**Files to modify:**
- `packages/neon-cloud/src/feed-ui.ts` (NEW - 400 LOC)
- `packages/neon-cloud/src/cloud-app.ts` (NEW - 200 LOC)
- `apps/*/cloud.ts` → reduce to ~50 LOC config each

**Savings per app:** ~300 LOC

---

### Phase 2: AI Package (Save ~400 LOC)

**Problem:** AI generation, skill detection, thumbnails duplicated in drums/synth.

**Solution:** Create `@neon/ai` package or extend `@neon/cloud`:

```typescript
// New AI utilities
import {
  createAIGenerator,
  detectSkill,
  generateThumbnail,
  generateCreativeBrief,
  generateSuggestion
} from '@neon/cloud/ai';

// App usage:
const ai = createAIGenerator({
  appType: 'drums',
  prompts: drumsPrompts,
  getState: () => buildCurrentState(),
  applyState: (data) => applyGeneration(data),
  elements: { promptInput, genButton, ... }
});
```

**New exports:**
- `createAIGenerator()` - main orchestration
- `detectSkill()` - keyword + LLM hybrid detection
- `generateThumbnail()` - websim.imageGen wrapper
- `generateCreativeBrief()` - LLM brief generation
- `AIWalkthrough` - animated step-by-step application

**Savings per app:** ~200 LOC (drums/synth only)

---

### Phase 3: App Framework (Save ~300 LOC)

**Problem:** No standard interface for app state, making remixing harder.

**Solution:** Create `createNeonApp()` factory:

```typescript
// Standard app interface
interface NeonAppConfig {
  name: string;
  audioEngine: AudioEngine;

  // State management
  getState(): AppState;
  setState(state: Partial<AppState>): void;
  reset(): void;

  // UI bindings
  elements: Record<string, string>;  // CSS selectors
  setupUI(): void;

  // Optional features
  ai?: AIGeneratorConfig;
  cloud?: CloudAppConfig;
  visualizer?: VisualizerConfig;
}

// Minimal app becomes:
const app = createNeonApp({
  name: 'My Remix',
  audioEngine: new MyAudioEngine(ctx),
  getState: () => ({ /* my state */ }),
  setState: (s) => { /* apply state */ },
  elements: {
    playBtn: '#play',
    bpmKnob: '#bpm-knob',
    // ...
  },
  setupUI() {
    // App-specific UI logic only
  }
});

app.init();
```

---

### Phase 4: FX Utilities (Save ~200 LOC)

**Problem:** Parameter scaling, FX chain setup repeated.

**Solution:** Add to `@neon/fx`:

```typescript
// New FX utilities
import {
  createFXChain,      // Factory for common FX setups
  scaleParameter,     // 0-100 → Hz, ms, dB conversions
  FXPresets           // Common preset values
} from '@neon/fx';

// Usage:
const fx = createFXChain(ctx, masterGain, [
  { type: 'lowpass', params: { frequency: 2000, resonance: 0 } },
  { type: 'reverb', params: { mix: 30, decay: 2 } },
  { type: 'compressor', params: { threshold: -12, ratio: 4 } }
]);
```

**Move from apps:**
- Vinyl effect → `@neon/fx/vinyl` (348 LOC from neon-noise)
- Parameter scaling utilities

---

## Simplified App Structure

After refactoring, each app becomes:

```
apps/neon-drums/
├── index.html          # Minimal HTML shell
├── src/
│   ├── main.ts         # ~300 LOC - UI setup, event wiring
│   ├── sequencer.ts    # ~500 LOC - App-specific sequencing (keep as-is)
│   ├── audio-engine.ts # ~300 LOC - App-specific synthesis (keep as-is)
│   └── prompts.json    # AI prompts (move from code to JSON)
└── public/
    └── style.css
```

### Example: Simplified main.ts (~300 LOC)

```typescript
import { createNeonApp, createKnob, el } from '@neon/ui';
import { createCloudApp } from '@neon/cloud';
import { createAIGenerator } from '@neon/cloud/ai';
import { Sequencer } from './sequencer';
import { AudioEngine } from './audio-engine';
import prompts from './prompts.json';

// Initialize
const ctx = new AudioContext();
const engine = new AudioEngine(ctx);
const sequencer = new Sequencer(engine);

// Cloud integration (was 519 LOC, now ~10 LOC)
const cloud = createCloudApp({
  room: new WebsimSocket(),
  appType: 'drums',
  getState: () => sequencer.serialize(),
  setState: (d) => sequencer.deserialize(d),
  feedContainer: '#project-feed'
});

// AI integration (was 628 LOC, now ~15 LOC)
const ai = createAIGenerator({
  appType: 'drums',
  prompts,
  getState: () => sequencer.getCurrentState(),
  applyState: (d) => sequencer.applyAIGeneration(d),
  thumbnailPrompt: (state) => `${state.genre} drum machine pattern`
});

// UI setup - app-specific only
el('play-btn')?.addEventListener('click', () => sequencer.toggle());
createKnob('#bpm-knob', { min: 60, max: 180, value: 120,
  onChange: (v) => sequencer.setBPM(v)
});
// ... minimal UI wiring
```

---

## Token Optimization for LLMs

### Before (Current)
- Total tokens to understand drums app: ~15,000 tokens
- Duplicated patterns across apps
- Mixed concerns (UI + cloud + AI + audio)

### After (Target)
- Total tokens to understand drums app: ~6,000 tokens
- Clear separation: app code = unique logic only
- Packages are documented once, reused everywhere

### Key Simplifications

1. **Move config to JSON** - prompts, presets, defaults
2. **Declarative UI binding** - element selectors, not imperative code
3. **Standard interfaces** - predictable patterns for LLMs
4. **Inline documentation** - JSDoc for key functions

---

## Implementation Phases

### Phase 1: Cloud UI (Week 1)
- [ ] Create `@neon/cloud/feed-ui.ts`
- [ ] Create `@neon/cloud/cloud-app.ts`
- [ ] Refactor drums cloud.ts → 50 LOC
- [ ] Refactor synth cloud.ts → 50 LOC
- [ ] Refactor noise cloud.ts → 50 LOC
- [ ] Update tests

### Phase 2: AI Utilities (Week 2)
- [ ] Create `@neon/cloud/ai/` module
- [ ] Extract skill detection
- [ ] Extract thumbnail generation
- [ ] Extract walkthrough logic
- [ ] Refactor drums ai-handler.ts → 200 LOC
- [ ] Refactor synth ai-handler.ts → 150 LOC

### Phase 3: App Framework (Week 3)
- [ ] Design `NeonApp` interface
- [ ] Create `createNeonApp()` factory
- [ ] Refactor drums main.ts → 300 LOC
- [ ] Refactor synth main.ts → 400 LOC
- [ ] Refactor noise main.ts → 250 LOC

### Phase 4: FX & Polish (Week 4)
- [ ] Move vinyl effect to `@neon/fx`
- [ ] Add parameter scaling utilities
- [ ] Add FX chain factory
- [ ] Documentation for remixers
- [ ] Example "starter" app template

---

## Remix-Friendly Features

### 1. Starter Template
Create `apps/neon-starter/` as minimal example:
```
neon-starter/
├── index.html      # 50 lines
├── src/
│   ├── main.ts     # 100 lines - bare minimum
│   └── audio.ts    # 50 lines - basic oscillator
└── public/
    └── style.css   # Basic neon theme
```

### 2. Remix Documentation
Each app includes `REMIX.md`:
- What to keep (app-specific logic)
- What to change (UI, sounds, AI prompts)
- What packages provide (cloud, AI, FX, UI)

### 3. Modular Prompts
Move AI prompts to JSON for easy customization:
```json
{
  "system": "You are an AI drum pattern generator...",
  "skills": {
    "techno": { "keywords": ["techno", "berlin"], "augment": "..." }
  },
  "demo": "Generate a starter beat...",
  "improve": "Suggest how to improve: {{STATE}}"
}
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Total app LOC | 8,840 | 4,200 |
| Avg tokens per app | 12,000 | 5,000 |
| Time to understand app | 30 min | 10 min |
| Files per app | 6-7 | 3-4 |
| Duplicated code | 2,500 LOC | 0 |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking changes | Semantic versioning, migration guide |
| Package bloat | Tree-shaking, modular exports |
| Over-abstraction | Keep app-specific code in apps |
| Learning curve | Good docs, starter template |

---

## Summary

The core insight is that **70-90% of cloud/AI code is boilerplate** that should live in packages. Apps should contain only:

1. **Audio engine** - How sounds are made (unique per app)
2. **State logic** - How patterns/presets work (unique per app)
3. **UI wiring** - Connecting knobs to parameters (minimal)
4. **Config** - Prompts, presets, defaults (JSON)

Everything else (cloud sync, feed UI, AI generation, FX chains) should come from `@neon/*` packages with simple, declarative APIs.

This makes remixing straightforward:
- Copy an app
- Change the audio engine
- Adjust the prompts
- Customize the UI
- Ship it
