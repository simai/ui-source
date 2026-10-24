import { isPlainObject } from './canonical.mjs';
import { pageText } from '../page-language.js';
import { activeSortableSession, registerSortableDropTarget } from './sortable.mjs';
import { holdOpenSurfaceMark, isTopOpenSurface } from '../open-surface-mark.js';

// Editor canvas overlay. It draws hover and selection frames, a floating
// action toolbar and insertion points over a rendered Composition Document
// without touching the canvas DOM: the published HTML stays byte-identical.
// The host supplies node descriptions and actions and performs every change.
//
// Framed mode (attachFrame + setNodes) draws the same chrome over a same-origin
// iframe fed a flat node list: frame coordinates are mapped to the host page
// through the iframe's position, borders, padding, scale and the frame's own
// scroll, and a plain-string inline edit happens on the element inside the frame.

export const OVERLAY_EVENTS = Object.freeze({
  select: 'sf-composition-overlay-select',
  action: 'sf-composition-overlay-action',
  insert: 'sf-composition-overlay-insert',
  move: 'sf-composition-overlay-move',
  edit: 'sf-composition-overlay-edit',
});

const MESSAGES = {
  ru: { picked: 'Перемещение: {label}. Стрелки выбирают место, Enter — положить, Escape — отменить.', cancelled: 'Перемещение отменено.', tree: 'Структура страницы', toolbar: 'Действия', insert: 'Вставить', insertAt: 'Вставить в «{slot}», позиция {index}', position: '{index} из {total}', selected: 'Выбрано: {label}', editing: 'Редактирование: {label}. Enter — сохранить, Escape — отменить.' },
  en: { picked: 'Moving {label}. Arrows choose a place, Enter drops, Escape cancels.', cancelled: 'Move cancelled.', tree: 'Page structure', toolbar: 'Actions', insert: 'Insert', insertAt: 'Insert into “{slot}”, position {index}', position: '{index} of {total}', selected: 'Selected: {label}', editing: 'Editing {label}. Enter saves, Escape cancels.' },
};

const ACTION_ID = /^[a-z][a-z0-9-]{0,63}$/u;
const format = (template, values) => template.replace(/\{(\w+)\}/gu, (_, key) => String(values[key] ?? ''));

/** Flattens a Document into overlay nodes in document order. */
export function overlayNodes(document) {
  const nodes = [];
  const visit = (node, parent, slot, index, level) => {
    if (!isPlainObject(node) || typeof node.id !== 'string') return;
    const entry = { id: node.id, type: node.type, parent, slot, index, level, slots: {} };
    nodes.push(entry);
    for (const [name, children] of Object.entries(isPlainObject(node.slots) ? node.slots : {})) {
      if (!Array.isArray(children)) continue;
      entry.slots[name] = children.map((child) => child?.id).filter((id) => typeof id === 'string');
      children.forEach((child, childIndex) => visit(child, node.id, name, childIndex, level + 1));
    }
  };
  visit(document?.root, null, null, 0, 1);
  return nodes;
}

export function checkOverlayActions(actions) {
  if (!Array.isArray(actions) || actions.length > 16) throw new TypeError('Overlay actions must be a list of up to 16 entries');
  return actions.map((action) => {
    if (!isPlainObject(action) || !ACTION_ID.test(action.id || '') || typeof action.label !== 'string' || !action.label.trim()
      || Object.keys(action).some((key) => key !== 'id' && key !== 'label')) {
      throw new TypeError('Overlay actions have an opaque id and a label only');
    }
    return Object.freeze({ id: action.id, label: action.label });
  });
}

const NODE_KEYS = new Set(['id', 'kind', 'rect', 'element', 'label', 'parent', 'editable']);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
// Elements of the frame belong to another realm, so `instanceof Element` is false for them.
const isElement = (value) => Boolean(value) && typeof value === 'object' && value.nodeType === 1 && typeof value.getBoundingClientRect === 'function';

/**
 * Checks a framed canvas's flat node list: [{id, kind, rect? | element?, label?,
 * parent?, editable?}]. rect is in frame-document coordinates {x, y, width,
 * height}; element is a node inside the frame. Returns frozen entries.
 */
export function checkOverlayNodes(nodes) {
  if (!Array.isArray(nodes)) throw new TypeError('Overlay nodes must be a list');
  const seen = new Set();
  const list = nodes.map((node) => {
    if (!isPlainObject(node) || Object.keys(node).some((key) => !NODE_KEYS.has(key))) {
      throw new TypeError('Overlay nodes have id, kind, rect or element, label, parent and editable only');
    }
    if (typeof node.id !== 'string' || !node.id || seen.has(node.id)) throw new TypeError('Overlay nodes have unique non-empty string ids');
    if (typeof node.kind !== 'string' || !node.kind) throw new TypeError(`Overlay node ${node.id} names its kind`);
    const { rect, element } = node;
    if (rect !== undefined && (!isPlainObject(rect) || !['x', 'y', 'width', 'height'].every((key) => finite(rect[key])) || rect.width < 0 || rect.height < 0)) {
      throw new TypeError(`Overlay node ${node.id} has a rect {x, y, width, height} of finite numbers`);
    }
    if (element !== undefined && !isElement(element)) throw new TypeError(`Overlay node ${node.id} has an element`);
    if (rect === undefined && element === undefined) throw new TypeError(`Overlay node ${node.id} has a rect or an element`);
    if (node.label !== undefined && typeof node.label !== 'string') throw new TypeError(`Overlay node ${node.id} has a string label`);
    if (node.parent !== undefined && node.parent !== null && (typeof node.parent !== 'string' || node.parent === node.id)) {
      throw new TypeError(`Overlay node ${node.id} names another node as its parent`);
    }
    if (node.editable !== undefined && typeof node.editable !== 'boolean') throw new TypeError(`Overlay node ${node.id} has a boolean editable`);
    if (node.editable && element === undefined) throw new TypeError(`Overlay node ${node.id} is editable only with an element`);
    seen.add(node.id);
    return Object.freeze({
      id: node.id,
      kind: node.kind,
      rect: rect === undefined ? null : Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }),
      element: element ?? null,
      label: node.label ?? null,
      parent: node.parent ?? null,
      editable: node.editable === true,
    });
  });
  const byId = new Map(list.map((node) => [node.id, node]));
  for (const node of list) {
    const visited = new Set([node.id]);
    for (let parent = node.parent; parent !== null; parent = byId.get(parent).parent) {
      if (!byId.has(parent)) throw new TypeError(`Overlay node ${node.id} names a parent that is not in the list`);
      if (visited.has(parent)) throw new TypeError(`Overlay node ${node.id} is its own ancestor`);
      visited.add(parent);
    }
  }
  return Object.freeze(list);
}

