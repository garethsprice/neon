/**
 * NEON STUDIO - Main Application
 *
 * Modular rack + tracker composition studio. Channels (instrument modules
 * from @neon/instruments, racked by @neon/engine's ChannelRack) are
 * sequenced by a classic tracker (patterns + song order list) driven by the
 * lookahead Transport. The AI copilot generates patterns, arrangements, and
 * channel sound designs via the suite's websim gateway.
 */

import {
  createTrackerGrid,
  createOrderList,
  createPatternBank,
  createChannelStrip,
  createFxChain,
  createKnob,
  showToast,
  type TrackerGridChannel,
  type TrackerGridComponent,
  type OrderListComponent,
  type PatternBankComponent,
  type ChannelStripComponent,
  type FxChainComponent,
  type FxChainPluginDescriptor,
  type FxChainSlotState,
  createModMatrix,
  type ModMatrixComponent
} from '@neon/ui';
import type { PatternId as BankPatternId } from '@neon/ui';
import { pluginRegistry, type AudioPlugin } from '@neon/fx';
import {
  getAvailableInstruments,
  instrumentRegistry,
  PolySynth,
  type InstrumentDescriptor,
  type PolySynthWaveform
} from '@neon/instruments';
import {
  ChannelRack,
  ModEngine,
  Player,
  Transport,
  createChannelState,
  createDefaultProject,
  createEmptyPattern,
  ensurePatternChannel,
  prunePattern,
  type ChannelId,
  type ModRouteState,
  type PatternId,
  type PatternState,
  type ProjectState
} from '@neon/engine';
import { setupCloud } from './cloud';
import { requestGeneration, applyPatternResponse, type AIContext, type AICapability, type AIPatternResponse } from './ai-handler';

declare const WebsimSocket: new () => WebsimSocketInstance;

const LANE_SHORT: Record<string, string> = {
  bassDrum: 'BD', snareDrum: 'SD', lowTom: 'LT', midTom: 'MT', highTom: 'HT',
  rimshot: 'RS', handclap: 'CP', closedHiHat: 'CH', openHiHat: 'OH',
  crashCymbal: 'CR', rideCymbal: 'RD',
  white: 'WH', pink: 'PK', brown: 'BR', green: 'GR'
};

const INSTRUMENT_LABEL: Record<string, string> = {
  'tr909-kit': '909 KIT',
  'poly-synth': 'POLY SYNTH',
  'noise': 'NOISE'
};

/** Plugins offered in the FX chain picker (subset of the fx registry). */
const FX_PICKER_IDS = [
  'lowpass-filter', 'highpass-filter', 'saturation', 'distortion',
  'bitcrusher', 'compressor', 'phaser', 'flanger', 'delay', 'reverb'
];

const AI_MODES: Array<{ id: AICapability; label: string; placeholder: string }> = [
  { id: 'pattern', label: 'PATTERN', placeholder: "Describe a groove... e.g. 'dark warehouse techno with a rolling bassline'" },
  { id: 'sound', label: 'SOUND', placeholder: "Describe a sound... e.g. 'hollow acid bass with dub delay' (applies to channels)" },
  { id: 'arrange', label: 'SONG', placeholder: "Describe the arrangement... e.g. 'intro, long build, drop, breakdown, outro'" },
  { id: 'mix', label: 'MIX', placeholder: "Describe the balance... e.g. 'more punch on drums, tuck the lead back, wide pads'" }
];

interface AIMixResponse {
  channels?: Record<string, {
    gain?: number;
    pan?: number;
    sends?: { delay?: number; reverb?: number };
  }>;
  master?: { gain?: number };
  reasoning?: string[];
}

interface AISoundChannelPatch {
  instrumentId?: string;
  params?: Record<string, unknown>;
  fxChain?: Array<{ pluginId?: string; params?: Record<string, number> }>;
  mods?: Array<{ source?: string; target?: string; depth?: number }>;
}

interface AISoundResponse {
  channels?: Record<string, AISoundChannelPatch>;
  reasoning?: string[];
}

class StudioApp {
  private ctx: AudioContext;
  private rack: ChannelRack;
  private transport: Transport;
  private player: Player;
  private modEngine: ModEngine;

  private project: ProjectState = createDefaultProject();
  private currentPatternId: PatternId = 'A';
  private descriptors: InstrumentDescriptor[] = getAvailableInstruments();
  private pluginDescriptors: FxChainPluginDescriptor[] = [];
  private aiModeIdx = 0;

  private trackerGrid!: TrackerGridComponent;
  private orderList!: OrderListComponent;
  private patternBank!: PatternBankComponent;
  private cloud: ReturnType<typeof setupCloud> | null = null;
  private strips = new Map<ChannelId, ChannelStripComponent>();

  // channel drawer
  private drawer: HTMLElement | null = null;
  private drawerChannelId: ChannelId | null = null;
  private drawerFxChain: FxChainComponent | null = null;
  private drawerModMatrix: ModMatrixComponent | null = null;

