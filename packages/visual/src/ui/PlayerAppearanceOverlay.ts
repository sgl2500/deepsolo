import { PLAYER_APPEARANCES } from '../content/PlayerAppearanceCatalog';
import { getSelectedPlayerAppearance } from '../systems/player/PlayerAppearanceStore';

export type PlayerAppearanceOverlayActions = {
  onSelectAppearance(id: string): void;
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
    this.root.querySelectorAll<HTMLElement>('[data-action="exit"]').forEach((el) => {
      el.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.actions.onExit();
      });
    });
  }
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