/** Overlay entries for a checked flat list, in list order; the top level is parent null, slot "default". */
export function flatOverlayNodes(list) {
  const entries = list.map((node) => ({ id: node.id, type: node.kind, kind: node.kind, label: node.label, parent: node.parent, slot: 'default', index: 0, level: 1, slots: {}, flat: node }));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const counts = new Map();
  for (const entry of entries) {
    const key = entry.parent ?? '';
    entry.index = counts.get(key) || 0;
    counts.set(key, entry.index + 1);
    if (entry.parent) (byId.get(entry.parent).slots.default ||= []).push(entry.id);
    for (let parent = entry.parent; parent; parent = byId.get(parent).parent) entry.level += 1;
  }
  return entries;
}

/**
 * Where a frame's viewport lies on the host page. rect is the iframe's border box
 * on the host (after any transform or zoom), layout its untransformed border box
 * size (offsetWidth/offsetHeight), border and padding its own {top, right,
 * bottom, left} in CSS px, inner the frame's viewport size in its own px and
 * scroll the frame's scroll position. The scale is rect over layout; without a
 * layout size it is taken from the parts, which the viewport's whole-pixel size
 * makes less exact under zoom.
 */
export function frameViewport({ rect, layout = null, border, padding, inner, scroll = { x: 0, y: 0 } }) {
  const outerWidth = layout?.width > 0 ? layout.width : border.left + padding.left + inner.width + padding.right + border.right;
  const outerHeight = layout?.height > 0 ? layout.height : border.top + padding.top + inner.height + padding.bottom + border.bottom;
  const scaleX = outerWidth > 0 && rect.width > 0 ? rect.width / outerWidth : 1;
  const scaleY = outerHeight > 0 && rect.height > 0 ? rect.height / outerHeight : 1;
  return {
    left: rect.left + (border.left + padding.left) * scaleX,
    top: rect.top + (border.top + padding.top) * scaleY,
    width: inner.width * scaleX,
    height: inner.height * scaleY,
    scaleX,
    scaleY,
    scrollX: scroll.x,
    scrollY: scroll.y,
  };
}

/** A box in the frame's viewport coordinates {x, y, width, height}, mapped to the host page. */
export function frameRectToHost(box, view) {
  const left = view.left + box.x * view.scaleX;
  const top = view.top + box.y * view.scaleY;
  const width = box.width * view.scaleX;
  const height = box.height * view.scaleY;
  return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height };
}

const plainText = (element) => (element.textContent || '').replace(/\s+/gu, ' ').trim();
const px = (value) => Number.parseFloat(value) || 0;
const intersect = (a, b) => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });

