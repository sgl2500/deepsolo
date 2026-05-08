import {
  BATTLE_CHARACTER_STANCES,
  BATTLE_CHARACTER_VISUALS,
  type BattleCharacterStance,
  type BattleCharacterVisualDef,
} from '../content/BattleAssetCatalog';

type PreviewAction = BattleCharacterStance;
type PreviewMode = 'registered' | 'sheet';

interface SheetPreviewConfig {
  actionName: string;
  src: string;
  frameCount: number;
  columns: number;
  rows: number;
  frameIntervalMs: number;
  impactFrame: number;
}

const SHEET_STORAGE_KEY = 'deepsolo_battle_sheet_preview_v1';

const DEFAULT_SHEET_CONFIG: SheetPreviewConfig = {
  actionName: 'attack',
  src: 'assets/characters/player3/battle/actions/source/attack_sheet.png',
  frameCount: 8,
  columns: 8,
  rows: 1,
  frameIntervalMs: 120,
  impactFrame: 5,
};

export class BattleActionPreviewOverlay {
  private root: HTMLDivElement;
  private active = false;
  private mode: PreviewMode = 'registered';
  private selectedVisualId: string = BATTLE_CHARACTER_VISUALS[0]?.id ?? 'player3';
  private selectedAction: PreviewAction = 'attack';
  private frameIndex = 0;
  private playing = true;
  private frameIntervalMs = 140;
  private flipped = false;
  private showFootLine = true;
  private cacheVersion = Date.now();
  private timer: number | null = null;
  private sheetConfig: SheetPreviewConfig = loadSheetConfig();

  constructor() {
    const container = document.getElementById('game-container') ?? document.body;
    this.root = document.createElement('div');
    this.root.className = 'battle-action-preview-overlay';
    this.root.style.display = 'none';
    container.appendChild(this.root);
  }

  isActive(): boolean {
    return this.active;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.stopTimer();
    this.render();
  }

  toggle(): void {
    this.setActive(!this.active);
  }

  destroy(): void {
    this.stopTimer();
    this.root.remove();
  }

  private render(): void {
    if (!this.active) {
      this.root.style.display = 'none';
      this.root.innerHTML = '';
      return;
    }

    const visual = this.getSelectedVisual();
    const frames = this.getFrameSources(visual, this.selectedAction);
    const totalFrames = this.getCurrentFrameCount(frames.length);
    this.frameIndex = clamp(this.frameIndex, 0, Math.max(0, totalFrames - 1));
    const currentSrc = frames[this.frameIndex] ?? frames[0] ?? '';

    this.root.style.display = 'block';
    this.root.innerHTML = `
      <section class="battle-action-preview-panel">
        <header class="battle-action-preview-head">
          <span class="battle-action-preview-seal">帧</span>
          <div>
            <strong>动作帧编辑器</strong>
            <em>F10 / Esc 关闭 · 用同一套面板调试角色动作、怪物动作、技能特效</em>
          </div>
          <button data-action="exit" aria-label="关闭">×</button>
        </header>

        <div class="battle-action-preview-body">
          <aside class="battle-action-preview-controls">
            <label>
              <span>编辑模式</span>
              <select data-field="mode">
                <option value="registered" ${this.mode === 'registered' ? 'selected' : ''}>已接入资源</option>
                <option value="sheet" ${this.mode === 'sheet' ? 'selected' : ''}>Sprite Sheet</option>
              </select>
            </label>

            ${this.mode === 'registered' ? this.renderRegisteredControls(visual, frames, currentSrc) : this.renderSheetControls()}

            <label class="battle-action-preview-check">
              <input data-field="flip" type="checkbox" ${this.flipped ? 'checked' : ''} />
              <span>水平翻转</span>
            </label>

            <label class="battle-action-preview-check">
              <input data-field="foot-line" type="checkbox" ${this.showFootLine ? 'checked' : ''} />
              <span>显示脚底线</span>
            </label>
          </aside>

          <main class="battle-action-preview-stage">
            <div class="battle-action-preview-grid"></div>
            ${this.showFootLine ? '<div class="battle-action-preview-footline"></div>' : ''}
            ${this.mode === 'registered' ? this.renderRegisteredStage(currentSrc) : this.renderSheetStage()}
          </main>
        </div>
      </section>
    `;

    this.bindEvents();
    if (this.mode === 'sheet') this.drawSheetFrame();
    this.syncTimer();
  }

