import { PLAYER_APPEARANCES } from '../content/PlayerAppearanceCatalog';
import {
  getPlayerAppearanceTuning,
  getSelectedPlayerAppearance,
  type PlayerAppearanceTuning,
} from '../systems/player/PlayerAppearanceStore';
import { Direction } from '../types';

export type PlayerAppearanceOverlayActions = {
  onSelectAppearance(id: string): void;
  onUpdateTuning(id: string, tuning: PlayerAppearanceTuning): void;
  onResetTuning(id: string): void;
  onExit(): void;
};

export class PlayerAppearanceOverlay {
  private root: HTMLDivElement;
  private active = false;

  constructor(private actions: PlayerAppearanceOverlayActions) {
    const container = document.getElementById('game-container') ?? document.body;
    this.root = document.createElement('div');
    this.root.className = 'player-appearance-overlay';
    this.root.style.display = 'none';
    container.appendChild(this.root);
  }

  isActive(): boolean {
    return this.active;
  }

  setActive(active: boolean): void {
    this.active = active;
    this.render();
  }

  toggle(): void {
    this.setActive(!this.active);
  }

  destroy(): void {
    this.root.remove();
  }

  private render(): void {
    if (!this.active) {
      this.root.style.display = 'none';
      this.root.innerHTML = '';
      return;
    }

    const selected = getSelectedPlayerAppearance();
    const tuning = getPlayerAppearanceTuning(selected.id);
    this.root.style.display = 'block';
    this.root.innerHTML = `
      <section class="player-appearance-panel">
        <div class="player-appearance-head">
          <span class="player-appearance-seal">侠</span>
          <div>
            <strong>人物编辑</strong>
            <em>选择主角行走精灵图，地图效果实时生效</em>
          </div>
          <button data-action="exit" aria-label="关闭">×</button>
        </div>
        <div class="player-appearance-grid">
          ${PLAYER_APPEARANCES.map((item) => `
            <button class="player-appearance-card ${item.id === selected.id ? 'is-active' : ''}" data-appearance-id="${escapeAttr(item.id)}">
              <img src="${escapeAttr(item.src)}" alt="" />
              <span>${escapeHtml(item.name)}</span>
              <small>${escapeHtml(item.description)}</small>
            </button>
          `).join('')}
        </div>
        ${this.renderTuningPanel(selected, tuning)}
        <div class="player-appearance-foot">
          <span>当前：${escapeHtml(selected.name)}</span>
          <span>F4 / Esc 关闭</span>
        </div>
      </section>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLElement>('[data-appearance-id]').forEach((el) => {
      el.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        const id = el.dataset.appearanceId;
        if (!id) return;
        this.actions.onSelectAppearance(id);
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLInputElement>('[data-tune-number]').forEach((el) => {
      el.addEventListener('change', (event) => {
        event.stopPropagation();
        this.commitNumberTuning(el);
      });
      el.addEventListener('pointerdown', (event) => event.stopPropagation());
      el.addEventListener('keydown', (event) => event.stopPropagation());
    });
    this.root.querySelectorAll<HTMLInputElement>('[data-tune-sequence]').forEach((el) => {
      el.addEventListener('change', (event) => {
        event.stopPropagation();
        const selected = getSelectedPlayerAppearance();
        const sequence = parseFrameSequence(el.value);
        this.actions.onUpdateTuning(selected.id, { frameSequence: sequence.length ? sequence : undefined });
        this.render();
      });
      el.addEventListener('pointerdown', (event) => event.stopPropagation());
      el.addEventListener('keydown', (event) => event.stopPropagation());
    });
    this.root.querySelectorAll<HTMLElement>('[data-action="reset-tuning"]').forEach((el) => {
      el.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.actions.onResetTuning(getSelectedPlayerAppearance().id);
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLElement>('[data-action="exit"]').forEach((el) => {
      el.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.actions.onExit();
      });
    });
  }

  private renderTuningPanel(
    selected: ReturnType<typeof getSelectedPlayerAppearance>,
    tuning: PlayerAppearanceTuning,
  ): string {
    const directionRows = selected.directionRows;
    const sequence = selected.frameSequence ?? [];
    return `
      <div class="player-appearance-tuning">
        <div class="player-appearance-tuning-head">
          <strong>调帧 / 对齐 / 朝向</strong>
          <button data-action="reset-tuning">恢复默认</button>
        </div>
        <div class="player-appearance-tuning-grid">
          ${renderNumberInput('scale', '室外缩放', selected.scale, 0.05)}
          ${renderNumberInput('indoorScale', '室内缩放', selected.indoorScale, 0.05)}
          ${renderNumberInput('originY', '脚底锚点', selected.originY, 0.01)}
          ${renderNumberInput('worldOffsetY', '大地图Y', selected.worldOffsetY, 1)}
          ${renderNumberInput('indoorOffsetY', '室内Y', selected.indoorOffsetY, 1)}
        </div>
        <div class="player-appearance-direction-grid">
          ${renderDirectionInput(Direction.Down, '下', directionRows[Direction.Down])}
          ${renderDirectionInput(Direction.Up, '上', directionRows[Direction.Up])}
          ${renderDirectionInput(Direction.Left, '左', directionRows[Direction.Left])}
          ${renderDirectionInput(Direction.Right, '右', directionRows[Direction.Right])}
        </div>
        <label class="player-appearance-sequence">
          <span>行走序列（0-${selected.frameCount - 1}，逗号分隔）</span>
          <input data-tune-sequence value="${escapeAttr(sequence.join(','))}" placeholder="例如 0,1,0,2" />
        </label>
        <small class="player-appearance-tuning-note">
          ${Object.keys(tuning).length ? '当前外观有本地调参草稿，选择会实时保存。' : '调参会保存为本地草稿，不改原始注册表。'}
        </small>
      </div>
    `;
  }

  private commitNumberTuning(el: HTMLInputElement): void {
    const selected = getSelectedPlayerAppearance();
    const field = el.dataset.tuneNumber;
    const value = Number(el.value);
    if (!field || !Number.isFinite(value)) return;
    if (field.startsWith('direction:')) {
      const direction = Number(field.slice('direction:'.length)) as Direction;
      this.actions.onUpdateTuning(selected.id, { directionRows: { [direction]: Math.floor(value) } });
    } else {
      this.actions.onUpdateTuning(selected.id, { [field]: value } as PlayerAppearanceTuning);
    }
    this.render();
  }
}

function renderNumberInput(field: string, label: string, value: number, step: number): string {
  return `
    <label>
      <span>${label}</span>
      <input data-tune-number="${escapeAttr(field)}" type="number" step="${step}" value="${Number(value).toFixed(step < 1 ? 2 : 0)}" />
    </label>
  `;
}

function renderDirectionInput(direction: Direction, label: string, value: number): string {
  return `
    <label>
      <span>${label} 行</span>
      <input data-tune-number="direction:${direction}" type="number" min="0" step="1" value="${value}" />
    </label>
  `;
}

function parseFrameSequence(value: string): number[] {
  return value
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item))
    .map((item) => Math.floor(item));
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
