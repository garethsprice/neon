/**
 * @neon/ai Playground
 * Interactive testing of all neon-ai features.
 */

import * as d3 from 'd3';
import {
  DEFAULT_GENRES,
  DEFAULT_SKILLS,
  detectGenreFromKeywords,
  detectSkillsFromContext,
  detect,
  buildAugmentedPrompt,
  buildThumbnailPrompt,
  generateCreativeBrief,
  generateTrackName,
  type Genre,
  type Skill,
  type DetectionResult,
} from '@neon/ai';

// =============================================================================
// TYPES
// =============================================================================

interface GenreNode extends d3.SimulationNodeDatum {
  id: string;
  genre: Genre;
  category: string;
  connections: number;
}

interface GenreLink extends d3.SimulationLinkDatum<GenreNode> {
  source: GenreNode | string;
  target: GenreNode | string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const CATEGORY_COLORS: Record<string, string> = {
  'house': '#ff6b35',
  'techno': '#4ecdc4',
  'trance': '#a855f7',
  'hardcore': '#ef4444',
  'bass': '#22c55e',
  'hiphop': '#f59e0b',
  'retro': '#ec4899',
  'other': '#6366f1',
};

function categorizeGenre(id: string): string {
  const families: Record<string, string[]> = {
    house: ['house', 'tech-house', 'nu-disco', 'garage', 'pop'],
    techno: ['techno', 'ebm', 'darksynth'],
    trance: ['trance', 'hard-trance', 'psytrance'],
    hardcore: ['hardcore', 'hardstyle', 'gabber', 'donk', 'nightcore'],
    bass: ['dnb', 'dubstep', 'glitch-hop'],
    hiphop: ['hiphop'],
    retro: ['italo', 'eurodance', 'synthwave', 'chiptune', 'vaporwave', 'chillwave', 'witch-house'],
  };

  for (const [category, ids] of Object.entries(families)) {
    if (ids.includes(id)) return category;
  }
  return 'other';
}

// =============================================================================
// STATE
// =============================================================================

let currentDetection: DetectionResult | null = null;
let graph: GenreGraph | null = null;

// =============================================================================
// GRAPH
// =============================================================================

function buildGraphData(): { nodes: GenreNode[]; links: GenreLink[] } {
  const nodes: GenreNode[] = [];
  const links: GenreLink[] = [];
  const linkSet = new Set<string>();

  for (const [id, genre] of Object.entries(DEFAULT_GENRES)) {
    nodes.push({
      id,
      genre,
      category: categorizeGenre(id),
      connections: genre.related?.length ?? 0,
    });
  }

  for (const [id, genre] of Object.entries(DEFAULT_GENRES)) {
    if (genre.related) {
      for (const relatedId of genre.related) {
        const targetId = Object.keys(DEFAULT_GENRES).find(
          k => k.toLowerCase() === relatedId.toLowerCase()
        );
        if (targetId) {
          const linkKey = [id, targetId].sort().join('-');
          if (!linkSet.has(linkKey)) {
            linkSet.add(linkKey);
            links.push({ source: id, target: targetId });
          }
        }
      }
    }
  }

  return { nodes, links };
}

class GenreGraph {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private container: d3.Selection<SVGGElement, unknown, null, undefined>;
  private simulation: d3.Simulation<GenreNode, GenreLink>;
  private nodes: GenreNode[];
  private links: GenreLink[];
  private nodeElements!: d3.Selection<SVGGElement, GenreNode, SVGGElement, unknown>;
  private linkElements!: d3.Selection<SVGLineElement, GenreLink, SVGGElement, unknown>;
  private showLabels = true;
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;

  constructor(svgElement: SVGSVGElement) {
    const { nodes, links } = buildGraphData();
    this.nodes = nodes;
    this.links = links;

    this.svg = d3.select<SVGSVGElement, unknown>(svgElement);
    this.container = this.svg.append('g');

    this.zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        this.container.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);

    this.simulation = d3.forceSimulation<GenreNode>(this.nodes)
      .force('link', d3.forceLink<GenreNode, GenreLink>(this.links)
        .id(d => d.id)
        .distance(80)
        .strength(0.5))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter())
      .force('collision', d3.forceCollide().radius(30));