  private playBtn = document.getElementById('play-btn') as HTMLButtonElement;
  private modeBtn = document.getElementById('mode-btn') as HTMLButtonElement;
  private bpmInput = document.getElementById('bpm-input') as HTMLInputElement;
  private swingInput = document.getElementById('swing-input') as HTMLInputElement;
  private positionDisplay = document.getElementById('position-display') as HTMLElement;
  private aiPrompt = document.getElementById('ai-prompt') as HTMLTextAreaElement;
  private aiGenerateBtn = document.getElementById('ai-generate-btn') as HTMLButtonElement;
  private aiComposeBtn = document.getElementById('ai-compose-btn') as HTMLButtonElement;
  private aiModeChip = document.getElementById('ai-mode-chip') as HTMLElement;
  private aiFeed = document.getElementById('ai-feed') as HTMLElement;
  private rackMount = document.getElementById('rack-mount') as HTMLElement;
  private stageBtn = document.getElementById('stage-btn') as HTMLButtonElement;
  private mixerMount = document.getElementById('mixer-mount') as HTMLElement;
  private trackerMount = document.getElementById('tracker-mount') as HTMLElement;
  private mixerVisible = false;

  constructor() {
    this.ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(
      { latencyHint: 'playback' } as AudioContextOptions
    );

    this.rack = new ChannelRack(this.ctx);
    this.transport = new Transport(this.ctx, {
      getPatternLength: id => this.project.patterns[id]?.length ?? 16,
      getSongOrder: () => this.project.songOrder
    });
    this.player = new Player(this.transport, {
      getPatternChannels: id => this.project.patterns[id]?.channels,
      getDispatch: () => this.rack.getDispatch()
    });
    this.modEngine = new ModEngine(this.ctx, this.rack, {
      getBpm: () => this.transport.bpm
    });
    this.player.onChannelTrigger = (chId, time) => this.modEngine.notifyTrigger(chId, time);
    // Kick-lane hits pump every channel with a non-zero DUCK amount.
    this.player.onKick = (chId, time) => this.rack.triggerDuck(chId, time);
  }

  async init(): Promise<void> {
    await this.loadPluginDescriptors();
    this.initTracker();
    this.initLeftRail();
    this.initTransportBar();
    this.initAiRail();
    this.initGlobalKeys();
    this.initCloud();

    await this.buildRackFromProject();
    this.renderRackStrip();
    this.startPlayheadLoop();
  }

  private async loadPluginDescriptors(): Promise<void> {
    this.pluginDescriptors = await Promise.all(
      FX_PICKER_IDS.map(async id => {
        const cls = (await pluginRegistry[id]()) as unknown as typeof AudioPlugin;
        return {
          id,
          name: cls.name,
          params: cls.parameterDefinitions.map(d => ({
            name: d.name, label: d.label, min: d.min, max: d.max, default: d.default
          }))
        };
      })
    );
  }

  // ---- audio/rack ----

  private async buildRackFromProject(): Promise<void> {
    this.closeDrawer();
    this.rack.removeAllChannels();
    for (const id of this.project.channelOrder) {
      const state = this.project.channels[id];
      if (state) {
        await this.rack.addChannel(id, state);
      }
    }
    this.rack.setMasterVolume(this.project.masterVolume);
    void Promise.all(
      this.rack.getDispatch().map(d =>
        d.instrument.load().catch((e: unknown) => {
          showToast(`Sample load failed: ${(e as Error).message}`, 'error');
        })
      )
    );
  }

  // ---- UI construction ----

  private gridChannels(): TrackerGridChannel[] {
    return this.project.channelOrder.map(id => {
      const ch = this.project.channels[id];
      const desc = this.descriptors.find(d => d.id === ch.instrument.id);
      const isLanes = desc?.noteMode === 'lanes';
      return {
        id,
        name: ch.name,
        kind: isLanes ? 'drum' as const : 'note' as const,
        columns: ch.columns,
        noteLabels: isLanes ? desc?.lanes?.map(l => LANE_SHORT[l] ?? l.slice(0, 2).toUpperCase()) : undefined
      };
    });
  }

  private currentPattern(): PatternState {
    let pattern = this.project.patterns[this.currentPatternId];
    if (!pattern) {
      pattern = createEmptyPattern(16);
      this.project.patterns[this.currentPatternId] = pattern;
    }
    return pattern;
  }

  private initTracker(): void {
    const pattern = this.currentPattern();
    this.trackerGrid = createTrackerGrid({
      label: 'TRACKER',
      steps: pattern.length,
      channels: this.gridChannels(),
      data: pattern.channels,
      baseOctave: 4,
      onCellChange: () => {
        this.patternBank.setPatternHasData(this.currentPatternId as BankPatternId, true);
      },
      onAudition: (channelId, note) => this.audition(channelId, note),
      onChannelSelect: () => this.updateStripSelection()
    });
    document.getElementById('tracker-mount')?.appendChild(this.trackerGrid.element);
  }

  private initLeftRail(): void {
    this.orderList = createOrderList({
      label: 'SONG',
      order: this.project.songOrder,
      getAddPatternId: () => this.currentPatternId,
      isPlaying: () => this.transport.isPlaying && this.transport.playMode === 'song',
      onChange: order => {
        this.project.songOrder = order as PatternId[];
      },
      onSelectPosition: pos => {
        const id = this.project.songOrder[pos];
        if (id) this.switchPattern(id as PatternId);
      },
      onQueuePosition: pos => {
        this.transport.queueSongPosition(pos);
        this.orderList.setQueuedPosition(pos);
      }
    });
    document.getElementById('order-list-mount')?.appendChild(this.orderList.element);

    this.patternBank = createPatternBank({
      label: 'PATTERNS',
      numSlots: 16,
      onSelect: id => {
        if (this.transport.isPlaying && this.transport.playMode === 'pattern') {
          this.transport.queuePattern(id);
          this.patternBank.setQueuedPattern(id);
        } else {
          this.switchPattern(id as PatternId);
        }
      }
    });
    document.getElementById('pattern-bank-mount')?.appendChild(this.patternBank.element);
    this.refreshPatternBankFlags();
  }

