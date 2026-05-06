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
  editorMode: BuildEditorMode;
  tileEditingAvailable: boolean;
  tileBrushes: BuildTileBrush[];
  selectedTileBrush: string | null;
  floorOverrideCount: number;
  canUndo: boolean;
  canRedo: boolean;
};

export type BuildEditorMode = 'object' | 'tile';

export type BuildTileBrush = {
  textureKey: string;
  label: string;
  src?: string;
};

export type BuildEditableField =
  | 'positionX'
  | 'positionY'
  | 'depthX'
  | 'depthY'
  | 'scale'
  | 'rotation'
  | 'layer'
  | 'colliderEnabled'
  | 'colliderMinX'
  | 'colliderMaxX'
  | 'colliderMinY'
  | 'colliderMaxY'
  | 'interactRadius'
  | 'interactionMinX'
  | 'interactionMaxX'
  | 'interactionMinY'
  | 'interactionMaxY';

export type BuildFieldValue = string | number | boolean;

export type BuildModeOverlayActions = {
  onSetEditorMode(mode: BuildEditorMode): void;
  onSelectAsset(assetId: string): void;
  onSelectTileBrush(textureKey: string | null): void;
  onSelectObject(objectId: string): void;
  onDeleteSelected(): void;
  onDuplicateSelected(): void;
  onResetScene(): void;
  onExportScene(): void;
  onToggleAdvanced(): void;
  onToggleMask(): void;
  onTogglePreview(): void;
  onSelectMode(): void;
  onUndo(): void;
  onRedo(): void;
  onResetCollider(): void;
  onClearCollider(): void;
  onUpdateSelectedField(field: BuildEditableField, value: BuildFieldValue): void;
  onExit(): void;
};

export class BuildModeOverlay {
  private root: HTMLDivElement;
  private toastTimer: number | null = null;
  private lastState: BuildModeOverlayState | null = null;
  private inspectorTab: 'props' | 'objects' = 'props';
  private assetFilter = '';
  private objectFilter = '';

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
    const isObjectMode = state.editorMode === 'object';

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
          <div class="build-segment">
            <button class="${state.editorMode === 'object' ? 'is-active' : ''}" data-mode="object">对象</button>
            <button class="${state.editorMode === 'tile' ? 'is-active' : ''}" data-mode="tile" ${state.tileEditingAvailable ? '' : 'disabled'}>瓦片</button>
          </div>
          <button class="${!state.pendingAssetId && isObjectMode ? 'is-active' : ''}" data-action="select" ${isObjectMode ? '' : 'disabled'}>选择</button>
          <button class="${state.pendingAssetId && isObjectMode ? 'is-active' : ''}" disabled>放置</button>
          <button class="${state.maskActive ? 'is-active' : ''}" data-action="mask">遮挡Mask</button>
          <button class="${state.previewMode ? 'is-active' : ''}" data-action="preview">预览</button>
          <button data-action="export">导出</button>
          <button class="ghost" data-action="advanced">${state.advanced ? '收起调试' : '调试'}</button>
          <button class="danger" data-action="exit">退出</button>
        </div>
      </div>

      <aside class="build-sidebar build-assets">
        ${isObjectMode ? `
          <div class="build-panel-head">
            <span>素材库</span>
            <small>${activeAsset ? `下一步：在房间中点击放置 ${escapeHtml(activeAsset.name)}` : '选择素材开始布置'}</small>
          </div>
          <label class="build-search build-search-assets">
            <span>搜索素材</span>
            <input type="search" value="${escapeAttr(this.assetFilter)}" placeholder="名称 / id / 类型" data-asset-filter />
          </label>
          ${this.renderAssetGroups(state.assets, state.pendingAssetId)}
        ` : this.renderTilePalette(state.tileBrushes, state.selectedTileBrush, state.tileEditingAvailable)}
      </aside>

      <aside class="build-sidebar build-inspector">
        ${isObjectMode ? `
          <div class="build-tabs">
            <button class="${this.inspectorTab === 'props' ? 'is-active' : ''}" data-tab="props">属性</button>
            <button class="${this.inspectorTab === 'objects' ? 'is-active' : ''}" data-tab="objects">对象 ${objectCount}</button>
          </div>
          ${this.inspectorTab === 'props'
            ? this.renderInspector(selected, state.advanced)
            : this.renderObjectList(state.snapshot?.objects ?? [], selected?.id ?? null, state.advanced)}
        ` : this.renderTileInspector(state)}
      </aside>

