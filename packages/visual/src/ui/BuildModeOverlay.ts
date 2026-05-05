import type { IndoorAssetDef } from '../content/IndoorAssetLibrary';
import type { SceneDraftRecord } from '../editor/core/SceneRepository';
import type { EditableSceneSnapshot, PlacedSceneObject } from '../editor/schema/SceneSchema';

export type BuildModeOverlayState = {
  active: boolean;
  sceneId: string | null;
  assets: IndoorAssetDef[];
  snapshot: EditableSceneSnapshot | null;
  selectedObject: PlacedSceneObject | null;
  pendingAssetId: string | null;
  draft: SceneDraftRecord | null;
  advanced: boolean;
  maskActive: boolean;
  previewMode: boolean;
};

export type BuildEditableField = 'positionX' | 'positionY' | 'scale' | 'layer' | 'colliderEnabled';

export type BuildFieldValue = string | number | boolean;

export type BuildModeOverlayActions = {
  onSelectAsset(assetId: string): void;
  onSelectObject(objectId: string): void;
  onDeleteSelected(): void;
  onDuplicateSelected(): void;
  onResetScene(): void;
  onExportScene(): void;
  onToggleAdvanced(): void;
  onToggleMask(): void;
  onTogglePreview(): void;
  onSelectMode(): void;
  onUpdateSelectedField(field: BuildEditableField, value: BuildFieldValue): void;
  onExit(): void;
};

export class BuildModeOverlay {
  private root: HTMLDivElement;
  private toastTimer: number | null = null;
  private lastState: BuildModeOverlayState | null = null;
  private inspectorTab: 'props' | 'objects' = 'props';

  constructor(private actions: BuildModeOverlayActions) {
    const container = document.getElementById('game-container') ?? document.body;
    this.root = document.createElement('div');
    this.root.className = 'build-overlay';
    this.root.style.display = 'none';
    container.appendChild(this.root);
  }