  private initTransportBar(): void {
    this.playBtn.addEventListener('click', () => this.togglePlay());
    this.modeBtn.addEventListener('click', () => this.togglePlayMode());
    this.stageBtn.addEventListener('click', () => this.toggleStage());

    this.bpmInput.value = String(this.project.bpm);
    this.bpmInput.addEventListener('change', () => {
      const bpm = parseInt(this.bpmInput.value, 10) || 120;
      this.transport.bpm = bpm;
      this.project.bpm = this.transport.bpm;
      this.bpmInput.value = String(this.transport.bpm);
    });

    this.swingInput.value = String(this.project.swing);
    this.swingInput.addEventListener('change', () => {
      const swing = parseInt(this.swingInput.value, 10) || 0;
      this.transport.swing = swing;
      this.project.swing = this.transport.swing;
      this.swingInput.value = String(this.transport.swing);
    });

    this.transport.bpm = this.project.bpm;
    this.transport.swing = this.project.swing;

    this.transport.onPlayStateChange = playing => {
      this.playBtn.classList.toggle('active', playing);
      this.playBtn.innerHTML = playing ? '&#9632; STOP' : '&#9654; PLAY';
      if (playing) {
        this.modEngine.start();
      } else {
        this.modEngine.stop();
        this.trackerGrid.setPlayhead(null);
        this.orderList.setPlayingPosition(null);
        this.orderList.setQueuedPosition(null);
        this.positionDisplay.textContent = '--';
      }
    };

    this.transport.onPatternChange = id => {
      if (this.currentPatternId !== id) {
        this.switchPattern(id as PatternId, { keepTransport: true });
      }
    };
  }