      <div class="build-statusbar">
        <strong>${state.previewMode
          ? '预览中'
          : isObjectMode
            ? activeAsset ? `放置：${escapeHtml(activeAsset.name)}` : selected ? `选中：${escapeHtml(displayObjectName(selected))}` : '选择或放置对象'
            : state.selectedTileBrush ? `地板笔刷：${escapeHtml(tileBrushLabel(state.tileBrushes, state.selectedTileBrush))}` : '地板橡皮：点击恢复默认瓦片'}</strong>
        <span>自动保存 ${escapeHtml(draftTime)}</span>
        <span>${isObjectMode ? `${objectCount} 个对象` : `${state.floorOverrideCount} 个地板覆盖`}</span>
        <button data-action="undo" ${state.canUndo ? '' : 'disabled'}>撤销</button>
        <button data-action="redo" ${state.canRedo ? '' : 'disabled'}>重做</button>
        <button data-action="duplicate" ${isObjectMode ? '' : 'disabled'}>复制</button>
        <button data-action="delete" ${isObjectMode ? '' : 'disabled'}>删除</button>
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
    const filteredAssets = assets.filter((asset) => matchesAssetFilter(asset, this.assetFilter));
    const groups: Array<{ key: IndoorAssetDef['kind']; label: string }> = [
      { key: 'furniture', label: '家具' },
      { key: 'character', label: '人物' },
      { key: 'wallDecor', label: '墙贴' },
    ];
    const content = groups.map((group) => {
      const items = filteredAssets.filter((asset) => asset.kind === group.key);
      if (items.length === 0) return '';
      return `
        <section class="build-asset-group">
          <h4>${group.label} <small>${items.length}</small></h4>
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
    return content || `
      <div class="build-empty build-empty-inline">
        <b>没有匹配素材</b>
        <span>清空搜索后查看全部可放置素材。</span>
      </div>
    `;
  }

  private renderTilePalette(
    brushes: BuildTileBrush[],
    selectedTileBrush: string | null,
    tileEditingAvailable: boolean,
  ): string {
    if (!tileEditingAvailable) {
      return `
        <div class="build-empty">
          <b>当前房间不支持瓦片编辑</b>
          <span>这版只对带固定地板模板的室内场景开放 floor brush。</span>
        </div>
      `;
    }
    return `
      <div class="build-panel-head">
        <span>地板笔刷</span>
        <small>${selectedTileBrush ? `当前：${escapeHtml(tileBrushLabel(brushes, selectedTileBrush))}` : '当前：橡皮'}</small>
      </div>
      <div class="build-asset-group">
        <div class="build-tile-grid">
          <button class="build-asset-card ${selectedTileBrush === null ? 'is-active' : ''}" data-tile-brush="__erase__">
            <span>恢复默认</span>
          </button>
          ${brushes.map((brush) => `
            <button class="build-asset-card ${brush.textureKey === selectedTileBrush ? 'is-active' : ''}" data-tile-brush="${escapeAttr(brush.textureKey)}">
              <img src="${escapeAttr(tileBrushSrc(brush))}" alt="" loading="lazy" />
              <span>${escapeHtml(brush.label)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
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
    const supportsDepth = supportsDepthEdit(object);
    const supportsScale = supportsScaleEdit(object);
    const supportsRotation = supportsRotationEdit(object);
    const supportsLayer = supportsLayerEdit(object);
    const supportsCollider = supportsColliderEdit(object);
    const depthPoint = object.depth?.point;
    const depthX = depthPoint?.x ?? object.position.x;
    const depthY = depthPoint?.y ?? object.position.y;
    const rotation = object.transform?.rotation ?? 0;
    const collider = rectColliderBounds(object);
    const editableCollider = collider ?? defaultColliderBounds(object);
    const interaction = rectInteractionBounds(object);
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
            <input data-field="scale" type="number" step="0.01" min="0.05" value="${fmt(object.transform?.scale ?? 1, 2)}" ${supportsScale ? '' : 'disabled'} />
          </label>
          <label>
            <span>Depth X</span>
            <input data-field="depthX" type="number" step="0.1" value="${fmt(depthX)}" ${supportsDepth ? '' : 'disabled'} />
          </label>
          <label>
            <span>Depth Y</span>
            <input data-field="depthY" type="number" step="0.1" value="${fmt(depthY)}" ${supportsDepth ? '' : 'disabled'} />
          </label>
          <label>
            <span>旋转</span>
            <input data-field="rotation" type="number" step="0.1" value="${fmt(rotation)}" ${supportsRotation ? '' : 'disabled'} />
          </label>
          <label>
            <span>图层</span>
            <select data-field="layer" ${supportsLayer ? '' : 'disabled'}>
              ${supportsLayer
                ? `
                  <option value="object" ${object.layer === 'object' ? 'selected' : ''}>物件</option>
                  <option value="wall" ${object.layer === 'wall' ? 'selected' : ''}>墙面</option>
                `
                : `<option value="${escapeAttr(object.layer)}" selected>${escapeHtml(sceneLayerLabel(object.layer))}</option>`}
            </select>
          </label>
          <label class="build-check">
            <span>启用实体碰撞</span>
            <input data-field="colliderEnabled" type="checkbox" ${object.collider ? 'checked' : ''} ${supportsCollider ? '' : 'disabled'} />
          </label>
          ${supportsCollider ? `
            <div class="build-form-section">
              <div class="build-section-title">
                <span>实体碰撞框</span>
                <small>${collider ? '可拖画面角点，也可输入坐标' : '输入坐标或点重置会自动启用'}</small>
              </div>
              <div class="build-inline-actions">
                <button data-action="collider-reset">重置 1x1</button>
                <button data-action="collider-clear" class="danger" ${collider ? '' : 'disabled'}>清除碰撞</button>
              </div>
              <div class="build-collider-grid">
                <label>
                  <span>minX</span>
                  <input data-field="colliderMinX" type="number" step="0.1" value="${fmt(editableCollider.minX)}" />
                </label>
                <label>
                  <span>maxX</span>
                  <input data-field="colliderMaxX" type="number" step="0.1" value="${fmt(editableCollider.maxX)}" />
                </label>
                <label>
                  <span>minY</span>
                  <input data-field="colliderMinY" type="number" step="0.1" value="${fmt(editableCollider.minY)}" />
                </label>
                <label>
                  <span>maxY</span>
                  <input data-field="colliderMaxY" type="number" step="0.1" value="${fmt(editableCollider.maxY)}" />
                </label>
              </div>
            </div>
          ` : ''}
          ${object.kind === 'interactable' ? `
            <div class="build-form-section">
              <div class="build-section-title">
                <span>交互范围</span>
                <small>${interaction ? '本地格坐标' : '当前只使用中心点/半径'}</small>
              </div>
              <label>
                <span>半径</span>
                <input data-field="interactRadius" type="number" step="0.1" min="0" value="${fmt(object.interaction?.radius ?? 0, 1)}" />
              </label>
              <div class="build-collider-grid">
                <label>
                  <span>minX</span>
                  <input data-field="interactionMinX" type="number" step="0.1" value="${fmt(interaction?.minX ?? NaN)}" ${interaction ? '' : ''} />
                </label>
                <label>
                  <span>maxX</span>
                  <input data-field="interactionMaxX" type="number" step="0.1" value="${fmt(interaction?.maxX ?? NaN)}" ${interaction ? '' : ''} />
                </label>
                <label>
                  <span>minY</span>
                  <input data-field="interactionMinY" type="number" step="0.1" value="${fmt(interaction?.minY ?? NaN)}" ${interaction ? '' : ''} />
                </label>
                <label>
                  <span>maxY</span>
                  <input data-field="interactionMaxY" type="number" step="0.1" value="${fmt(interaction?.maxY ?? NaN)}" ${interaction ? '' : ''} />
                </label>
              </div>
            </div>
            ${this.renderInteractableMeta(object)}
          ` : ''}
        </div>
        ${this.renderInspectorHints(object)}
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
    const filteredObjects = objects.filter((object) => matchesObjectFilter(object, this.objectFilter));
    return `
      <section class="build-object-list">
        <div class="build-panel-head compact">
          <span>场景对象</span>
          <small>${advanced ? `scene_objects · ${filteredObjects.length}/${objects.length}` : `${filteredObjects.length}/${objects.length} 已显示`}</small>
        </div>
        <label class="build-search">
          <span>搜索</span>
          <input type="search" value="${escapeAttr(this.objectFilter)}" placeholder="名称 / id / 图层 / 类型" data-object-filter />
        </label>
        <div class="build-object-scroll">
          ${filteredObjects.length > 0
            ? filteredObjects.map((object) => `
              <button class="build-object-row ${object.id === selectedId ? 'is-active' : ''}" data-object-id="${escapeAttr(object.id)}">
                <span>${kindLabel(object)}</span>
                <b>${escapeHtml(displayObjectName(object))}</b>
                <em>${escapeHtml(object.layer)}</em>
              </button>
            `).join('')
            : `
              <div class="build-empty build-empty-inline">
                <b>没有匹配项</b>
                <span>换个关键词，或清空搜索查看全部对象。</span>
              </div>
            `}
        </div>
      </section>
    `;
  }

  private renderTileInspector(state: BuildModeOverlayState): string {
    return `
      <section class="build-current-card">
        <div class="build-current-title">
          <span>地板层</span>
          <strong>${state.tileEditingAvailable ? '单点绘制' : '未开放'}</strong>
        </div>
        <div class="build-field-hints">
          <small>${state.selectedTileBrush ? `当前笔刷：${escapeHtml(tileBrushLabel(state.tileBrushes, state.selectedTileBrush))}` : '当前是橡皮：点击地板恢复模板默认瓦片。'}</small>
          <small>${state.tileEditingAvailable ? '这版只编辑 floor 层，点击室内地面菱形单格生效。' : '当前室内没有固定地板模板，后续再接通通用瓦片层。'}</small>
          <small>已覆盖 ${state.floorOverrideCount} 个地板格。</small>
        </div>
      </section>
    `;
  }

  private renderInspectorHints(object: PlacedSceneObject): string {
    const hints: string[] = [];
    if (!supportsDepthEdit(object)) hints.push('交互区暂不支持独立 depth 锚点。');
    if (!supportsScaleEdit(object)) hints.push('交互区缩放由交互框尺寸控制。');
    if (!supportsRotationEdit(object)) hints.push('当前只有家具和墙贴支持旋转。');
    if (!supportsLayerEdit(object)) hints.push('人物和交互区图层由系统接管，不建议手改。');
    if (!supportsColliderEdit(object)) hints.push('交互区使用独立 interaction zone，不走实体碰撞。');
    if (hints.length === 0) return '';
    return `
      <div class="build-field-hints">
        ${hints.map((hint) => `<small>${escapeHtml(hint)}</small>`).join('')}
      </div>
    `;
  }

  private renderInteractableMeta(object: PlacedSceneObject): string {
    if (object.kind !== 'interactable') return '';
    const action = object.metadata?.action as { type?: string; dialogueId?: string; manualId?: string } | undefined;
    const rows: Array<[string, string]> = [
      ['触发类型', String(object.interaction?.type ?? '-')],
      ['目标', String(object.interaction?.targetId ?? action?.dialogueId ?? action?.manualId ?? '-')],
      ['提示', String(object.metadata?.prompt ?? '-')],
      ['行为', String(action?.type ?? '-')],
    ];
    return `
      <div class="build-form-section">
        <div class="build-section-title">
          <span>行为信息</span>
          <small>当前只读</small>
        </div>
        <div class="build-meta-list">
          ${rows.map(([label, value]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <b>${escapeHtml(value)}</b>
            </div>
          `).join('')}
        </div>
      </div>
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
    this.root.querySelectorAll<HTMLElement>('[data-tile-brush]').forEach((el) => {
      el.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        const textureKey = el.dataset.tileBrush;
        this.actions.onSelectTileBrush(textureKey === '__erase__' ? null : textureKey ?? null);
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
    this.root.querySelectorAll<HTMLElement>('[data-mode]').forEach((el) => {
      el.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        const mode = el.dataset.mode;
        if (mode === 'object' || mode === 'tile') this.actions.onSetEditorMode(mode);
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
    this.root.querySelectorAll<HTMLInputElement>('[data-asset-filter]').forEach((el) => {
      el.addEventListener('input', (event) => {
        event.stopPropagation();
        this.assetFilter = el.value;
        if (this.lastState) this.render(this.lastState);
      });
      el.addEventListener('pointerdown', (event) => event.stopPropagation());
      el.addEventListener('keydown', (event) => event.stopPropagation());
    });
    this.root.querySelectorAll<HTMLInputElement>('[data-object-filter]').forEach((el) => {
      el.addEventListener('input', (event) => {
        event.stopPropagation();
        this.objectFilter = el.value;
        if (this.lastState) this.render(this.lastState);
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
        if (action === 'undo') this.actions.onUndo();
        if (action === 'redo') this.actions.onRedo();
        if (action === 'collider-reset') this.actions.onResetCollider();
        if (action === 'collider-clear') this.actions.onClearCollider();
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

function sceneLayerLabel(layer: PlacedSceneObject['layer']): string {
  if (layer === 'object') return '物件';
  if (layer === 'wall') return '墙面';
  if (layer === 'character') return '角色';
  if (layer === 'interaction') return '交互';
  return layer;
}

function supportsDepthEdit(object: PlacedSceneObject): boolean {
  return object.kind === 'indoorFurniture' || object.kind === 'wallDecor' || object.kind === 'indoorCharacter';
}

function supportsScaleEdit(object: PlacedSceneObject): boolean {
  return object.kind !== 'interactable';
}

function supportsRotationEdit(object: PlacedSceneObject): boolean {
  return object.kind === 'indoorFurniture' || object.kind === 'wallDecor';
}

function supportsLayerEdit(object: PlacedSceneObject): boolean {
  return object.kind === 'indoorFurniture' || object.kind === 'wallDecor';
}

function supportsColliderEdit(object: PlacedSceneObject): boolean {
  return object.kind !== 'interactable';
}

function rectColliderBounds(object: PlacedSceneObject): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (object.collider?.type !== 'rect') return null;
  return {
    minX: object.collider.x,
    maxX: object.collider.x + object.collider.width,
    minY: object.collider.y,
    maxY: object.collider.y + object.collider.height,
  };
}

function defaultColliderBounds(object: PlacedSceneObject): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: object.position.x - 0.5,
    maxX: object.position.x + 0.5,
    minY: object.position.y - 0.5,
    maxY: object.position.y + 0.5,
  };
}

function rectInteractionBounds(object: PlacedSceneObject): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (object.interaction?.zone?.type !== 'rect') return null;
  return {
    minX: object.interaction.zone.x,
    maxX: object.interaction.zone.x + object.interaction.zone.width,
    minY: object.interaction.zone.y,
    maxY: object.interaction.zone.y + object.interaction.zone.height,
  };
}

function matchesAssetFilter(asset: IndoorAssetDef, filter: string): boolean {
  const keyword = filter.trim().toLowerCase();
  if (!keyword) return true;
  const haystack = [
    asset.name,
    asset.id,
    asset.kind,
    asset.sceneObjectKind,
    asset.textureKey,
    asset.category,
  ].join(' ').toLowerCase();
  return haystack.includes(keyword);
}

function tileBrushSrc(brush: BuildTileBrush): string {
  const textureKey = brush.textureKey;
  if (brush.src) return brush.src;
  if (textureKey.startsWith('smap_')) {
    const tileId = textureKey.slice(5).padStart(4, '0');
    return `assets/jy-runtime/10_smap/${tileId}.png`;
  }
  return textureKey;
}

function tileBrushLabel(brushes: BuildTileBrush[], textureKey: string): string {
  return brushes.find((brush) => brush.textureKey === textureKey)?.label ?? textureKey;
}

function matchesObjectFilter(object: PlacedSceneObject, filter: string): boolean {
  const keyword = filter.trim().toLowerCase();
  if (!keyword) return true;
  const haystack = [
    displayObjectName(object),
    object.id,
    object.assetId ?? '',
    object.layer,
    kindLabel(object),
    String(object.metadata?.textureKey ?? ''),
  ].join(' ').toLowerCase();
  return haystack.includes(keyword);
}

function fmt(value: number, fractionDigits = 1): string {
  return Number.isFinite(value) ? value.toFixed(fractionDigits) : '';
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