  private renderRegisteredControls(visual: BattleCharacterVisualDef, frames: string[], currentSrc: string): string {
    return `
      <label>
        <span>角色视觉</span>
        <select data-field="visual">
          ${BATTLE_CHARACTER_VISUALS.map(item => `
            <option value="${escapeAttr(item.id)}" ${item.id === visual.id ? 'selected' : ''}>
              ${escapeHtml(item.id)}
            </option>
          `).join('')}
        </select>
      </label>

      <label>
        <span>动作</span>
        <select data-field="action">
          ${BATTLE_CHARACTER_STANCES.map(stance => `
            <option value="${stance}" ${stance === this.selectedAction ? 'selected' : ''}>
              ${escapeHtml(stance)}
            </option>
          `).join('')}
        </select>
      </label>

      ${this.renderPlaybackControls(this.frameIntervalMs)}

      <div class="battle-action-preview-meta">
        <b>${escapeHtml(this.selectedAction)}</b>
        <span>${frames.length > 1 ? `帧动画 ${this.frameIndex + 1}/${frames.length}` : '单张姿态'}</span>
        <small>${escapeHtml(currentSrc.replace(/\?.*$/, ''))}</small>
      </div>
    `;
  }

  private renderSheetControls(): string {
    const config = this.sheetConfig;
    const normalizedConfig = this.getNormalizedSheetConfig();
    const configJson = JSON.stringify({
      type: 'spritesheet',
      action: normalizedConfig.actionName,
      src: normalizedConfig.src,
      frameCount: normalizedConfig.frameCount,
      columns: normalizedConfig.columns,
      rows: normalizedConfig.rows,
      frameIntervalMs: normalizedConfig.frameIntervalMs,
      impactFrame: normalizedConfig.impactFrame,
    }, null, 2);
    const impactLabel = normalizedConfig.impactFrame === this.frameIndex + 1 ? ' · 当前是关键帧' : '';

    return `
      <label>
        <span>动作名</span>
        <input data-field="sheet-action" type="text" value="${escapeAttr(config.actionName)}" placeholder="attack / slash / skill_001" />
      </label>

      <label>
        <span>Sprite Sheet 路径</span>
        <input data-field="sheet-src" type="text" value="${escapeAttr(config.src)}" placeholder="assets/characters/player3/battle/actions/source/attack_sheet.png" />
      </label>

      <div class="battle-action-preview-number-grid">
        <label>
          <span>总帧数</span>
          <input data-field="sheet-frame-count" type="number" min="1" max="64" step="1" value="${config.frameCount}" />
        </label>
        <label>
          <span>列数</span>
          <input data-field="sheet-columns" type="number" min="1" max="16" step="1" value="${config.columns}" />
        </label>
        <label>
          <span>行数</span>
          <input data-field="sheet-rows" type="number" min="1" max="16" step="1" value="${config.rows}" />
        </label>
        <label>
          <span>打击帧</span>
          <input data-field="sheet-impact-frame" type="number" min="1" max="64" step="1" value="${config.impactFrame}" />
        </label>
      </div>

      ${this.renderPlaybackControls(config.frameIntervalMs)}

      <div class="battle-action-preview-meta ${impactLabel ? 'is-impact' : ''}">
        <b>${escapeHtml(normalizedConfig.actionName)}</b>
        <span>第 ${this.frameIndex + 1}/${normalizedConfig.frameCount} 帧${escapeHtml(impactLabel)}</span>
        <small>${escapeHtml(normalizedConfig.src)}</small>
      </div>

      <label class="battle-action-preview-config">
        <span>导出配置</span>
        <textarea readonly>${escapeHtml(configJson)}</textarea>
      </label>
    `;
  }

