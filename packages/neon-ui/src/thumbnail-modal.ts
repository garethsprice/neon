/**
 * Neon UI - Thumbnail Modal
 *
 * Modal for viewing, editing, and regenerating track thumbnails.
 * Provides keep/revert functionality for generated images.
 */

export interface ThumbnailModalOptions {
  /** Current thumbnail URL */
  thumbnailUrl?: string | null;
  /** Current prompt used to generate the thumbnail */
  prompt?: string;
  /** Called when thumbnail is regenerated and kept */
  onSave?: (url: string, prompt: string) => void;
  /** Called when modal is closed without saving */
  onCancel?: () => void;
  /** Function to generate thumbnail from prompt */
  generateThumbnail: (prompt: string) => Promise<string>;
  /** Optional toast notification function */
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export interface ThumbnailModalComponent {
  /** The modal element */
  element: HTMLElement;
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
  /** Update the current thumbnail */
  setThumbnail: (url: string | null, prompt?: string) => void;
  /** Destroy and remove the modal */
  destroy: () => void;
}

const MODAL_STYLES = `
  .neon-thumbnail-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s, visibility 0.2s;
  }

  .neon-thumbnail-modal-overlay.open {
    opacity: 1;
    visibility: visible;
  }

  .neon-thumbnail-modal {
    background: #12121a;
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: 12px;
    padding: 24px;
    max-width: 480px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    transform: scale(0.95);
    transition: transform 0.2s;
  }

  .neon-thumbnail-modal-overlay.open .neon-thumbnail-modal {
    transform: scale(1);
  }

  .neon-thumbnail-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .neon-thumbnail-modal-title {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(0, 255, 255, 0.7);
    margin: 0;
  }

  .neon-thumbnail-modal-close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .neon-thumbnail-modal-close:hover {
    color: #fff;
  }

  .neon-thumbnail-modal-preview {
    width: 100%;
    aspect-ratio: 1;
    background: #0a0a0f;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .neon-thumbnail-modal-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .neon-thumbnail-modal-preview.loading::after {
    content: '';
    position: absolute;
    width: 40px;
    height: 40px;
    border: 3px solid rgba(0, 255, 255, 0.2);
    border-top-color: #00ffff;
    border-radius: 50%;
    animation: neon-thumb-spin 0.8s linear infinite;
  }

  @keyframes neon-thumb-spin {
    to { transform: rotate(360deg); }
  }

  .neon-thumbnail-modal-placeholder {
    color: rgba(255, 255, 255, 0.3);
    font-size: 0.8rem;
    text-align: center;
  }

  .neon-thumbnail-modal-prompt-label {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(0, 255, 255, 0.6);
    margin-bottom: 6px;
  }

  .neon-thumbnail-modal-prompt {
    width: 100%;
    min-height: 80px;
    padding: 10px 12px;
    background: #0a0a0f;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #e0e0e0;
    font-family: inherit;
    font-size: 0.85rem;
    resize: vertical;
    margin-bottom: 16px;
  }

  .neon-thumbnail-modal-prompt:focus {
    outline: none;
    border-color: rgba(0, 255, 255, 0.5);
  }

  .neon-thumbnail-modal-actions {
    display: flex;
    gap: 10px;
  }

  .neon-thumbnail-modal-btn {
    flex: 1;
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.15s;
  }

  .neon-thumbnail-modal-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .neon-thumbnail-modal-btn.primary {
    background: rgba(0, 255, 255, 0.15);
    border: 1px solid rgba(0, 255, 255, 0.4);
    color: #00ffff;
  }

  .neon-thumbnail-modal-btn.primary:hover:not(:disabled) {
    background: rgba(0, 255, 255, 0.25);
  }

  .neon-thumbnail-modal-btn.success {
    background: rgba(0, 255, 136, 0.15);
    border: 1px solid rgba(0, 255, 136, 0.4);
    color: #00ff88;
  }

  .neon-thumbnail-modal-btn.success:hover:not(:disabled) {
    background: rgba(0, 255, 136, 0.25);
  }

  .neon-thumbnail-modal-btn.secondary {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
  }

  .neon-thumbnail-modal-btn.secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .neon-thumbnail-modal-status {
    text-align: center;
    font-size: 0.7rem;
    color: rgba(0, 255, 255, 0.6);
    margin-top: 12px;
    min-height: 1.2em;
  }
`;

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = MODAL_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

export function createThumbnailModal(options: ThumbnailModalOptions): ThumbnailModalComponent {
  injectStyles();

  const {
    thumbnailUrl: initialUrl,
    prompt: initialPrompt = '',
    onSave,
    onCancel,
    generateThumbnail,
    showToast
  } = options;

  let currentUrl = initialUrl || null;
  let originalUrl = initialUrl || null;
  let originalPrompt = initialPrompt;
  let isGenerating = false;
  let hasChanges = false;

  // Create modal elements
  const overlay = document.createElement('div');
  overlay.className = 'neon-thumbnail-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'neon-thumbnail-modal';

  const header = document.createElement('div');
  header.className = 'neon-thumbnail-modal-header';

  const title = document.createElement('h3');
  title.className = 'neon-thumbnail-modal-title';
  title.textContent = 'Track Artwork';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'neon-thumbnail-modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.title = 'Close';

  header.appendChild(title);
  header.appendChild(closeBtn);

  const preview = document.createElement('div');
  preview.className = 'neon-thumbnail-modal-preview';

  const promptLabel = document.createElement('div');
  promptLabel.className = 'neon-thumbnail-modal-prompt-label';
  promptLabel.textContent = 'Image Prompt';

  const promptInput = document.createElement('textarea');
  promptInput.className = 'neon-thumbnail-modal-prompt';
  promptInput.value = initialPrompt;
  promptInput.placeholder = 'Describe the artwork style...';

  const actions = document.createElement('div');
  actions.className = 'neon-thumbnail-modal-actions';

  const regenBtn = document.createElement('button');
  regenBtn.className = 'neon-thumbnail-modal-btn primary';
  regenBtn.textContent = 'Regenerate';

  const keepBtn = document.createElement('button');
  keepBtn.className = 'neon-thumbnail-modal-btn success';
  keepBtn.textContent = 'Keep';
  keepBtn.style.display = 'none';

  const revertBtn = document.createElement('button');
  revertBtn.className = 'neon-thumbnail-modal-btn secondary';
  revertBtn.textContent = 'Revert';
  revertBtn.style.display = 'none';

  actions.appendChild(regenBtn);
  actions.appendChild(keepBtn);
  actions.appendChild(revertBtn);

  const status = document.createElement('div');
  status.className = 'neon-thumbnail-modal-status';

  modal.appendChild(header);
  modal.appendChild(preview);
  modal.appendChild(promptLabel);
  modal.appendChild(promptInput);
  modal.appendChild(actions);
  modal.appendChild(status);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function updatePreview(): void {
    if (currentUrl) {
      preview.innerHTML = `<img src="${currentUrl}" alt="Track artwork">`;
    } else {
      preview.innerHTML = '<div class="neon-thumbnail-modal-placeholder">No artwork yet</div>';
    }
  }

  function updateButtons(): void {
    if (hasChanges) {
      keepBtn.style.display = '';
      revertBtn.style.display = '';
      regenBtn.textContent = 'Regenerate';
    } else {
      keepBtn.style.display = 'none';
      revertBtn.style.display = 'none';
      regenBtn.textContent = currentUrl ? 'Regenerate' : 'Generate';
    }
  }

  function setLoading(loading: boolean): void {
    isGenerating = loading;
    preview.classList.toggle('loading', loading);
    regenBtn.disabled = loading;
    keepBtn.disabled = loading;
    revertBtn.disabled = loading;
    promptInput.disabled = loading;
    status.textContent = loading ? 'Generating artwork...' : '';
  }

  async function handleRegenerate(): Promise<void> {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      showToast?.('Please enter a prompt', 'error');
      return;
    }

    setLoading(true);

    try {
      const url = await generateThumbnail(prompt);
      currentUrl = url;
      hasChanges = true;
      updatePreview();
      updateButtons();
      status.textContent = 'New artwork generated - Keep or Revert?';
      showToast?.('Artwork generated', 'success');
    } catch (err) {
      console.error('Thumbnail generation failed:', err);
      status.textContent = 'Generation failed';
      showToast?.('Failed to generate artwork', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleKeep(): void {
    if (currentUrl) {
      originalUrl = currentUrl;
      originalPrompt = promptInput.value.trim();
      hasChanges = false;
      updateButtons();
      onSave?.(currentUrl, originalPrompt);
      status.textContent = 'Artwork saved';
      showToast?.('Artwork saved', 'success');
    }
  }

  function handleRevert(): void {
    currentUrl = originalUrl;
    promptInput.value = originalPrompt;
    hasChanges = false;
    updatePreview();
    updateButtons();
    status.textContent = 'Reverted to previous artwork';
  }

  function open(): void {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close(): void {
    if (hasChanges) {
      // Revert unsaved changes on close
      currentUrl = originalUrl;
      promptInput.value = originalPrompt;
      hasChanges = false;
    }
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    onCancel?.();
  }

  function setThumbnail(url: string | null, prompt?: string): void {
    currentUrl = url;
    originalUrl = url;
    if (prompt !== undefined) {
      originalPrompt = prompt;
      promptInput.value = prompt;
    }
    hasChanges = false;
    updatePreview();
    updateButtons();
  }

  function destroy(): void {
    overlay.remove();
  }

  // Event listeners
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      close();
    }
  });
  regenBtn.addEventListener('click', handleRegenerate);
  keepBtn.addEventListener('click', handleKeep);
  revertBtn.addEventListener('click', handleRevert);

  // Initial state
  updatePreview();
  updateButtons();

  return {
    element: overlay,
    open,
    close,
    setThumbnail,
    destroy
  };
}