  private initAiRail(): void {
    this.aiGenerateBtn.addEventListener('click', () => void this.handleGenerate());
    this.aiComposeBtn.addEventListener('click', () => void this.handleCompose());
    this.aiPrompt.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        void this.handleGenerate();
      }
    });
    this.aiModeChip.style.cursor = 'pointer';
    this.aiModeChip.title = 'Click to cycle AI mode';
    this.aiModeChip.addEventListener('click', () => {
      this.aiModeIdx = (this.aiModeIdx + 1) % AI_MODES.length;
      const mode = AI_MODES[this.aiModeIdx];
      this.aiModeChip.textContent = mode.label;
      this.aiPrompt.placeholder = mode.placeholder;
    });
  }

  private initGlobalKeys(): void {
    document.addEventListener('keydown', e => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT';

      if (e.code === 'Escape' && this.drawer) {
        this.closeDrawer();
        return;
      }

      if (e.code === 'Space' && !inInput) {
        e.preventDefault();
        if (e.shiftKey) {
          this.togglePlayMode();
        } else {
          this.togglePlay();
        }
        return;
      }

      const fnMatch = e.code.match(/^F([1-8])$/);
      if (fnMatch && !inInput) {
        e.preventDefault();
        const id = 'ABCDEFGH'[parseInt(fnMatch[1], 10) - 1] as PatternId;
        if (this.transport.isPlaying && this.transport.playMode === 'pattern') {
          this.transport.queuePattern(id);
          this.patternBank.setQueuedPattern(id as BankPatternId);
        } else {
          this.switchPattern(id);
          this.patternBank.setActivePattern(id as BankPatternId);
        }
      }
    });
  }

  private initCloud(): void {
    try {
      const room = new WebsimSocket();
      this.cloud = setupCloud(room, {
        getState: () => this.serializeProject(),
        setState: state => void this.applyProject(state),
        renderAll: () => this.refreshAll(),
        visibility: 'public'
      });
    } catch (e) {
      console.warn('[studio] cloud unavailable:', e);
    }
  }

  // ---- transport actions ----

  private togglePlay(): void {
    void this.ctx.resume();
    this.transport.toggle();
  }

  private togglePlayMode(): void {
    const wasPlaying = this.transport.isPlaying;
    if (wasPlaying) this.transport.stop();
    this.transport.playMode = this.transport.playMode === 'pattern' ? 'song' : 'pattern';
    this.modeBtn.textContent = this.transport.playMode === 'pattern' ? 'PATT' : 'SONG';
    if (wasPlaying) this.transport.start();
  }

  private switchPattern(id: PatternId, opts: { keepTransport?: boolean } = {}): void {
    this.currentPatternId = id;
    if (!opts.keepTransport && !this.transport.isPlaying) {
      this.transport.queuePattern(id); // immediate when stopped
    }
    const pattern = this.currentPattern();
    this.trackerGrid.setPattern(pattern.channels, pattern.length);
    this.patternBank.setActivePattern(id as BankPatternId);
  }

  private audition(channelId: string, note: number): void {
    void this.ctx.resume();
    const ch = this.rack.getChannel(channelId);
    if (!ch) return;
    ch.instrument.trigger({
      time: this.ctx.currentTime + 0.01,
      note,
      velocity: 0.9,
      duration: 0.25
    });
  }

  // ---- playhead / position ----

  private startPlayheadLoop(): void {
    const loop = (): void => {
      if (this.transport.isPlaying) {
        const pos = this.transport.getPositionAt(this.ctx.currentTime);
        if (pos) {
          this.trackerGrid.setPlayhead(pos.patternId === this.currentPatternId ? pos.row : null);
          const rowHex = pos.row.toString(16).toUpperCase().padStart(2, '0');
          this.positionDisplay.textContent =
            pos.songPos !== null
              ? `${String(pos.songPos).padStart(2, '0')}·${pos.patternId}:${rowHex}`
              : `${pos.patternId}:${rowHex}`;
          this.orderList.setPlayingPosition(pos.songPos);
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---- mixer stage ----

  private toggleStage(): void {
    this.mixerVisible = !this.mixerVisible;
    this.trackerMount.style.display = this.mixerVisible ? 'none' : 'flex';
    this.mixerMount.style.display = this.mixerVisible ? 'flex' : 'none';
    this.stageBtn.textContent = this.mixerVisible ? 'TRACKER' : 'MIX';
    this.stageBtn.classList.toggle('active', this.mixerVisible);
    if (this.mixerVisible) {
      this.buildMixer();
    } else {
      this.renderRackStrip(); // pick up fader moves made in the mixer
    }
  }

  private buildMixer(): void {
    this.mixerMount.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'mixer-title';
    title.textContent = 'MIXER';
    this.mixerMount.appendChild(title);

    const row = document.createElement('div');
    row.className = 'mixer-row';

    const makeFader = (value: number, onInput: (v: number) => void): HTMLInputElement => {
      const fader = document.createElement('input');
      fader.type = 'range';
      fader.min = '0';
      fader.max = '100';
      fader.value = String(Math.round(value * 100));
      fader.className = 'mixer-fader';
      fader.addEventListener('input', () => onInput(parseInt(fader.value, 10) / 100));
      return fader;
    };

    for (const id of this.project.channelOrder) {
      const rackCh = this.rack.getChannel(id);
      if (!rackCh) continue;

      const strip = document.createElement('div');
      strip.className = 'mixer-strip';

      const name = document.createElement('div');
      name.className = 'mixer-name';
      name.textContent = rackCh.name;

      const fader = makeFader(rackCh.gain, v => {
        this.rack.setChannelGain(id, v);
        this.strips.get(id)?.setGain(v);
      });

      const knobs = document.createElement('div');
      knobs.className = 'mixer-knobs';
      const pan = createKnob({
        label: 'PAN',
        value: Math.round(rackCh.pan * 50) + 50,
        min: 0, max: 100,
        onChange: v => this.rack.setChannelPan(id, (v - 50) / 50)
      });
      const dl = createKnob({
        label: 'DL',
        value: Math.round(rackCh.sends.delay * 100),
        min: 0, max: 100,
        onChange: v => this.rack.setChannelSend(id, 'delay', v / 100)
      });
      const rv = createKnob({
        label: 'RV',
        value: Math.round(rackCh.sends.reverb * 100),
        min: 0, max: 100,
        onChange: v => this.rack.setChannelSend(id, 'reverb', v / 100)
      });
      knobs.append(pan.element, dl.element, rv.element);

      const mute = document.createElement('button');
      mute.className = 'mixer-mute' + (rackCh.mute ? ' on' : '');
      mute.textContent = 'M';
      mute.addEventListener('click', () => {
        const next = !(this.rack.getChannel(id)?.mute ?? false);
        this.rack.setChannelMute(id, next);
        mute.classList.toggle('on', next);
        this.strips.get(id)?.setMuted(next);
      });

      strip.append(name, fader, knobs, mute);
      row.appendChild(strip);
    }

    // master strip
    const master = document.createElement('div');
    master.className = 'mixer-strip master';
    const masterName = document.createElement('div');
    masterName.className = 'mixer-name';
    masterName.textContent = 'MASTER';
    const masterFader = makeFader(this.rack.masterVolume, v => {
      this.rack.setMasterVolume(v);
      this.project.masterVolume = v;
    });
    master.append(masterName, masterFader);
    row.appendChild(master);

    this.mixerMount.appendChild(row);
  }

  // ---- rack strip ----

  private renderRackStrip(): void {
    this.strips.forEach(s => s.destroy());
    this.strips.clear();
    this.rackMount.innerHTML = '';

    for (const id of this.project.channelOrder) {
      const state = this.project.channels[id];
      const rackCh = this.rack.getChannel(id);
      if (!state || !rackCh) continue;

      const strip = createChannelStrip({
        name: rackCh.name,
        instrumentLabel: INSTRUMENT_LABEL[state.instrument.id] ?? state.instrument.id.toUpperCase(),
        gain: rackCh.gain,
        pan: rackCh.pan,
        muted: rackCh.mute,
        soloed: rackCh.solo,
        onGain: v => this.rack.setChannelGain(id, v),
        onPan: v => this.rack.setChannelPan(id, v),
        onMute: m => this.rack.setChannelMute(id, m),
        onSolo: s => this.rack.setChannelSolo(id, s),
        onEdit: () => this.openDrawer(id),
        onSelect: () => {
          this.trackerGrid.selectChannel(id);
          this.updateStripSelection();
        }
      });
      this.strips.set(id, strip);
      this.rackMount.appendChild(strip.element);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'rack-add-btn';
    addBtn.textContent = '+ CHANNEL';
    addBtn.addEventListener('click', () => void this.addChannel());
    this.rackMount.appendChild(addBtn);

    this.updateStripSelection();
  }

  private updateStripSelection(): void {
    const selected = this.trackerGrid.cursor.channelId;
    this.strips.forEach((strip, id) => strip.setSelected(id === selected));
  }

  // ---- channel CRUD ----

  private nextChannelId(): ChannelId {
    let n = 1;
    while (this.project.channels[`ch${n}`]) n++;
    return `ch${n}`;
  }

  private async addChannel(): Promise<void> {
    const id = this.nextChannelId();
    const state = createChannelState(`CH ${id.slice(2)}`, 'poly-synth', { columns: 2 });
    this.project.channels[id] = state;
    this.project.channelOrder.push(id);
    await this.rack.addChannel(id, state);
    this.trackerGrid.setChannels(this.gridChannels());
    const pattern = this.currentPattern();
    this.trackerGrid.setPattern(pattern.channels, pattern.length);
    this.renderRackStrip();
    this.openDrawer(id);
  }

  private removeChannel(id: ChannelId): void {
    if (this.project.channelOrder.length <= 1) {
      showToast('A project needs at least one channel', 'info');
      return;
    }
    this.closeDrawer();
    this.rack.removeChannel(id);
    delete this.project.channels[id];
    this.project.channelOrder = this.project.channelOrder.filter(c => c !== id);
    for (const pattern of Object.values(this.project.patterns)) {
      delete pattern.channels[id];
    }
    this.trackerGrid.setChannels(this.gridChannels());
    const pattern = this.currentPattern();
    this.trackerGrid.setPattern(pattern.channels, pattern.length);
    this.renderRackStrip();
  }

  private async setChannelInstrument(id: ChannelId, instrumentId: string): Promise<void> {
    const state = this.project.channels[id];
    const desc = this.descriptors.find(d => d.id === instrumentId);
    if (!state || !desc || !(instrumentId in instrumentRegistry)) return;

    await this.rack.replaceInstrument(id, instrumentId);
    state.instrument = { id: instrumentId, params: {} };
    state.columns = desc.noteMode === 'lanes' ? (desc.lanes?.length ?? 4) : 4;
    // cells encode differently per noteMode — wipe this channel's lanes
    for (const pattern of Object.values(this.project.patterns)) {
      delete pattern.channels[id];
    }
    void this.rack.getChannel(id)?.instrument.load().catch((e: unknown) => {
      showToast(`Sample load failed: ${(e as Error).message}`, 'error');
    });

    this.trackerGrid.setChannels(this.gridChannels());
    const pattern = this.currentPattern();
    this.trackerGrid.setPattern(pattern.channels, pattern.length);
    this.renderRackStrip();
  }

  // ---- channel drawer ----

  private closeDrawer(): void {
    this.drawerFxChain?.destroy();
    this.drawerFxChain = null;
    this.drawerModMatrix?.destroy();
    this.drawerModMatrix = null;
    this.drawer?.remove();
    this.drawer = null;
    this.drawerChannelId = null;
  }

  /** Modulation target list for a channel's current instrument + FX chain. */
  private modTargets(id: ChannelId): Array<{ id: string; name: string; group: string }> {
    const rackCh = this.rack.getChannel(id);
    if (!rackCh) return [];
    const targets: Array<{ id: string; name: string; group: string }> = [];

    const instDefs = (rackCh.instrument.constructor as unknown as {
      parameterDefinitions: readonly { name: string }[];
    }).parameterDefinitions ?? [];
    for (const def of instDefs) {
      targets.push({ id: `inst.${def.name}`, name: def.name.toUpperCase(), group: 'INSTRUMENT' });
    }

    rackCh.fx.serialize().forEach((slot, i) => {
      const plugin = rackCh.fx.get(i);
      const defs = (plugin?.constructor as typeof AudioPlugin | undefined)?.parameterDefinitions ?? [];
      for (const def of defs) {
        targets.push({
          id: `fx${i}.${def.name}`,
          name: `${slot.id.toUpperCase()} ${def.name.toUpperCase()}`,
          group: `FX ${i + 1}`
        });
      }
    });

    targets.push({ id: 'channel.gain', name: 'CHANNEL GAIN', group: 'MIX' });
    targets.push({ id: 'channel.pan', name: 'CHANNEL PAN', group: 'MIX' });
    return targets;
  }

  private openDrawer(id: ChannelId): void {
    this.closeDrawer();
    const rackCh = this.rack.getChannel(id);
    const state = this.project.channels[id];
    if (!rackCh || !state) return;
    this.drawerChannelId = id;

    const drawer = document.createElement('div');
    drawer.id = 'channel-drawer';

    // header
    const header = document.createElement('div');
    header.className = 'drawer-header';
    const nameInput = document.createElement('input');
    nameInput.className = 'drawer-name';
    nameInput.value = rackCh.name;
    nameInput.maxLength = 10;
    nameInput.addEventListener('change', () => {
      const name = nameInput.value.trim().toUpperCase() || rackCh.name;
      nameInput.value = name;
      this.rack.setChannelName(id, name);
      state.name = name;
      this.trackerGrid.setChannels(this.gridChannels());
      const pattern = this.currentPattern();
      this.trackerGrid.setPattern(pattern.channels, pattern.length);
      this.renderRackStrip();
    });
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.closeDrawer());
    header.append(nameInput, closeBtn);
    drawer.appendChild(header);

    // instrument selector
    const instRow = document.createElement('div');
    instRow.className = 'drawer-row';
    const instLabel = document.createElement('span');
    instLabel.className = 'drawer-label';
    instLabel.textContent = 'INSTRUMENT';
    const instSelect = document.createElement('select');
    instSelect.className = 'drawer-select';
    for (const desc of this.descriptors) {
      const opt = document.createElement('option');
      opt.value = desc.id;
      opt.textContent = desc.name.toUpperCase();
      opt.selected = desc.id === state.instrument.id;
      instSelect.appendChild(opt);
    }
    instSelect.addEventListener('change', () => {
      void this.setChannelInstrument(id, instSelect.value).then(() => this.openDrawer(id));
    });
    instRow.append(instLabel, instSelect);
    drawer.appendChild(instRow);

    // waveform selector (poly-synth only)
    if (rackCh.instrument instanceof PolySynth) {
      const waveRow = document.createElement('div');
      waveRow.className = 'drawer-row';
      const waveLabel = document.createElement('span');
      waveLabel.className = 'drawer-label';
      waveLabel.textContent = 'WAVE';
      const waveSelect = document.createElement('select');
      waveSelect.className = 'drawer-select';
      for (const wave of ['sawtooth', 'square', 'triangle', 'sine']) {
        const opt = document.createElement('option');
        opt.value = wave;
        opt.textContent = wave.toUpperCase();
        opt.selected = (rackCh.instrument as PolySynth).waveform === wave;
        waveSelect.appendChild(opt);
      }
      waveSelect.addEventListener('change', () => {
        (rackCh.instrument as PolySynth).waveform = waveSelect.value as PolySynthWaveform;
      });
      waveRow.append(waveLabel, waveSelect);
      drawer.appendChild(waveRow);
    }

    // instrument param knobs
    const defs = (rackCh.instrument.constructor as unknown as InstrumentDescriptor & {
      parameterDefinitions: readonly { name: string; label?: string; min: number; max: number; default: number }[];
    }).parameterDefinitions ?? [];
    if (defs.length) {
      const knobGrid = document.createElement('div');
      knobGrid.className = 'drawer-knobs';
      for (const def of defs) {
        const knob = createKnob({
          label: (def.label ?? def.name).toUpperCase().slice(0, 8),
          value: rackCh.instrument.getParam(def.name),
          min: def.min,
          max: def.max,
          onChange: v => rackCh.instrument.setParam(def.name, v, 0.02)
        });
        knobGrid.appendChild(knob.element);
      }
      drawer.appendChild(knobGrid);
    }

    // sends + sidechain duck
    const sendsGrid = document.createElement('div');
    sendsGrid.className = 'drawer-knobs';
    for (const send of ['delay', 'reverb'] as const) {
      const knob = createKnob({
        label: `${send.toUpperCase()} SND`,
        value: Math.round(rackCh.sends[send] * 100),
        min: 0,
        max: 100,
        onChange: v => this.rack.setChannelSend(id, send, v / 100)
      });
      sendsGrid.appendChild(knob.element);
    }
    const duckKnob = createKnob({
      label: 'DUCK',
      value: Math.round(rackCh.duck * 100),
      min: 0,
      max: 100,
      onChange: v => this.rack.setChannelDuck(id, v / 100)
    });
    sendsGrid.appendChild(duckKnob.element);
    drawer.appendChild(sendsGrid);

    // FX chain
    this.drawerFxChain = createFxChain({
      available: this.pluginDescriptors,
      chain: this.fxChainState(id),
      onAdd: pluginId => void this.mutateFxChain(id, chain => [...chain, {
        pluginId, enabled: true, params: {}
      }]),
      onRemove: index => void this.mutateFxChain(id, chain => chain.filter((_, i) => i !== index)),
      onMove: (from, to) => void this.mutateFxChain(id, chain => {
        const next = [...chain];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      }),
      onParamChange: (index, param, value) => {
        this.rack.getChannel(id)?.fx.get(index)?.setParam(param, value, 0.02);
      },
      onToggle: (index, enabled) => {
        const plugin = this.rack.getChannel(id)?.fx.get(index);
        if (plugin) plugin.bypassed = !enabled;
      }
    });
    drawer.appendChild(this.drawerFxChain.element);

    // mod matrix
    this.drawerModMatrix = createModMatrix({
      sources: [
        { id: 'lfo1', name: 'LFO 1' },
        { id: 'lfo2', name: 'LFO 2' },
        { id: 'menv', name: 'M.ENV' }
      ],
      targets: this.modTargets(id),
      routes: rackCh.mods.routes,
      onChange: routes => {
        rackCh.mods.routes = routes.filter(
          (r): r is ModRouteState =>
            (r.source === 'lfo1' || r.source === 'lfo2' || r.source === 'menv') &&
            this.rack.resolveModTarget(id, r.target) !== null
        ).map(r => ({ source: r.source as ModRouteState['source'], target: r.target, depth: r.depth }));
      }
    });
    drawer.appendChild(this.drawerModMatrix.element);

    // remove channel
    const removeBtn = document.createElement('button');
    removeBtn.className = 'drawer-remove';
    removeBtn.textContent = 'REMOVE CHANNEL';
    removeBtn.addEventListener('click', () => this.removeChannel(id));
    drawer.appendChild(removeBtn);

    document.body.appendChild(drawer);
    this.drawer = drawer;
  }

  private fxChainState(id: ChannelId): FxChainSlotState[] {
    const rackCh = this.rack.getChannel(id);
    if (!rackCh) return [];
    return rackCh.fx.serialize().map(s => ({
      pluginId: s.id,
      enabled: !s.bypassed,
      params: s.params
    }));
  }

  /** Rebuild the live FX chain from an edited slot list, keeping settings. */
  private async mutateFxChain(
    id: ChannelId,
    edit: (chain: FxChainSlotState[]) => FxChainSlotState[]
  ): Promise<void> {
    const next = edit(this.fxChainState(id));
    await this.rack.setChannelFxChain(id, next.map(s => ({
      id: s.pluginId, params: s.params, bypassed: !s.enabled
    })));
    if (this.drawerChannelId === id) {
      this.drawerFxChain?.setChain(this.fxChainState(id));
      this.drawerModMatrix?.setTargets(this.modTargets(id));
    }
  }

  // ---- AI ----

  private logFeed(message: string, isError = false): void {
    const msg = document.createElement('div');
    msg.className = 'ai-msg' + (isError ? ' error' : '');
    msg.textContent = message;
    this.aiFeed.appendChild(msg);
    this.aiFeed.scrollTop = this.aiFeed.scrollHeight;
  }

  private aiContext(): AIContext {
    return {
      project: this.project,
      currentPatternId: this.currentPatternId,
      trackerGrid: this.trackerGrid,
      logFeed: (m, err) => this.logFeed(m, err),
      setBpm: bpm => {
        this.transport.bpm = bpm;
        this.project.bpm = this.transport.bpm;
        this.bpmInput.value = String(this.transport.bpm);
      },
      refreshPattern: () => {
        const pattern = this.currentPattern();
        this.trackerGrid.setPattern(pattern.channels, pattern.length);
        this.orderList.setOrder(this.project.songOrder);
        this.refreshPatternBankFlags();
      },
      refreshMeta: () => {
        this.cloud?.updateSaveButtonState?.();
      }
    };
  }

  private async applyByCapability(capability: AICapability, result: unknown): Promise<void> {
    if (capability === 'sound') {
      await this.applySoundResponse(result as AISoundResponse);
    } else if (capability === 'mix') {
      this.applyMixResponse(result as AIMixResponse);
      if (this.mixerVisible) this.buildMixer();
    } else {
      // 'pattern' and 'arrange' share the pattern/order response shape
      await applyPatternResponse(result as AIPatternResponse, this.aiContext(), capability === 'pattern');
    }
  }

  private setAiBusy(busy: boolean): void {
    this.aiGenerateBtn.disabled = busy;
    this.aiComposeBtn.disabled = busy;
  }

  private async handleGenerate(): Promise<void> {
    const prompt = this.aiPrompt.value.trim();
    if (!prompt) {
      showToast('Describe what you want first', 'info');
      return;
    }
    const mode = AI_MODES[this.aiModeIdx];
    this.setAiBusy(true);
    this.logFeed(`▶ [${mode.label}] ${prompt}`);
    try {
      const result = await requestGeneration(
        mode.id, prompt, this.project, this.currentPatternId
      );
      await this.applyByCapability(mode.id, result);
      showToast(`${mode.label} applied`, 'success');
    } catch (e) {
      this.logFeed(`Generation failed: ${(e as Error).message}`, true);
      showToast('AI generation failed', 'error');
    } finally {
      this.setAiBusy(false);
    }
  }

  /**
   * COMPOSE: one prompt drives the full chain — sound design, patterns,
   * arrangement, then mix — each stage narrated into the feed.
   */
  private async handleCompose(): Promise<void> {
    const prompt = this.aiPrompt.value.trim();
    if (!prompt) {
      showToast('Describe the track you want first', 'info');
      return;
    }
    const stages: Array<{ capability: AICapability; label: string; brief: string }> = [
      { capability: 'sound', label: 'SOUND DESIGN', brief: `${prompt} — design a fitting sound for every channel` },
      { capability: 'pattern', label: 'PATTERNS', brief: `${prompt} — write the main pattern A and a variation pattern B` },
      { capability: 'arrange', label: 'ARRANGEMENT', brief: `${prompt} — arrange a full song from the available patterns` },
      { capability: 'mix', label: 'MIX', brief: `${prompt} — balance the final mix` }
    ];

    this.setAiBusy(true);
    this.logFeed(`◆ COMPOSE: ${prompt}`);
    try {
      for (const stage of stages) {
        this.logFeed(`— ${stage.label} —`);
        const result = await requestGeneration(
          stage.capability, stage.brief, this.project, this.currentPatternId
        );
        await this.applyByCapability(stage.capability, result);
      }
      this.logFeed('◆ Composition complete');
      showToast('Composition complete', 'success');
    } catch (e) {
      this.logFeed(`Compose failed: ${(e as Error).message}`, true);
      showToast('Compose failed', 'error');
    } finally {
      this.setAiBusy(false);
    }
  }

  private async applySoundResponse(result: AISoundResponse): Promise<void> {
    for (const line of result.reasoning ?? []) {
      this.logFeed(line);
    }
    for (const [chId, patch] of Object.entries(result.channels ?? {})) {
      const rackCh = this.rack.getChannel(chId);
      const state = this.project.channels[chId];
      if (!rackCh || !state) continue;

      this.strips.get(chId)?.setFocus(true);

      if (patch.instrumentId && patch.instrumentId !== state.instrument.id) {
        await this.setChannelInstrument(chId, patch.instrumentId);
      }
      const inst = this.rack.getChannel(chId)?.instrument;
      if (!inst) continue;

      if (patch.params) {
        const numeric: Record<string, number> = {};
        for (const [k, v] of Object.entries(patch.params)) {
          if (typeof v === 'number' && Number.isFinite(v)) numeric[k] = v;
        }
        inst.setParams(numeric, 0.05);
        if (typeof patch.params.waveform === 'string' && inst instanceof PolySynth) {
          inst.waveform = patch.params.waveform as PolySynthWaveform;
        }
      }

      if (Array.isArray(patch.fxChain)) {
        await this.rack.setChannelFxChain(chId, patch.fxChain
          .filter(f => typeof f.pluginId === 'string' && f.pluginId in pluginRegistry)
          .map(f => ({ id: f.pluginId as string, params: f.params ?? {} }))
        );
      }

      if (Array.isArray(patch.mods)) {
        const routes: ModRouteState[] = [];
        for (const m of patch.mods.slice(0, 8)) {
          if (
            (m.source === 'lfo1' || m.source === 'lfo2' || m.source === 'menv') &&
            typeof m.target === 'string' && typeof m.depth === 'number' &&
            this.rack.resolveModTarget(chId, m.target)
          ) {
            routes.push({
              source: m.source,
              target: m.target,
              depth: Math.max(-1, Math.min(1, m.depth))
            });
          }
        }
        rackCh.mods.routes = routes;
      }

      this.strips.get(chId)?.setFocus(false);
      if (this.drawerChannelId === chId) {
        this.openDrawer(chId); // rebuild with new values
      }
    }
    this.renderRackStrip();
  }

  private applyMixResponse(result: AIMixResponse): void {
    for (const line of result.reasoning ?? []) {
      this.logFeed(line);
    }
    for (const [chId, patch] of Object.entries(result.channels ?? {})) {
      const strip = this.strips.get(chId);
      if (!this.rack.getChannel(chId)) continue;
      strip?.setFocus(true);
      if (typeof patch.gain === 'number') {
        this.rack.setChannelGain(chId, patch.gain);
        strip?.setGain(Math.max(0, Math.min(1, patch.gain)));
      }
      if (typeof patch.pan === 'number') {
        this.rack.setChannelPan(chId, patch.pan);
        strip?.setPan(Math.max(-1, Math.min(1, patch.pan)));
      }
      if (patch.sends) {
        if (typeof patch.sends.delay === 'number') {
          this.rack.setChannelSend(chId, 'delay', patch.sends.delay);
        }
        if (typeof patch.sends.reverb === 'number') {
          this.rack.setChannelSend(chId, 'reverb', patch.sends.reverb);
        }
      }
      setTimeout(() => strip?.setFocus(false), 900);
    }
    if (typeof result.master?.gain === 'number') {
      this.rack.setMasterVolume(result.master.gain);
      this.project.masterVolume = this.rack.masterVolume;
    }
  }

  // ---- serialization ----

  private serializeProject(): ProjectState {
    const patterns: Record<string, PatternState> = {};
    for (const [id, pattern] of Object.entries(this.project.patterns)) {
      patterns[id] = prunePattern(pattern);
    }
    return {
      ...this.project,
      channels: this.rack.serializeChannels(this.project.channelOrder),
      patterns,
      songOrder: [...this.project.songOrder]
    };
  }

  private async applyProject(state: Partial<ProjectState>): Promise<void> {
    const defaults = createDefaultProject();
    this.project = {
      ...defaults,
      ...state,
      channels: state.channels ?? defaults.channels,
      channelOrder: state.channelOrder ?? defaults.channelOrder,
      patterns: state.patterns && Object.keys(state.patterns).length
        ? state.patterns
        : defaults.patterns,
      songOrder: state.songOrder?.length ? state.songOrder : defaults.songOrder
    };
    for (const pattern of Object.values(this.project.patterns)) {
      for (const chId of Object.keys(this.project.channels)) {
        if (pattern.channels[chId]) {
          ensurePatternChannel(pattern, chId, this.project.channels[chId].columns);
        }
      }
    }

    this.transport.stop();
    this.currentPatternId = (this.project.songOrder[0] ?? 'A') as PatternId;
    await this.buildRackFromProject();
    this.refreshAll();
  }

  private refreshAll(): void {
    this.transport.bpm = this.project.bpm;
    this.transport.swing = this.project.swing;
    this.bpmInput.value = String(this.project.bpm);
    this.swingInput.value = String(this.project.swing);
    this.trackerGrid.setChannels(this.gridChannels());
    const pattern = this.currentPattern();
    this.trackerGrid.setPattern(pattern.channels, pattern.length);
    this.patternBank.setActivePattern(this.currentPatternId as BankPatternId);
    this.refreshPatternBankFlags();
    this.orderList.setOrder(this.project.songOrder);
    this.renderRackStrip();
  }

  private refreshPatternBankFlags(): void {
    for (const id of 'ABCDEFGHIJKLMNOP') {
      const pattern = this.project.patterns[id];
      const hasData = !!pattern &&
        Object.values(pattern.channels).some(cols => cols.some(col => col.some(c => c !== null)));
      this.patternBank.setPatternHasData(id as BankPatternId, hasData);
    }
  }
}

const app = new StudioApp();
void app.init();