  private renderPlaybackControls(intervalMs: number): string {
    return `
      <label>
        <span>帧间隔 ${intervalMs}ms</span>
        <input data-field="speed" type="range" min="60" max="320" step="10" value="${intervalMs}" />
      </label>

      <div class="battle-action-preview-buttons">
        <button data-action="prev">上一帧</button>
        <button data-action="play">${this.playing ? '暂停' : '播放'}</button>
        <button data-action="next">下一帧</button>
        <button data-action="reload">刷新素材</button>
      </div>
    `;
  }

  private renderRegisteredStage(currentSrc: string): string {
    return `
      <img
        class="battle-action-preview-sprite ${this.flipped ? 'is-flipped' : ''}"
        src="${escapeAttr(withCacheBust(currentSrc, this.cacheVersion))}"
        alt=""
        draggable="false"
      />
    `;
  }

  private renderSheetStage(): string {
    return `
      <div class="battle-action-preview-sheet-wrap ${this.flipped ? 'is-flipped' : ''}">
        <canvas class="battle-action-preview-canvas" data-sheet-canvas></canvas>
        <span class="battle-action-preview-canvas-state" data-sheet-state>加载时序帧图...</span>
      </div>
    `;
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      el.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.handleAction(el.dataset.action ?? '');
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>('select[data-field]').forEach((el) => {
      el.addEventListener('change', (event) => {
        event.stopPropagation();
        if (el.dataset.field === 'mode') {
          this.mode = el.value as PreviewMode;
          this.frameIndex = 0;
          this.frameIntervalMs = this.mode === 'sheet' ? this.sheetConfig.frameIntervalMs : this.frameIntervalMs;
        }
        if (el.dataset.field === 'visual') {
          this.selectedVisualId = el.value;
          this.frameIndex = 0;
        }
        if (el.dataset.field === 'action') {
          this.selectedAction = el.value as PreviewAction;
          const animation = this.getSelectedVisual().animations?.find(item => item.stance === this.selectedAction);
          this.frameIntervalMs = animation?.frameIntervalMs ?? this.frameIntervalMs;
          this.frameIndex = 0;
        }
        this.render();
      });
      el.addEventListener('keydown', (event) => event.stopPropagation());
    });

    const speed = this.root.querySelector<HTMLInputElement>('input[data-field="speed"]');
    speed?.addEventListener('input', (event) => {
      event.stopPropagation();
      const nextValue = sanitizeNumber(speed.value, 60, 320, this.getActiveFrameInterval());
      if (this.mode === 'sheet') {
        this.sheetConfig.frameIntervalMs = nextValue;
        this.saveSheetConfig();
      } else {
        this.frameIntervalMs = nextValue;
      }
      this.render();
    });

    const flip = this.root.querySelector<HTMLInputElement>('input[data-field="flip"]');
    flip?.addEventListener('change', (event) => {
      event.stopPropagation();
      this.flipped = flip.checked;
      this.render();
    });

    const footLine = this.root.querySelector<HTMLInputElement>('input[data-field="foot-line"]');
    footLine?.addEventListener('change', (event) => {
      event.stopPropagation();
      this.showFootLine = footLine.checked;
      this.render();
    });

    this.root.querySelectorAll<HTMLInputElement>('input[data-field^="sheet-"]').forEach((el) => {
      el.addEventListener('change', (event) => {
        event.stopPropagation();
        this.updateSheetConfigFromControls();
        this.render();
      });
      el.addEventListener('keydown', (event) => event.stopPropagation());
    });

    this.root.querySelectorAll('button, input, select, textarea').forEach((el) => {
      el.addEventListener('keydown', (event) => event.stopPropagation());
      el.addEventListener('pointerdown', (event) => event.stopPropagation());
    });
  }