    this.render();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize(): void {
    const container = document.getElementById('graph-container');
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    if (width > 0 && height > 0) {
      this.svg.attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`);
    }
  }

  private render(): void {
    this.linkElements = this.container.append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, GenreLink>('line')
      .data(this.links)
      .join('line')
      .attr('class', 'link');

    this.nodeElements = this.container.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GenreNode>('g')
      .data(this.nodes)
      .join('g')
      .attr('class', 'node')
      .call(this.drag())
      .on('click', (_, d) => this.selectNode(d))
      .on('mouseenter', (_, d) => {
        this.highlightConnections(d);
        this.showTooltip(d);
      })
      .on('mouseleave', () => {
        this.clearHighlights();
        this.hideTooltip();
      });

    this.nodeElements.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => 8 + d.connections * 2)
      .attr('fill', d => CATEGORY_COLORS[d.category]);

    this.nodeElements.append('text')
      .attr('class', 'node-label')
      .attr('dy', d => 20 + d.connections * 2)
      .text(d => d.genre.name);

    this.simulation.on('tick', () => {
      this.linkElements
        .attr('x1', d => (d.source as GenreNode).x ?? 0)
        .attr('y1', d => (d.source as GenreNode).y ?? 0)
        .attr('x2', d => (d.target as GenreNode).x ?? 0)
        .attr('y2', d => (d.target as GenreNode).y ?? 0);

      this.nodeElements.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });
  }

  private drag(): d3.DragBehavior<SVGGElement, GenreNode, GenreNode | d3.SubjectPosition> {
    return d3.drag<SVGGElement, GenreNode>()
      .on('start', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }

  private selectNode(node: GenreNode): void {
    this.nodeElements.classed('selected', d => d === node);
    this.showTooltip(node);
  }

  private showTooltip(node: GenreNode): void {
    const tooltip = document.getElementById('genre-tooltip');
    const nameEl = document.getElementById('tooltip-name');
    const bpmEl = document.getElementById('tooltip-bpm');
    const aestheticEl = document.getElementById('tooltip-aesthetic');

    if (!tooltip || !nameEl || !bpmEl || !aestheticEl) return;

    const genre = node.genre;
    nameEl.textContent = genre.name;
    nameEl.style.color = CATEGORY_COLORS[node.category];
    bpmEl.textContent = genre.bpmRange
      ? `${genre.bpmRange[0]} - ${genre.bpmRange[1]} BPM`
      : 'BPM: N/A';
    aestheticEl.textContent = genre.aesthetic;

    tooltip.classList.add('visible');
  }

  private hideTooltip(): void {
    const tooltip = document.getElementById('genre-tooltip');
    if (tooltip) tooltip.classList.remove('visible');
  }

  private highlightConnections(node: GenreNode): void {
    const connectedIds = new Set<string>([node.id]);

    this.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      if (sourceId === node.id) connectedIds.add(targetId);
      if (targetId === node.id) connectedIds.add(sourceId);
    });

    this.linkElements.classed('highlighted', link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return sourceId === node.id || targetId === node.id;
    });

    this.linkElements.attr('stroke', link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      if (sourceId === node.id || targetId === node.id) {
        return CATEGORY_COLORS[node.category];
      }
      return '';
    });

    this.nodeElements.style('opacity', d => connectedIds.has(d.id) ? 1 : 0.3);
  }

  private clearHighlights(): void {
    this.linkElements.classed('highlighted', false).attr('stroke', '');
    this.nodeElements.style('opacity', 1);
  }

  setShowLabels(show: boolean): void {
    this.showLabels = show;
    this.nodeElements.selectAll('.node-label').classed('hidden', !show);
  }

  toggleLabels(): void {
    this.setShowLabels(!this.showLabels);
  }

  resetZoom(): void {
    this.svg.transition().duration(500).call(this.zoom.transform, d3.zoomIdentity);
  }

  getStats() {
    return {
      totalGenres: this.nodes.length,
      totalConnections: this.links.length,
    };
  }
}

// =============================================================================
// UI HELPERS
// =============================================================================

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function setInner(id: string, content: string): void {
  const el = $(id);
  if (el) el.innerHTML = content;
}

function setText(id: string, text: string): void {
  const el = $(id);
  if (el) el.textContent = text;
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m] || m));
}

// =============================================================================
// GRAPH SECTION
// =============================================================================

function initGraphSection(): void {
  const container = $('graph-container');
  const fullscreenBtn = $('fullscreen-graph');

  if (!container) return;

  // Initialize graph immediately
  initGraph();

  // Fullscreen toggle
  fullscreenBtn?.addEventListener('click', () => {
    container.classList.toggle('fullscreen');
    fullscreenBtn.textContent = container.classList.contains('fullscreen') ? 'Exit' : 'Expand';

    // Resize graph after fullscreen toggle
    setTimeout(() => graph?.resize(), 100);
  });

  // ESC to exit fullscreen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && container.classList.contains('fullscreen')) {
      container.classList.remove('fullscreen');
      if (fullscreenBtn) fullscreenBtn.textContent = 'Expand';
      setTimeout(() => graph?.resize(), 100);
    }
  });
}

function initGraph(): void {
  const svgElement = document.querySelector<SVGSVGElement>('#genre-graph');
  if (!svgElement) return;

  graph = new GenreGraph(svgElement);

  // Graph controls
  $('reset-zoom')?.addEventListener('click', () => graph?.resetZoom());
  $('toggle-labels')?.addEventListener('click', () => graph?.toggleLabels());

  // Render legend
  renderLegend();
}

// =============================================================================
// SKILLS
// =============================================================================

function renderSkills(): void {
  const skillsGrid = $('skills-grid');
  if (!skillsGrid) return;

  const categories = new Set<string>();

  let html = '';
  for (const [id, skill] of Object.entries(DEFAULT_SKILLS)) {
    if (skill.category) categories.add(skill.category);

    html += `
      <div class="skill-card" data-skill="${escapeHtml(id)}">
        <div class="skill-name">${escapeHtml(skill.name)}</div>
        ${skill.category ? `<span class="skill-category">${escapeHtml(skill.category)}</span>` : ''}
        <div class="skill-augment">${escapeHtml(skill.augment)}</div>
      </div>
    `;
  }

  skillsGrid.innerHTML = html;

  // Add click-to-expand on skill cards
  skillsGrid.querySelectorAll('.skill-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('expanded');
    });
  });

  // Update stats
  setText('total-skills', String(Object.keys(DEFAULT_SKILLS).length));
  setText('skills-count', String(Object.keys(DEFAULT_SKILLS).length));
  setText('categories-count', String(categories.size));
}

// =============================================================================
// DETECTION
// =============================================================================

function renderDetectionResult(result: DetectionResult): void {
  const container = $('detect-result');
  if (!container) return;

  container.className = 'result-box';

  let html = '';

  // Genre
  html += '<div style="margin-bottom: 8px;">';
  html += '<div class="result-label">Detected Genre</div>';
  if (result.genre) {
    html += `<span class="tag genre">${escapeHtml(result.genre)}</span>`;
    if (result.genreData) {
      html += `<div style="margin-top: 4px; font-size: 0.75em; color: var(--text-dim);">${escapeHtml(result.genreData.name)}</div>`;
    }
  } else {
    html += '<span style="color: var(--text-dim);">None detected</span>';
  }
  html += '</div>';

  // Skills
  html += '<div>';
  html += '<div class="result-label">Detected Skills</div>';
  if (result.skills.length > 0) {
    html += result.skills.map(s => `<span class="tag skill">${escapeHtml(s)}</span>`).join('');
  } else {
    html += '<span style="color: var(--text-dim);">None detected</span>';
  }
  html += '</div>';

  container.innerHTML = html;
}

async function runKeywordDetection(): Promise<void> {
  const input = $('detect-input') as HTMLTextAreaElement | null;
  if (!input?.value.trim()) return;

  const prompt = input.value.trim();
  const genre = detectGenreFromKeywords(prompt);
  const skills = detectSkillsFromContext(prompt);

  currentDetection = {
    genre,
    genreData: genre ? DEFAULT_GENRES[genre] : null,
    skills,
    skillsData: skills.map(id => DEFAULT_SKILLS[id]).filter((s): s is Skill => !!s),
  };

  renderDetectionResult(currentDetection);
}

async function runAIDetection(): Promise<void> {
  const input = $('detect-input') as HTMLTextAreaElement | null;
  const btn = $('detect-ai') as HTMLButtonElement | null;
  if (!input?.value.trim() || !btn) return;

  const prompt = input.value.trim();

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Detecting...';

  try {
    currentDetection = await detect(prompt, { useAI: true });
    renderDetectionResult(currentDetection);
  } catch (e) {
    console.error('AI detection failed:', e);
    setInner('detect-result', '<span style="color: var(--text-dim);">AI detection failed. Make sure websim API is available.</span>');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Detect (AI)';
  }
}

function buildAugmented(): void {
  const baseInput = $('augment-base') as HTMLTextAreaElement | null;
  const genreSelect = $('augment-genre') as HTMLSelectElement | null;
  const skillsSelect = $('augment-skills') as HTMLSelectElement | null;
  const resultEl = $('augment-result');
  if (!baseInput || !resultEl) return;

  const basePrompt = baseInput.value.trim() || 'You are an expert music producer.';
  const genre = genreSelect?.value || undefined;
  const skills = Array.from(skillsSelect?.selectedOptions || []).map(opt => opt.value);

  const augmented = buildAugmentedPrompt(basePrompt, {
    genre,
    skills,
  });

  // Highlight the augmented parts
  let displayHtml = escapeHtml(basePrompt);

  if (genre || skills.length > 0) {
    const added = augmented.slice(basePrompt.length);
    displayHtml += `<div class="prompt-highlight">${escapeHtml(added)}</div>`;
  }

  resultEl.innerHTML = displayHtml;
}

function populateAugmentSelects(): void {
  const genreSelect = $('augment-genre') as HTMLSelectElement | null;
  const skillsSelect = $('augment-skills') as HTMLSelectElement | null;

  if (genreSelect) {
    for (const [id, genre] of Object.entries(DEFAULT_GENRES)) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = genre.name;
      genreSelect.appendChild(option);
    }
  }

  if (skillsSelect) {
    for (const [id, skill] of Object.entries(DEFAULT_SKILLS)) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = skill.name;
      skillsSelect.appendChild(option);
    }
  }
}

// =============================================================================
// CREATIVE
// =============================================================================

async function genTrackName(): Promise<void> {
  const styleInput = $('trackname-style') as HTMLInputElement | null;
  const appSelect = $('trackname-app') as HTMLSelectElement | null;
  const resultEl = $('trackname-result');
  const btn = $('gen-trackname') as HTMLButtonElement | null;

  if (!resultEl || !btn) return;

  const style = styleInput?.value.trim() || undefined;
  const appType = appSelect?.value || 'drums';

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const name = await generateTrackName(style, appType);
    resultEl.className = 'result-box';
    resultEl.innerHTML = `<span style="font-size: 1rem; color: var(--accent);">${escapeHtml(name)}</span>`;
  } catch (e) {
    console.error('Track name generation failed:', e);
    resultEl.innerHTML = '<span style="color: var(--text-dim);">Generation failed. Check websim API.</span>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate';
  }
}

async function genCreativeBrief(): Promise<void> {
  const input = $('brief-input') as HTMLTextAreaElement | null;
  const resultEl = $('brief-result');
  const btn = $('gen-brief') as HTMLButtonElement | null;

  if (!input?.value.trim() || !resultEl || !btn) return;

  const prompt = input.value.trim();

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const brief = await generateCreativeBrief(prompt);
    resultEl.className = 'result-box';
    resultEl.innerHTML = brief ? escapeHtml(brief) : '<span style="color: var(--text-dim);">No brief generated.</span>';
  } catch (e) {
    console.error('Creative brief generation failed:', e);
    resultEl.innerHTML = '<span style="color: var(--text-dim);">Generation failed. Check websim API.</span>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Brief';
  }
}

function buildThumbPrompt(): void {
  const titleInput = $('thumb-title') as HTMLInputElement | null;
  const genreSelect = $('thumb-genre') as HTMLSelectElement | null;
  const resultEl = $('thumb-prompt');

  if (!resultEl) return;

  const title = titleInput?.value.trim() || 'Untitled';
  const genre = genreSelect?.value || undefined;

  const prompt = buildThumbnailPrompt(
    { title, genre },
    { genres: DEFAULT_GENRES }
  );

  resultEl.className = 'result-box';
  resultEl.textContent = prompt;
}

function populateGenreSelect(): void {
  const select = $('thumb-genre') as HTMLSelectElement | null;
  if (!select) return;

  for (const [id, genre] of Object.entries(DEFAULT_GENRES)) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = genre.name;
    select.appendChild(option);
  }
}

// =============================================================================
// LEGEND
// =============================================================================

function renderLegend(): void {
  const container = $('legend-items');
  if (!container) return;

  container.innerHTML = Object.entries(CATEGORY_COLORS).map(([name, color]) => `
    <div class="legend-item">
      <div class="legend-color" style="background: ${color}"></div>
      <span>${name}</span>
    </div>
  `).join('');
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function init(): void {
  // Update header stats
  setText('total-genres', String(Object.keys(DEFAULT_GENRES).length));
  setText('total-skills', String(Object.keys(DEFAULT_SKILLS).length));

  // Initialize graph section (collapsed by default, graph created on expand)
  initGraphSection();

  // Render skills browser
  renderSkills();

  // Populate genre selects
  populateGenreSelect();
  populateAugmentSelects();

  // Detection handlers
  $('detect-keywords')?.addEventListener('click', runKeywordDetection);
  $('detect-ai')?.addEventListener('click', runAIDetection);
  $('augment-btn')?.addEventListener('click', buildAugmented);

  // Creative handlers
  $('gen-trackname')?.addEventListener('click', genTrackName);
  $('gen-brief')?.addEventListener('click', genCreativeBrief);
  $('build-thumb-prompt')?.addEventListener('click', buildThumbPrompt);

  console.log('@neon/ai Playground loaded');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