export function defineCompositionOverlay(registry = globalThis.customElements) {
  if (!registry || typeof globalThis.HTMLElement !== 'function') return null;
  const existing = registry.get('sf-composition-overlay');
  if (existing) return existing;

  class SfCompositionOverlay extends globalThis.HTMLElement {
    constructor() {
      super();
      this.canvas = null;
      this.nodes = [];
      this.byId = new Map();
      this.describe = () => ({});
      this.actions = [];
      this.selectedId = null;
      this.hoverId = null;
      this.insertionTarget = null;
      this.connection = null;
      this.frameRequest = 0;
      this.resizeObserver = null;
      this.layer = null;
      this.dropFilter = () => true;
      this.moving = null;
      this.unregisterDrop = null;
      this.dropHint = null;
      this.iframe = null;
      this.frameDoc = null;
      this.frameConnection = null;
      this.view = null;
      this.elementIds = new Map();
      this.rectNodes = [];
      this.editing = null;
    }

    get messages() {
      // In the page's language through pageText, as every component's words are.
      const words = Object.fromEntries(Object.keys(MESSAGES.en).map((key) => [key, pageText(MESSAGES, key, this, 'sf-composition-overlay')]));
      return { ...words, ...(this.customMessages || {}) };
    }

    connectedCallback() {
      if (!this.layer) this.buildLayer();
      const canvasId = this.getAttribute('for');
      const frameId = this.getAttribute('frame');
      if (frameId && !this.canvas && !this.iframe) {
        const iframe = globalThis.document.getElementById(frameId);
        if (iframe) this.attachFrame(iframe);
      } else if (canvasId && !this.canvas && !this.iframe) {
        const canvas = globalThis.document.getElementById(canvasId);
        if (canvas) this.attach(canvas);
      } else if (this.canvas || this.iframe) {
        this.bind();
      }
    }

    disconnectedCallback() {
      this.unbind();
    }

    buildLayer() {
      const doc = globalThis.document;
      this.classList.add('sf-composition-overlay');
      this.layer = doc.createElement('div');
      this.layer.className = 'sf-composition-overlay-layer';
      this.layer.setAttribute('aria-hidden', 'true');
      this.hoverFrame = this.frame('hover');
      this.selectedFrame = this.frame('selected');
      this.insertionLayer = doc.createElement('div');
      this.insertionLayer.className = 'sf-composition-overlay-insertions';
      this.toolbar = doc.createElement('div');
      this.toolbar.className = 'sf-composition-overlay-toolbar';
      this.toolbar.setAttribute('role', 'toolbar');
      this.toolbar.hidden = true;
      this.tree = doc.createElement('div');
      this.tree.className = 'sf-composition-overlay-tree';
      this.tree.setAttribute('role', 'tree');
      this.tree.tabIndex = 0;
      this.live = doc.createElement('div');
      this.live.className = 'sf-composition-overlay-live';
      this.live.setAttribute('aria-live', 'polite');
      this.append(this.tree, this.toolbar, this.insertionLayer, this.layer, this.live);
      this.layer.append(this.hoverFrame, this.selectedFrame);
    }

    frame(kind) {
      const frame = globalThis.document.createElement('div');
      frame.className = `sf-composition-overlay-frame sf-composition-overlay-frame--${kind}`;
      frame.hidden = true;
      const label = globalThis.document.createElement('span');
      label.className = 'sf-composition-overlay-label';
      frame.append(label);
      return frame;
    }

    /** Binds the overlay to a rendered canvas; the canvas is never modified. */
    attach(canvas) {
      if (!(canvas instanceof globalThis.Element)) throw new TypeError('Overlay canvas must be an element');
      if (!this.layer) this.buildLayer();
      this.unbind();
      this.canvas = canvas;
      this.iframe = null;
      this.removeAttribute('data-sf-overlay-mode');
      this.layer.style.clipPath = '';
      this.insertionLayer.style.clipPath = '';
      if (this.isConnected) this.bind();
      return this;
    }

    /** Binds the overlay to a same-origin iframe canvas fed by setNodes; the frame's HTML is never modified by the overlay. */
    attachFrame(iframe) {
      if (!isElement(iframe) || iframe.localName !== 'iframe') throw new TypeError('Overlay frame must be an iframe element');
      if (!this.layer) this.buildLayer();
      this.unbind();
      this.canvas = null;
      this.iframe = iframe;
      this.setAttribute('data-sf-overlay-mode', 'frame');
      if (this.isConnected) this.bind();
      return this;
    }

    bind() {
      if (this.connection || (!this.canvas && !this.iframe)) return;
      this.connection = new AbortController();
      const options = { signal: this.connection.signal };
      const passive = { ...options, passive: true };
      if (this.iframe) {
        // A new letter (srcdoc, navigation) is a new document: listen to it again.
        this.iframe.addEventListener('load', () => this.bindFrameDocument(), options);
        this.iframe.addEventListener('pointerleave', () => this.setHover(null), passive);
      } else {
        this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event), passive);
        this.canvas.addEventListener('pointerleave', () => this.setHover(null), passive);
        this.canvas.addEventListener('click', (event) => this.onCanvasClick(event), { ...options, capture: true });
      }
      this.tree.addEventListener('keydown', (event) => this.onTreeKey(event), options);
      this.tree.addEventListener('focus', () => {
        this.setAttribute('data-sf-overlay-focus', '');
        if (!this.selectedId && this.nodes.length) this.select(this.nodes[0].id);
      }, options);
      this.tree.addEventListener('blur', () => this.removeAttribute('data-sf-overlay-focus'), options);
      this.toolbar.addEventListener('click', (event) => this.onToolbarClick(event), options);
      this.toolbar.addEventListener('keydown', (event) => this.onToolbarKey(event), options);
      this.insertionLayer.addEventListener('click', (event) => this.onInsertionClick(event), options);
      globalThis.addEventListener('scroll', () => this.schedule(), { ...passive, capture: true });
      globalThis.addEventListener('resize', () => this.schedule(), passive);
      if (typeof globalThis.ResizeObserver === 'function') {
        this.resizeObserver = new globalThis.ResizeObserver(() => this.schedule());
        this.resizeObserver.observe(this.canvas || this.iframe);
      }
      this.unregisterDrop = registerSortableDropTarget({
        resolve: (x, y, dragSession) => (this.accepts(dragSession) ? this.resolveDrop(x, y, null) : null),
        keyboardTargets: (dragSession) => (this.accepts(dragSession) ? this.dropTargets(null) : []),
        drop: (dragSession, descriptor) => this.emit(OVERLAY_EVENTS.insert, { ...descriptor, item: dragSession.item, from: dragSession.from, mode: dragSession.mode }),
        leave: () => this.showDropHint(null),
      });
      this.selectedFrame.firstChild.addEventListener('pointerdown', (event) => this.onHandleDown(event), options);
      this.setAttribute('data-sf-overlay', 'connected');
      this.renderTree();
      if (this.iframe) this.bindFrameDocument();
      this.schedule();
    }

    /** Listens to the frame's current document and window; called on bind and on every frame load. */
    bindFrameDocument() {
      if (this.editing) this.finishEdit(false);
      this.frameConnection?.abort();
      this.frameConnection = null;
      let doc = null;
      try {
        doc = this.iframe.contentDocument;
      } catch {
        doc = null;
      }
      const win = doc?.defaultView || null;
      this.frameDoc = win ? doc : null;
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver.observe(this.iframe);
      }
      if (!this.frameDoc) {
        // A cross-origin or not yet available frame: nothing is drawn over it.
        this.setAttribute('data-sf-overlay-frame', 'unreachable');
        this.schedule();
        return;
      }
      this.removeAttribute('data-sf-overlay-frame');
      this.frameConnection = new AbortController();
      const options = { signal: this.frameConnection.signal };
      const passive = { ...options, passive: true };
      doc.addEventListener('pointermove', (event) => this.setHover(this.frameNodeAt(event)), passive);
      doc.addEventListener('pointerout', (event) => { if (!event.relatedTarget) this.setHover(null); }, passive);
      doc.addEventListener('click', (event) => this.onFrameClick(event), { ...options, capture: true });
      doc.addEventListener('dblclick', (event) => this.onFrameDoubleClick(event), { ...options, capture: true });
      doc.addEventListener('keydown', (event) => this.onFrameKey(event), { ...options, capture: true });
      win.addEventListener('scroll', () => this.schedule(), { ...passive, capture: true });
      win.addEventListener('resize', () => this.schedule(), passive);
      if (this.resizeObserver) {
        if (doc.documentElement) this.resizeObserver.observe(doc.documentElement);
        if (doc.body) this.resizeObserver.observe(doc.body);
      }
      this.schedule();
    }

    unbind() {
      this.finishEdit(false);
      this.frameConnection?.abort();
      this.frameConnection = null;
      this.frameDoc = null;
      this.pointerDrag?.abort();
      this.pointerDrag = null;
      this.unregisterDrop?.();
      this.unregisterDrop = null;
      this.moving = null;
      this.connection?.abort();
      this.connection = null;
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      if (this.frameRequest) globalThis.cancelAnimationFrame(this.frameRequest);
      this.frameRequest = 0;
      if (this.canvas || this.iframe) this.setAttribute('data-sf-overlay', 'disposed');
    }

    /** Supplies the Document structure and a describe(node) → {label, badges}. */
    setDocument(document, { describe } = {}) {
      this.elementIds = new Map();
      this.rectNodes = [];
      this.replaceNodes(overlayNodes(document), describe);
      return this;
    }

    /**
     * Supplies a framed canvas's flat node list [{id, kind, rect? | element?,
     * label?, parent?, editable?}] in selection order, and an optional
     * describe(node) → {label, badges}; without it the label is node.label or its kind.
     */
    setNodes(nodes, { describe } = {}) {
      const list = checkOverlayNodes(nodes);
      this.elementIds = new Map(list.filter((node) => node.element).map((node) => [node.element, node.id]));
      const entries = flatOverlayNodes(list);
      this.rectNodes = entries.filter((entry) => entry.flat.rect && !entry.flat.element);
      if (this.editing) {
        const next = list.find((node) => node.id === this.editing.id);
        if (!next || next.element !== this.editing.element || !next.editable) this.finishEdit(false);
      }
      this.replaceNodes(entries, typeof describe === 'function' ? describe : (node) => ({ label: node.label || node.kind }));
      return this;
    }

    replaceNodes(nodes, describe) {
      const previous = this.selectedId ? this.byId.get(this.selectedId) : null;
      const active = globalThis.document.activeElement;
      const focused = Boolean(active) && (this.toolbar?.contains(active) || this.insertionLayer?.contains(active));
      this.nodes = nodes;
      this.byId = new Map(this.nodes.map((node) => [node.id, node]));
      if (typeof describe === 'function') this.describe = describe;
      this.renderTree();
      // A selected node the host removed is deselected (and announced), so its
      // toolbar and insertion places do not stay on screen. When keyboard focus
      // was on a disappearing button, the parent (or first node) is selected and
      // focus moves to the tree instead of dropping onto the page body.
      if (this.selectedId !== null && !this.byId.has(this.selectedId)) {
        const fallback = previous?.parent && this.byId.has(previous.parent) ? previous.parent : this.nodes[0]?.id ?? null;
        this.select(focused ? fallback : null, { focus: focused });
      }
      this.schedule();
    }

    /** Re-measures on the next frame, after a change no observer reports (a transform on an ancestor of the canvas). */
    refresh() {
      this.schedule();
      return this;
    }

    setActions(actions) {
      this.actions = checkOverlayActions(actions);
      this.renderToolbar();
      this.schedule();
      return this;
    }

    setMessages(messages) {
      this.customMessages = isPlainObject(messages) ? { ...messages } : null;
      this.renderTree();
      return this;
    }

    /** filter({parent_id, slot, index}, item) → boolean hides invalid places. */
    setDropFilter(filter) {
      this.dropFilter = typeof filter === 'function' ? filter : () => true;
      return this;
    }

    accepts(dragSession) {
      const groups = (this.getAttribute('accepts') || '').split(/\s+/u).filter(Boolean);
      return Boolean(dragSession && groups.includes(dragSession.group));
    }

    emit(type, detail) {
      this.dispatchEvent(new globalThis.CustomEvent(type, { bubbles: true, composed: true, detail: Object.freeze(detail) }));
    }

    /** Every valid insertion place in document order; moving excludes its own subtree and no-op places. */
    dropTargets(moving) {
      const excluded = new Set();
      if (moving) {
        const stack = [moving];
        while (stack.length) {
          const id = stack.pop();
          excluded.add(id);
          for (const children of Object.values(this.byId.get(id)?.slots || {})) stack.push(...children);
        }
      }
      const places = [];
      for (const node of this.nodes) {
        if (excluded.has(node.id)) continue;
        for (const [slot, children] of Object.entries(node.slots)) {
          const remaining = moving ? children.filter((id) => id !== moving) : children;
          for (let index = 0; index <= remaining.length; index += 1) {
            if (moving) {
              const source = this.byId.get(moving);
              if (source.parent === node.id && source.slot === slot && index === source.index) continue;
            }
            const descriptor = { parent_id: node.id, slot, index };
            if (!this.dropFilter(descriptor, moving ? { node_id: moving } : activeSortableSession())) continue;
            const rect = this.placeRect(node.id, slot, index, remaining);
            if (rect) places.push({ descriptor, rect, label: format(this.messages.insertAt, { slot, index: index + 1 }) });
          }
        }
      }
      return places;
    }

    placeRect(parentId, slot, index, children) {
      const before = this.element(children[index]);
      const after = this.element(children[index - 1]);
      const parent = this.element(parentId);
      const anchor = before || after || parent;
      if (!anchor) return null;
      const box = anchor.getBoundingClientRect();
      const y = before ? box.top : box.bottom;
      return { left: box.left, top: y - 1, width: box.width, height: 3 };
    }

    resolveDrop(x, y, moving) {
      if (!this.canvas) return null;
      const under = globalThis.document.elementsFromPoint(x, y).find((element) => this.canvas.contains(element));
      let id = under ? this.nodeAt(under) : null;
      const allowedPlaces = moving ? this.dropTargets(moving) : null;
      const allowed = (descriptor) => (moving
        ? allowedPlaces.some((place) => JSON.stringify(place.descriptor) === JSON.stringify(descriptor))
        : this.dropFilter(descriptor, activeSortableSession()));
      // Over the moving node or its subtree there is no target.
      if (moving) {
        for (let cursor = id; cursor; cursor = this.byId.get(cursor)?.parent) {
          if (cursor === moving) {
            this.showDropHint(null);
            return null;
          }
        }
      }
      while (id) {
        const node = this.byId.get(id);
        // An empty slot of the container under the pointer is a target too.
        for (const [slot, children] of Object.entries(node.slots)) {
          const remaining = moving ? children.filter((entry) => entry !== moving) : children;
          const descriptor = { parent_id: node.id, slot, index: 0 };
          if (remaining.length === 0 && allowed(descriptor)) {
            const rect = this.placeRect(node.id, slot, 0, remaining);
            this.showDropHint(rect);
            return { descriptor, rect, label: format(this.messages.insertAt, { slot, index: 1 }) };
          }
        }
        if (!node.parent) break;
        const element = this.element(id);
        const box = element.getBoundingClientRect();
        const siblings = this.byId.get(node.parent).slots[node.slot];
        const remaining = moving ? siblings.filter((entry) => entry !== moving) : siblings;
        const position = remaining.indexOf(id);
        if (position >= 0) {
          const index = y > box.top + box.height / 2 ? position + 1 : position;
          const descriptor = { parent_id: node.parent, slot: node.slot, index };
          if (allowed(descriptor)) {
            const rect = this.placeRect(node.parent, node.slot, index, remaining);
            this.showDropHint(rect);
            return { descriptor, rect, label: format(this.messages.insertAt, { slot: node.slot, index: index + 1 }) };
          }
        }
        id = node.parent;
      }
      this.showDropHint(null);
      return null;
    }

    showDropHint(rect) {
      if (!this.dropHint) {
        this.dropHint = globalThis.document.createElement('div');
        this.dropHint.className = 'sf-composition-overlay-drop';
        this.layer?.append(this.dropHint);
      }
      this.dropHint.hidden = !rect;
      if (rect) Object.assign(this.dropHint.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    }

    // Moving a canvas node: pointer via the selected label, keyboard via the tree.
    onHandleDown(event) {
      if (this.iframe) return;
      if (event.button !== 0 || !this.selectedId || !this.byId.get(this.selectedId)?.parent) return;
      event.preventDefault();
      const moving = this.selectedId;
      this.pointerDrag?.abort();
      const pending = new AbortController();
      this.pointerDrag = pending;
      let place = null;
      globalThis.addEventListener('keydown', (keyEvent) => {
        if (keyEvent.key !== 'Escape') return;
        keyEvent.preventDefault();
        pending.abort();
        this.showDropHint(null);
      }, { signal: pending.signal, capture: true });
      globalThis.addEventListener('pointermove', (moveEvent) => {
        place = this.resolveDrop(moveEvent.clientX, moveEvent.clientY, moving);
      }, { signal: pending.signal });
      globalThis.addEventListener('pointerup', () => {
        pending.abort();
        this.showDropHint(null);
        if (place) this.emit(OVERLAY_EVENTS.move, { node_id: moving, ...place.descriptor });
      }, { signal: pending.signal });
      globalThis.addEventListener('pointercancel', () => { pending.abort(); this.showDropHint(null); }, { signal: pending.signal });
    }

    startKeyboardMove() {
      const node = this.byId.get(this.selectedId);
      if (!node?.parent) return;
      const places = this.dropTargets(node.id);
      if (!places.length) return;
      this.moving = { node: node.id, places, index: 0 };
      this.live.textContent = format(this.messages.picked, { label: this.info(node).label });
      this.showKeyboardPlace();
    }

    showKeyboardPlace() {
      const place = this.moving.places[this.moving.index];
      this.showDropHint(place.rect);
      this.live.textContent = place.label;
    }

    onMoveKey(event) {
      const moving = this.moving;
      if (event.key === 'Escape' || event.key === 'Tab') {
        if (event.key === 'Escape') event.preventDefault();
        this.moving = null;
        this.showDropHint(null);
        this.live.textContent = this.messages.cancelled;
        return true;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const place = moving.places[moving.index];
        this.moving = null;
        this.showDropHint(null);
        this.emit(OVERLAY_EVENTS.move, { node_id: moving.node, ...place.descriptor });
        return true;
      }
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
      if (step === undefined) return true;
      event.preventDefault();
      moving.index = Math.max(0, Math.min(moving.places.length - 1, moving.index + step));
      this.showKeyboardPlace();
      return true;
    }

    setInsertionTarget(target) {
      this.insertionTarget = target && typeof target.parent_id === 'string' && typeof target.slot === 'string' && Number.isSafeInteger(target.index)
        ? Object.freeze({ parent_id: target.parent_id, slot: target.slot, index: target.index }) : null;
      this.schedule();
      return this;
    }

    element(id) {
      if (!this.canvas || typeof id !== 'string') return null;
      for (const element of this.canvas.querySelectorAll('[data-sf-composition-id]')) {
        if (element.getAttribute('data-sf-composition-id') === id) return element;
      }
      return null;
    }

    info(node) {
      const described = this.describe(node) || {};
      const label = typeof described.label === 'string' && described.label.trim() ? described.label : node.id;
      const badges = Array.isArray(described.badges) ? described.badges.filter((badge) => typeof badge === 'string' && badge.trim()).slice(0, 4) : [];
      return { label, badges };
    }

    select(id, { focus = false, emit = true } = {}) {
      if (id !== null && !this.byId.has(id)) return this;
      if (this.editing && this.editing.id !== id) this.finishEdit(true);
      if (this.selectedId === id) return this;
      this.selectedId = id;
      this.renderTreeSelection();
      this.renderToolbar();
      this.schedule();
      if (id !== null) {
        const node = this.byId.get(id);
        const siblings = this.nodes.filter((entry) => entry.parent === node.parent && entry.slot === node.slot);
        const { label } = this.info(node);
        this.live.textContent = `${format(this.messages.selected, { label })}, ${format(this.messages.position, { index: siblings.indexOf(node) + 1, total: siblings.length })}`;
      }
      if (focus) this.tree.focus();
      if (emit) this.dispatchEvent(new globalThis.CustomEvent(OVERLAY_EVENTS.select, { bubbles: true, composed: true, detail: Object.freeze({ node_id: id }) }));
      return this;
    }

    setHover(id) {
      if (this.hoverId === id) return;
      this.hoverId = id;
      this.schedule();
    }

    nodeAt(target) {
      let element = target instanceof globalThis.Element ? target.closest('[data-sf-composition-id]') : null;
      while (element && this.canvas.contains(element)) {
        const id = element.getAttribute('data-sf-composition-id');
        if (this.byId.has(id)) return id;
        element = element.parentElement?.closest('[data-sf-composition-id]') || null;
      }
      return null;
    }

    onPointerMove(event) {
      this.setHover(this.nodeAt(event.target));
    }

    onCanvasClick(event) {
      const id = this.nodeAt(event.target);
      if (!id) return;
      // In the editor a click selects; it never follows links or submits.
      event.preventDefault();
      event.stopPropagation();
      this.select(id);
    }

    onTreeKey(event) {
      if (this.moving && this.onMoveKey(event)) return;
      if (event.key === ' ' && this.selectedId && !this.iframe) {
        event.preventDefault();
        this.startKeyboardMove();
        return;
      }
      const index = this.nodes.findIndex((node) => node.id === this.selectedId);
      const current = this.nodes[index];
      let next = null;
      if (event.key === 'ArrowDown') next = this.nodes[Math.min(this.nodes.length - 1, index + 1)];
      else if (event.key === 'ArrowUp') next = this.nodes[Math.max(0, index - 1)];
      else if (event.key === 'Home') next = this.nodes[0];
      else if (event.key === 'End') next = this.nodes.at(-1);
      else if (event.key === 'ArrowLeft' && current?.parent) next = this.byId.get(current.parent);
      else if (event.key === 'ArrowRight' && current) next = this.nodes.find((node) => node.parent === current.id) || null;
      else if (event.key === 'Escape' && this.selectedId !== null && (!this.iframe || isTopOpenSurface(this))) {
        event.preventDefault();
        this.select(null);
        return;
      } else if (event.key === 'Enter' && this.iframe && current?.flat?.editable) {
        event.preventDefault();
        this.edit(current.id);
        return;
      } else if (event.key === 'Enter' && this.toolbar.querySelector('button')) {
        event.preventDefault();
        this.toolbar.querySelector('button').focus();
        return;
      } else return;
      event.preventDefault();
      if (next) this.select(next.id);
    }

    onToolbarKey(event) {
      const buttons = [...this.toolbar.querySelectorAll('button')];
      const index = buttons.indexOf(globalThis.document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        this.tree.focus();
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const step = (event.key === 'ArrowRight') === (globalThis.getComputedStyle(this).direction !== 'rtl') ? 1 : -1;
        buttons[(index + step + buttons.length) % buttons.length]?.focus();
      }
    }

    onToolbarClick(event) {
      const button = event.target instanceof globalThis.Element ? event.target.closest('button[data-action]') : null;
      if (!button || !this.selectedId) return;
      this.dispatchEvent(new globalThis.CustomEvent(OVERLAY_EVENTS.action, {
        bubbles: true, composed: true, detail: Object.freeze({ action_id: button.dataset.action, node_id: this.selectedId }),
      }));
    }

    onInsertionClick(event) {
      const button = event.target instanceof globalThis.Element ? event.target.closest('button[data-parent]') : null;
      if (!button) return;
      const target = { parent_id: button.dataset.parent, slot: button.dataset.slot, index: Number(button.dataset.index) };
      this.setInsertionTarget(target);
      this.positionInsertions();
      this.dispatchEvent(new globalThis.CustomEvent(OVERLAY_EVENTS.insert, { bubbles: true, composed: true, detail: Object.freeze({ ...target }) }));
    }

    renderTree() {
      if (!this.tree) return;
      this.tree.setAttribute('aria-label', this.getAttribute('label') || this.messages.tree);
      this.tree.replaceChildren(...this.nodes.map((node) => {
        const item = globalThis.document.createElement('div');
        const siblings = this.nodes.filter((entry) => entry.parent === node.parent && entry.slot === node.slot);
        const { label, badges } = this.info(node);
        item.id = `${this.id || 'sf-overlay'}-item-${node.id}`.replace(/[^A-Za-z0-9_-]/gu, '-');
        item.setAttribute('role', 'treeitem');
        item.setAttribute('aria-level', String(node.level));
        item.setAttribute('aria-setsize', String(siblings.length));
        item.setAttribute('aria-posinset', String(siblings.indexOf(node) + 1));
        item.setAttribute('aria-label', badges.length ? `${label} (${badges.join(', ')})` : label);
        item.dataset.nodeId = node.id;
        return item;
      }));
      this.renderTreeSelection();
    }

    renderTreeSelection() {
      let active = null;
      for (const item of this.tree?.children || []) {
        const selected = item.dataset.nodeId === this.selectedId;
        item.setAttribute('aria-selected', selected ? 'true' : 'false');
        if (selected) active = item.id;
      }
      if (active) this.tree.setAttribute('aria-activedescendant', active);
      else this.tree?.removeAttribute('aria-activedescendant');
    }

    renderToolbar() {
      if (!this.toolbar) return;
      this.toolbar.setAttribute('aria-label', this.messages.toolbar);
      this.toolbar.replaceChildren(...this.actions.map((action) => {
        const button = globalThis.document.createElement('button');
        button.type = 'button';
        button.className = 'sf-composition-overlay-action';
        button.dataset.action = action.id;
        button.textContent = action.label;
        return button;
      }));
      this.toolbar.hidden = !this.selectedId || this.actions.length === 0;
    }

    schedule() {
      if (this.frameRequest || !this.connection) return;
      this.frameRequest = globalThis.requestAnimationFrame(() => {
        this.frameRequest = 0;
        this.position();
      });
    }

    /** A node's box on the host page: its element's rect, or in framed mode its frame box mapped out of the frame. */
    nodeBox(id) {
      const node = typeof id === 'string' ? this.byId.get(id) : null;
      if (!node) return null;
      if (!node.flat) return this.element(id)?.getBoundingClientRect() ?? null;
      const view = this.view;
      if (!view || !this.frameDoc) return null;
      const { element, rect } = node.flat;
      if (element) {
        if (!element.isConnected || element.ownerDocument !== this.frameDoc) return null;
        const box = element.getBoundingClientRect();
        if (!box.width && !box.height) return null;
        return frameRectToHost({ x: box.left, y: box.top, width: box.width, height: box.height }, view);
      }
      return frameRectToHost({ x: rect.x - view.scrollX, y: rect.y - view.scrollY, width: rect.width, height: rect.height }, view);
    }

    place(frame, id) {
      const box = id ? this.nodeBox(id) : null;
      if (!box) {
        frame.hidden = true;
        return null;
      }
      frame.hidden = false;
      frame.style.insetInlineStart = '';
      Object.assign(frame.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
      const { label, badges } = this.info(this.byId.get(id));
      frame.firstChild.textContent = badges.length ? `${label} · ${badges.join(' · ')}` : label;
      return box;
    }

    position() {
      if (!this.canvas && !this.iframe) return;
      if (this.iframe) {
        this.view = this.frameMetrics();
        this.applyClip(this.view?.clip ?? null);
      }
      this.place(this.hoverFrame, this.hoverId && this.hoverId !== this.selectedId ? this.hoverId : null);
      const box = this.place(this.selectedFrame, this.selectedId);
      if (this.iframe) {
        this.positionFrameToolbar(box);
        this.positionInsertions();
        return;
      }
      // No toolbar without a drawn selection, e.g. while the host re-renders,
      // unless it holds keyboard focus.
      if (box) this.toolbar.hidden = this.actions.length === 0;
      else if (!this.toolbar.contains(globalThis.document.activeElement)) this.toolbar.hidden = true;
      if (box && !this.toolbar.hidden) {
        const bar = this.toolbar.getBoundingClientRect();
        const above = box.top - bar.height - 4;
        const top = above >= 0 ? above : Math.min(globalThis.innerHeight - bar.height, box.bottom + 4);
        const rtl = globalThis.getComputedStyle(this).direction === 'rtl';
        const start = rtl ? box.right - bar.width : box.left;
        const left = Math.max(0, Math.min(start, globalThis.innerWidth - bar.width));
        Object.assign(this.toolbar.style, { top: `${top}px`, left: `${left}px` });
      }
      this.positionInsertions();
    }

    positionInsertions() {
      const selected = this.selectedId ? this.byId.get(this.selectedId) : null;
      const points = selected?.flat ? this.flatInsertionPoints(selected) : [];
      if (selected?.parent && !selected.flat) {
        const parent = this.byId.get(selected.parent);
        const siblings = parent.slots[selected.slot] || [];
        for (let index = 0; index <= siblings.length; index += 1) points.push({ parent: parent.id, slot: selected.slot, index, before: siblings[index], after: siblings[index - 1] });
      }
      if (selected && !selected.flat) {
        for (const [slot, children] of Object.entries(selected.slots)) points.push({ parent: selected.id, slot, index: children.length, after: children.at(-1), end: true });
      }
      const target = this.insertionTarget;
      // Buttons are reused by key so keyboard focus and marks survive repositioning.
      const existing = new Map([...this.insertionLayer.children].map((button) => [button.dataset.key, button]));
      const keep = new Set();
      for (const point of points) {
        const box = this.nodeBox(point.before) || this.nodeBox(point.after) || this.nodeBox(point.parent);
        if (!box) continue;
        const key = `${point.parent}|${point.slot}|${point.index}`;
        keep.add(key);
        let button = existing.get(key);
        if (!button) {
          button = globalThis.document.createElement('button');
          button.type = 'button';
          button.className = 'sf-composition-overlay-insert';
          button.dataset.key = key;
          button.dataset.parent = point.parent;
          button.dataset.slot = point.slot;
          button.dataset.index = String(point.index);
          const mark = globalThis.document.createElement('span');
          mark.className = 'sf-composition-overlay-insert-mark';
          mark.setAttribute('aria-hidden', 'true');
          mark.textContent = '+';
          button.append(mark);
          this.insertionLayer.append(button);
        }
        const top = point.before && !point.end ? box.top : box.bottom;
        const marked = Boolean(target && target.parent_id === point.parent && target.slot === point.slot && target.index === point.index);
        button.setAttribute('aria-pressed', marked ? 'true' : 'false');
        button.setAttribute('aria-label', format(this.messages.insertAt, { slot: point.slot, index: point.index + 1 }));
        Object.assign(button.style, { left: `${box.left}px`, top: `${top}px`, width: `${box.width}px` });
      }
      for (const [key, button] of existing) if (!keep.has(key)) button.remove();
    }

    // Framed mode: insertion places among the selected node's siblings (the top
    // level is parent_id ""), and at the end of its own children; setDropFilter hides places.
    flatInsertionPoints(selected) {
      const siblings = this.nodes.filter((node) => node.parent === selected.parent).map((node) => node.id);
      const parent = selected.parent ?? '';
      const points = [];
      for (let index = 0; index <= siblings.length; index += 1) points.push({ parent, slot: 'default', index, before: siblings[index], after: siblings[index - 1] });
      const children = selected.slots.default || [];
      if (children.length) points.push({ parent: selected.id, slot: 'default', index: children.length, after: children.at(-1), end: true });
      return points.filter((point) => this.dropFilter({ parent_id: point.parent, slot: point.slot, index: point.index }, null));
    }

    /** The frame's viewport on the host page and the part of it that is visible (clip). */
    frameMetrics() {
      const iframe = this.iframe;
      const win = this.frameDoc?.defaultView;
      if (!iframe?.isConnected || !win) return null;
      const rect = iframe.getBoundingClientRect();
      if (!rect.width && !rect.height) return null;
      const style = globalThis.getComputedStyle(iframe);
      const sides = (name, suffix = '') => ({ top: px(style[`${name}Top${suffix}`]), right: px(style[`${name}Right${suffix}`]), bottom: px(style[`${name}Bottom${suffix}`]), left: px(style[`${name}Left${suffix}`]) });
      const view = frameViewport({ rect, layout: { width: iframe.offsetWidth, height: iframe.offsetHeight }, border: sides('border', 'Width'), padding: sides('padding'), inner: { width: win.innerWidth, height: win.innerHeight }, scroll: { x: win.scrollX, y: win.scrollY } });
      let clip = { left: view.left, top: view.top, right: view.left + view.width, bottom: view.top + view.height };
      // Scrolling ancestors hide what lies outside them, and so does the window.
      const root = globalThis.document.documentElement;
      for (let element = iframe.parentElement; element && element !== root && element !== globalThis.document.body; element = element.parentElement) {
        const own = globalThis.getComputedStyle(element);
        if (own.overflowX === 'visible' && own.overflowY === 'visible') continue;
        const box = element.getBoundingClientRect();
        const left = box.left + element.clientLeft;
        const top = box.top + element.clientTop;
        clip = intersect(clip, { left, top, right: left + element.clientWidth, bottom: top + element.clientHeight });
      }
      view.clip = intersect(clip, { left: 0, top: 0, right: root.clientWidth, bottom: root.clientHeight });
      return view;
    }

    applyClip(clip) {
      const layer = this.layer.getBoundingClientRect();
      const value = !clip || clip.right <= clip.left || clip.bottom <= clip.top
        ? 'inset(50%)'
        : `inset(${Math.max(0, clip.top - layer.top)}px ${Math.max(0, layer.right - clip.right)}px ${Math.max(0, layer.bottom - clip.bottom)}px ${Math.max(0, clip.left - layer.left)}px)`;
      this.layer.style.clipPath = value;
      this.insertionLayer.style.clipPath = value;
    }

    positionFrameToolbar(box) {
      const clip = this.view?.clip;
      const visible = Boolean(box && clip && box.right > clip.left && box.left < clip.right && box.bottom > clip.top && box.top < clip.bottom);
      if (visible) this.toolbar.hidden = this.actions.length === 0;
      else if (!this.toolbar.contains(globalThis.document.activeElement)) this.toolbar.hidden = true;
      if (!visible || this.toolbar.hidden) return;
      const bar = this.toolbar.getBoundingClientRect();
      // Above the node, else below it, and always inside the visible part of the frame.
      const above = box.top - bar.height - 4;
      let top = above >= clip.top ? above : box.bottom + 4;
      top = Math.max(clip.top, Math.min(top, clip.bottom - bar.height));
      const rtl = globalThis.getComputedStyle(this).direction === 'rtl';
      const start = rtl ? box.right - bar.width : box.left;
      const left = Math.max(0, Math.min(start, globalThis.document.documentElement.clientWidth - bar.width));
      Object.assign(this.toolbar.style, { top: `${top}px`, left: `${left}px` });
    }

    /** The innermost node under a pointer event in the frame: the smallest element or rect node that holds it. */
    frameNodeAt(event) {
      let best = null;
      let area = Infinity;
      const consider = (id, width, height) => {
        if (width * height < area) {
          best = id;
          area = width * height;
        }
      };
      for (let element = isElement(event.target) ? event.target : event.target?.parentElement; element; element = element.parentElement) {
        const id = this.elementIds.get(element);
        if (id === undefined || !this.byId.has(id)) continue;
        const box = element.getBoundingClientRect();
        consider(id, box.width, box.height);
      }
      const win = this.frameDoc?.defaultView;
      if (win && this.rectNodes.length && finite(event.clientX)) {
        const x = event.clientX + win.scrollX;
        const y = event.clientY + win.scrollY;
        for (const { id, flat: { rect } } of this.rectNodes) {
          if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) consider(id, rect.width, rect.height);
        }
      }
      return best;
    }

    onFrameClick(event) {
      if (this.editing && this.editing.element.contains(event.target)) return;
      // In the editor a click selects; it never follows links or submits. A
      // click on no node goes back to no selection (the letter itself).
      event.preventDefault();
      const id = this.frameNodeAt(event);
      if (id) event.stopPropagation();
      this.select(id);
    }

    onFrameDoubleClick(event) {
      if (this.editing) return;
      const id = this.frameNodeAt(event);
      if (!id || !this.byId.get(id).flat?.editable) return;
      event.preventDefault();
      this.edit(id);
    }

    onFrameKey(event) {
      if (this.editing) {
        if (event.isComposing) return;
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          this.finishEdit(event.key === 'Enter');
        }
        return;
      }
      if (!event.defaultPrevented) this.onTreeKey(event);
    }

    /** Starts plain-string editing of an editable node inside the frame; returns whether it started. */
    edit(id) {
      const node = typeof id === 'string' ? this.byId.get(id) : null;
      const element = node?.flat?.editable ? node.flat.element : null;
      if (!element || !this.frameDoc || !element.isConnected || element.ownerDocument !== this.frameDoc) return false;
      if (this.editing?.id === id) return true;
      if (this.editing) this.finishEdit(true);
      const returnFocus = globalThis.document.activeElement === this.tree;
      this.select(id);
      const doc = element.ownerDocument;
      const attribute = element.getAttribute('contenteditable');
      element.setAttribute('contenteditable', 'plaintext-only');
      // Where plaintext-only is unknown, rich editing is narrowed to plain text by hand.
      const plain = element.contentEditable === 'plaintext-only';
      if (!plain) element.setAttribute('contenteditable', 'true');
      const connection = new AbortController();
      const options = { signal: connection.signal };
      element.addEventListener('blur', () => this.finishEdit(true), options);
      element.addEventListener('input', () => this.schedule(), options);
      element.addEventListener('beforeinput', (event) => {
        const type = event.inputType || '';
        if (type === 'insertParagraph' || type === 'insertLineBreak' || (!plain && type.startsWith('format'))) event.preventDefault();
      }, options);
      if (!plain) {
        element.addEventListener('paste', (event) => {
          event.preventDefault();
          doc.execCommand('insertText', false, (event.clipboardData?.getData('text/plain') || '').replace(/\s+/gu, ' '));
        }, options);
      }
      this.editing = { id, element, saved: element.cloneNode(true), previous: plainText(element), attribute, connection, returnFocus };
      holdOpenSurfaceMark(this, true);
      this.setAttribute('data-sf-overlay-editing', '');
      element.focus({ preventScroll: true });
      const selection = doc.defaultView?.getSelection();
      if (selection) {
        const range = doc.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      this.live.textContent = format(this.messages.editing, { label: this.info(node).label });
      this.schedule();
      return true;
    }

    /** Ends the inline edit: commit emits sf-composition-overlay-edit (cancelable) when the text changed; cancel restores it. */
    finishEdit(commit) {
      const editing = this.editing;
      if (!editing) return;
      this.editing = null;
      editing.connection.abort();
      holdOpenSurfaceMark(this, false);
      this.removeAttribute('data-sf-overlay-editing');
      const { element } = editing;
      if (editing.attribute === null) element.removeAttribute('contenteditable');
      else element.setAttribute('contenteditable', editing.attribute);
      const restore = () => {
        if (element.isConnected) element.replaceChildren(...editing.saved.childNodes);
      };
      const value = plainText(element);
      if (!commit) restore();
      else if (value !== editing.previous) {
        const event = new globalThis.CustomEvent(OVERLAY_EVENTS.edit, {
          bubbles: true, composed: true, cancelable: true, detail: Object.freeze({ node_id: editing.id, value, previous: editing.previous }),
        });
        this.dispatchEvent(event);
        // The host refused the value: the letter shows what it showed before.
        if (event.defaultPrevented) restore();
      }
      if (editing.returnFocus && this.isConnected) this.tree.focus({ preventScroll: true });
      this.schedule();
    }
  }

  registry.define('sf-composition-overlay', SfCompositionOverlay);
  return SfCompositionOverlay;
}

export default { OVERLAY_EVENTS, checkOverlayActions, checkOverlayNodes, defineCompositionOverlay, flatOverlayNodes, frameRectToHost, frameViewport, overlayNodes };