  private handleAction(action: string): void {
    const frameCount = this.getCurrentFrameCount(this.getCurrentFrames().length);
    if (action === 'exit') {
      this.setActive(false);
      return;
    }
    if (action === 'play') {
      this.playing = !this.playing;
      this.render();
      return;
    }
    if (action === 'prev') {
      this.playing = false;
      this.frameIndex = wrap(this.frameIndex - 1, frameCount);
      this.render();
      return;
    }
    if (action === 'next') {
      this.playing = false;
      this.frameIndex = wrap(this.frameIndex + 1, frameCount);
      this.render();
      return;
    }
    if (action === 'reload') {
      this.cacheVersion = Date.now();
      this.render();
    }
  }

  private drawSheetFrame(): void {
    const canvas = this.root.querySelector<HTMLCanvasElement>('[data-sheet-canvas]');
    const state = this.root.querySelector<HTMLElement>('[data-sheet-state]');
    if (!canvas) return;

    const config = this.getNormalizedSheetConfig();
    const image = new Image();
    image.onload = () => {
      const frameWidth = Math.floor(image.naturalWidth / config.columns);
      const frameHeight = Math.floor(image.naturalHeight / config.rows);
      if (frameWidth <= 0 || frameHeight <= 0) {
        if (state) state.textContent = '帧图尺寸或行列配置不对';
        return;
      }

      const maxCells = config.columns * config.rows;
      const sourceFrameIndex = clamp(this.frameIndex, 0, Math.max(0, maxCells - 1));
      const col = sourceFrameIndex % config.columns;
      const row = Math.floor(sourceFrameIndex / config.columns);
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = frameWidth;
      canvas.height = frameHeight;
      context.clearRect(0, 0, frameWidth, frameHeight);
      context.imageSmoothingEnabled = true;
      context.drawImage(
        image,
        col * frameWidth,
        row * frameHeight,
        frameWidth,
        frameHeight,
        0,
        0,
        frameWidth,
        frameHeight,
      );
      if (state) state.textContent = '';
    };
    image.onerror = () => {
      canvas.width = 1;
      canvas.height = 1;
      if (state) state.textContent = '没有加载到图片，检查 public 下路径后点刷新素材';
    };
    image.src = withCacheBust(config.src, this.cacheVersion);
  }

  private syncTimer(): void {
    this.stopTimer();
    const frameCount = this.getCurrentFrameCount(this.getCurrentFrames().length);
    if (!this.active || !this.playing || frameCount <= 1) return;
    this.timer = window.setInterval(() => {
      this.frameIndex = wrap(this.frameIndex + 1, frameCount);
      this.render();
    }, this.getActiveFrameInterval());
  }

  private stopTimer(): void {
    if (this.timer === null) return;
    window.clearInterval(this.timer);
    this.timer = null;
  }

  private getSelectedVisual(): BattleCharacterVisualDef {
    return BATTLE_CHARACTER_VISUALS.find(item => item.id === this.selectedVisualId)
      ?? BATTLE_CHARACTER_VISUALS[0];
  }

  private getCurrentFrames(): string[] {
    return this.getFrameSources(this.getSelectedVisual(), this.selectedAction);
  }

  private getFrameSources(visual: BattleCharacterVisualDef, action: PreviewAction): string[] {
    const animation = visual.animations?.find(item => item.stance === action);
    if (animation) {
      return Array.from({ length: animation.frameCount }, (_, index) =>
        `${animation.frameRoot}/${String(index).padStart(3, '0')}.png?v=1`,
      );
    }
    return [`${visual.actionRoot}/${action}.png?v=1`];
  }

  private getCurrentFrameCount(registeredFrameCount: number): number {
    if (this.mode === 'sheet') return this.getNormalizedSheetConfig().frameCount;
    return Math.max(1, registeredFrameCount);
  }

  private getActiveFrameInterval(): number {
    return this.mode === 'sheet' ? this.getNormalizedSheetConfig().frameIntervalMs : this.frameIntervalMs;
  }