  destroy(): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.root.remove();
  }

  render(state: BuildModeOverlayState): void {
    this.lastState = state;
    if (!state.active) {
      this.root.style.display = 'none';
      this.root.innerHTML = '';
      return;
    }

    this.root.style.display = 'block';
    const objectCount = state.snapshot?.objects.length ?? 0;
    const selected = state.selectedObject;
    const draftTime = state.draft ? new Date(state.draft.savedAt).toLocaleTimeString() : '未保存';
    const activeAsset = state.assets.find((asset) => asset.id === state.pendingAssetId);

    this.root.innerHTML = `
      <div class="build-topbar">
        <div class="build-brand">
          <span class="build-seal">造</span>
          <div>
            <strong>宅邸建造</strong>
            <em>${escapeHtml(state.sceneId ?? '未进入室内')} · ${objectCount} 件</em>
          </div>
        </div>
        <div class="build-tools" role="toolbar" aria-label="建造工具">
          <button class="${!state.pendingAssetId ? 'is-active' : ''}" data-action="select">选择</button>
          <button class="${state.pendingAssetId ? 'is-active' : ''}" disabled>放置</button>
          <button class="${state.maskActive ? 'is-active' : ''}" data-action="mask">碰撞</button>
          <button class="${state.previewMode ? 'is-active' : ''}" data-action="preview">预览</button>
          <button data-action="export">导出</button>
          <button class="ghost" data-action="advanced">${state.advanced ? '收起调试' : '调试'}</button>
          <button class="danger" data-action="exit">退出</button>
        </div>
      </div>

      <aside class="build-sidebar build-assets">
        <div class="build-panel-head">
          <span>素材库</span>
          <small>${activeAsset ? `下一步：在房间中点击放置 ${escapeHtml(activeAsset.name)}` : '选择素材开始布置'}</small>
        </div>
        ${this.renderAssetGroups(state.assets, state.pendingAssetId)}
      </aside>

      <aside class="build-sidebar build-inspector">
        <div class="build-tabs">
          <button class="${this.inspectorTab === 'props' ? 'is-active' : ''}" data-tab="props">属性</button>
          <button class="${this.inspectorTab === 'objects' ? 'is-active' : ''}" data-tab="objects">对象 ${objectCount}</button>
        </div>
        ${this.inspectorTab === 'props'
          ? this.renderInspector(selected, state.advanced)
          : this.renderObjectList(state.snapshot?.objects ?? [], selected?.id ?? null, state.advanced)}
      </aside>

      <div class="build-statusbar">
        <strong>${state.previewMode ? '预览中' : activeAsset ? `放置：${escapeHtml(activeAsset.name)}` : selected ? `选中：${escapeHtml(displayObjectName(selected))}` : '选择或放置对象'}</strong>
        <span>自动保存 ${escapeHtml(draftTime)}</span>
        <span>${objectCount} 个对象</span>
        <button data-action="duplicate">复制</button>
        <button data-action="delete">删除</button>
        <button data-action="reset">恢复默认</button>
      </div>
    `;

    this.bindEvents();
  }

  showToast(message: string): void {
    if (!this.lastState?.active) return;
    let toast = this.root.querySelector<HTMLDivElement>('.build-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'build-toast';
      this.root.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toast?.classList.remove('show'), 1600);
  }

  private renderAssetGroups(assets: IndoorAssetDef[], pendingAssetId: string | null): string {
    const groups: Array<{ key: IndoorAssetDef['kind']; label: string }> = [
      { key: 'character', label: '人物' },
      { key: 'wallDecor', label: '墙贴' },
    ];
    return groups.map((group) => {
      const items = assets.filter((asset) => asset.kind === group.key);
      return `
        <section class="build-asset-group">
          <h4>${group.label}</h4>
          <div class="build-asset-grid">
            ${items.map((asset) => `
              <button class="build-asset-card ${asset.id === pendingAssetId ? 'is-active' : ''}" data-asset-id="${escapeAttr(asset.id)}">
                <img src="${escapeAttr(asset.src)}" alt="" loading="lazy" />
                <span>${escapeHtml(asset.name)}</span>
              </button>
            `).join('')}
          </div>
        </section>
      `;
    }).join('');
  }

  private renderInspector(object: PlacedSceneObject | null, advanced: boolean): string {
    if (!object) {
      return `
        <div class="build-empty">
          <b>未选中对象</b>
          <span>从左侧选择素材放置，或点击场景/对象列表选择已有对象。</span>
        </div>
      `;
    }
    return `
      <section class="build-current-card">
        <div class="build-current-title">
          <span>${kindLabel(object)}</span>
          <strong>${escapeHtml(displayObjectName(object))}</strong>
        </div>
        <div class="build-edit-form">
          <label>
            <span>X</span>
            <input data-field="positionX" type="number" step="0.1" value="${fmt(object.position.x)}" />
          </label>
          <label>
            <span>Y</span>
            <input data-field="positionY" type="number" step="0.1" value="${fmt(object.position.y)}" />
          </label>
          <label>
            <span>缩放</span>
            <input data-field="scale" type="number" step="0.01" min="0.05" value="${fmt(object.transform?.scale ?? 1)}" ${object.kind === 'interactable' ? 'disabled' : ''} />
          </label>
          <label>
            <span>图层</span>
            <select data-field="layer" ${object.kind === 'indoorFurniture' || object.kind === 'wallDecor' ? '' : 'disabled'}>
              <option value="object" ${object.layer === 'object' ? 'selected' : ''}>物件</option>
              <option value="wall" ${object.layer === 'wall' ? 'selected' : ''}>墙面</option>
            </select>
          </label>
          <label class="build-check">
            <span>碰撞</span>
            <input data-field="colliderEnabled" type="checkbox" ${object.collider ? 'checked' : ''} ${object.kind === 'interactable' ? 'disabled' : ''} />
          </label>
        </div>
        ${advanced ? `
          <details class="build-debug" open>
            <summary>高级数据</summary>
            <code>id: ${escapeHtml(object.id)}</code>
            <code>asset: ${escapeHtml(object.assetId ?? '-')}</code>
            <code>kind: ${escapeHtml(object.kind)}</code>
          </details>
        ` : ''}
      </section>
    `;
  }

  private renderObjectList(objects: PlacedSceneObject[], selectedId: string | null, advanced: boolean): string {
    return `
      <section class="build-object-list">
        <div class="build-panel-head compact">
          <span>场景对象</span>
          <small>${advanced ? 'scene_objects' : '点击选中'}</small>
        </div>
        <div class="build-object-scroll">
          ${objects.map((object) => `
            <button class="build-object-row ${object.id === selectedId ? 'is-active' : ''}" data-object-id="${escapeAttr(object.id)}">
              <span>${kindLabel(object)}</span>
              <b>${escapeHtml(displayObjectName(object))}</b>
              <em>${escapeHtml(object.layer)}</em>
            </button>
          `).join('')}
        </div>
      </section>
    `;
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLElement>('[data-asset-id]').forEach((el) => {
      el.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        const assetId = el.dataset.assetId;
        if (assetId) this.actions.onSelectAsset(assetId);
      });
    });
    this.root.querySelectorAll<HTMLElement>('[data-object-id]').forEach((el) => {
      el.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        const objectId = el.dataset.objectId;
        if (objectId) this.actions.onSelectObject(objectId);
      });
    });
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => {
      el.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        const tab = el.dataset.tab;
        if (tab === 'props' || tab === 'objects') {
          this.inspectorTab = tab;
          if (this.lastState) this.render(this.lastState);
        }
      });
    });
    this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach((el) => {
      el.addEventListener('change', (event) => {
        event.stopPropagation();
        const field = el.dataset.field as BuildEditableField | undefined;
        if (!field) return;
        const value = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
        this.actions.onUpdateSelectedField(field, value);
      });
      el.addEventListener('pointerdown', (event) => event.stopPropagation());
      el.addEventListener('keydown', (event) => event.stopPropagation());
    });
    this.root.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      el.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        const action = el.dataset.action;
        if (action === 'select') this.actions.onSelectMode();
        if (action === 'delete') this.actions.onDeleteSelected();
        if (action === 'duplicate') this.actions.onDuplicateSelected();
        if (action === 'reset') this.actions.onResetScene();
        if (action === 'export') this.actions.onExportScene();
        if (action === 'advanced') this.actions.onToggleAdvanced();
        if (action === 'mask') this.actions.onToggleMask();
        if (action === 'preview') this.actions.onTogglePreview();
        if (action === 'exit') this.actions.onExit();
      });
    });
  }
}

function displayObjectName(object: PlacedSceneObject): string {
  return String(object.metadata?.name ?? object.assetId ?? object.id);
}

function kindLabel(object: PlacedSceneObject): string {
  if (object.kind === 'indoorCharacter') return '人物';
  if (object.kind === 'wallDecor') return '墙贴';
  if (object.kind === 'indoorFurniture') return '家具';
  if (object.kind === 'interactable') return '交互';
  return object.kind;
}

function fmt(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : '-';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