  private updateSheetConfigFromControls(): void {
    const getInput = (field: string) => this.root.querySelector<HTMLInputElement>(`input[data-field="${field}"]`);
    this.sheetConfig = {
      actionName: getInput('sheet-action')?.value.trim() || DEFAULT_SHEET_CONFIG.actionName,
      src: getInput('sheet-src')?.value.trim() || DEFAULT_SHEET_CONFIG.src,
      frameCount: sanitizeNumber(getInput('sheet-frame-count')?.value, 1, 64, DEFAULT_SHEET_CONFIG.frameCount),
      columns: sanitizeNumber(getInput('sheet-columns')?.value, 1, 16, DEFAULT_SHEET_CONFIG.columns),
      rows: sanitizeNumber(getInput('sheet-rows')?.value, 1, 16, DEFAULT_SHEET_CONFIG.rows),
      frameIntervalMs: this.sheetConfig.frameIntervalMs,
      impactFrame: sanitizeNumber(getInput('sheet-impact-frame')?.value, 1, 64, DEFAULT_SHEET_CONFIG.impactFrame),
    };

    this.sheetConfig.impactFrame = clamp(this.sheetConfig.impactFrame, 1, this.sheetConfig.frameCount);
    this.frameIndex = clamp(this.frameIndex, 0, this.getNormalizedSheetConfig().frameCount - 1);
    this.saveSheetConfig();
  }

  private getNormalizedSheetConfig(): SheetPreviewConfig {
    const maxCells = Math.max(1, this.sheetConfig.columns * this.sheetConfig.rows);
    const frameCount = clamp(this.sheetConfig.frameCount, 1, maxCells);
    return {
      actionName: this.sheetConfig.actionName.trim() || DEFAULT_SHEET_CONFIG.actionName,
      src: this.sheetConfig.src.trim() || DEFAULT_SHEET_CONFIG.src,
      frameCount,
      columns: clamp(this.sheetConfig.columns, 1, 16),
      rows: clamp(this.sheetConfig.rows, 1, 16),
      frameIntervalMs: clamp(this.sheetConfig.frameIntervalMs, 60, 320),
      impactFrame: clamp(this.sheetConfig.impactFrame, 1, frameCount),
    };
  }

  private saveSheetConfig(): void {
    try {
      window.localStorage.setItem(SHEET_STORAGE_KEY, JSON.stringify(this.sheetConfig));
    } catch {
      // localStorage can be unavailable in private contexts; preview still works without persistence.
    }
  }
}

function loadSheetConfig(): SheetPreviewConfig {
  try {
    const raw = window.localStorage.getItem(SHEET_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SHEET_CONFIG };
    const parsed = JSON.parse(raw) as Partial<SheetPreviewConfig>;
    return {
      actionName: typeof parsed.actionName === 'string' ? parsed.actionName : DEFAULT_SHEET_CONFIG.actionName,
      src: typeof parsed.src === 'string' ? parsed.src : DEFAULT_SHEET_CONFIG.src,
      frameCount: sanitizeNumber(parsed.frameCount, 1, 64, DEFAULT_SHEET_CONFIG.frameCount),
      columns: sanitizeNumber(parsed.columns, 1, 16, DEFAULT_SHEET_CONFIG.columns),
      rows: sanitizeNumber(parsed.rows, 1, 16, DEFAULT_SHEET_CONFIG.rows),
      frameIntervalMs: sanitizeNumber(parsed.frameIntervalMs, 60, 320, DEFAULT_SHEET_CONFIG.frameIntervalMs),
      impactFrame: sanitizeNumber(parsed.impactFrame, 1, 64, DEFAULT_SHEET_CONFIG.impactFrame),
    };
  } catch {
    return { ...DEFAULT_SHEET_CONFIG };
  }
}

function withCacheBust(src: string, version: number): string {
  return `${src}${src.includes('?') ? '&' : '?'}preview=${version}`;
}

function sanitizeNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clamp(Math.round(numeric), min, max);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function wrap(value: number, length: number): number {
  if (length <= 0) return 0;
  return (value + length) % length;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char));
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
