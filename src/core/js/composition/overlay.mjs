import { isPlainObject } from './canonical.mjs';
import { pageText } from '../page-language.js';
import { activeSortableSession, registerSortableDropTarget } from './sortable.mjs';

// Editor canvas overlay. It draws hover and selection frames, a floating
// action toolbar and insertion points over a rendered Composition Document
// without touching the canvas DOM: the published HTML stays byte-identical.
// The host supplies node descriptions and actions and performs every change.

export const OVERLAY_EVENTS = Object.freeze({
  select: 'sf-composition-overlay-select',
  action: 'sf-composition-overlay-action',
  insert: 'sf-composition-overlay-insert',
  move: 'sf-composition-overlay-move',
});

const MESSAGES = {
  ru: { picked: 'Перемещение: {label}. Стрелки выбирают место, Enter — положить, Escape — отменить.', cancelled: 'Перемещение отменено.', tree: 'Структура страницы', toolbar: 'Действия', insert: 'Вставить', insertAt: 'Вставить в «{slot}», позиция {index}', position: '{index} из {total}', selected: 'Выбрано: {label}' },
  en: { picked: 'Moving {label}. Arrows choose a place, Enter drops, Escape cancels.', cancelled: 'Move cancelled.', tree: 'Page structure', toolbar: 'Actions', insert: 'Insert', insertAt: 'Insert into “{slot}”, position {index}', position: '{index} of {total}', selected: 'Selected: {label}' },
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
    }

    get messages() {
      // In the page's language through pageText, as every component's words are.
      const words = Object.fromEntries(Object.keys(MESSAGES.en).map((key) => [key, pageText(MESSAGES, key, this, 'sf-composition-overlay')]));
      return { ...words, ...(this.customMessages || {}) };
    }

    connectedCallback() {
      if (!this.layer) this.buildLayer();
      const canvasId = this.getAttribute('for');
      if (canvasId && !this.canvas) {
        const canvas = globalThis.document.getElementById(canvasId);
        if (canvas) this.attach(canvas);
      } else if (this.canvas) {
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
      if (this.isConnected) this.bind();
      return this;
    }

    bind() {
      if (this.connection || !this.canvas) return;
      this.connection = new AbortController();
      const options = { signal: this.connection.signal };
      const passive = { ...options, passive: true };
      this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event), passive);
      this.canvas.addEventListener('pointerleave', () => this.setHover(null), passive);
      this.canvas.addEventListener('click', (event) => this.onCanvasClick(event), { ...options, capture: true });
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
        this.resizeObserver.observe(this.canvas);
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
      this.schedule();
    }

    unbind() {
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
      if (this.canvas) this.setAttribute('data-sf-overlay', 'disposed');
    }

    /** Supplies the Document structure and a describe(node) → {label, badges}. */
    setDocument(document, { describe } = {}) {
      const previous = this.selectedId ? this.byId.get(this.selectedId) : null;
      const active = globalThis.document.activeElement;
      const focused = Boolean(active) && (this.toolbar?.contains(active) || this.insertionLayer?.contains(active));
      this.nodes = overlayNodes(document);
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
      if (event.key === ' ' && this.selectedId) {
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
      else if (event.key === 'Escape' && this.selectedId !== null) {
        event.preventDefault();
        this.select(null);
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

    place(frame, id) {
      const element = id ? this.element(id) : null;
      if (!element) {
        frame.hidden = true;
        return null;
      }
      const box = element.getBoundingClientRect();
      frame.hidden = false;
      frame.style.insetInlineStart = '';
      Object.assign(frame.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
      const { label, badges } = this.info(this.byId.get(id));
      frame.firstChild.textContent = badges.length ? `${label} · ${badges.join(' · ')}` : label;
      return box;
    }

    position() {
      if (!this.canvas) return;
      this.place(this.hoverFrame, this.hoverId && this.hoverId !== this.selectedId ? this.hoverId : null);
      const box = this.place(this.selectedFrame, this.selectedId);
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
      const points = [];
      if (selected?.parent) {
        const parent = this.byId.get(selected.parent);
        const siblings = parent.slots[selected.slot] || [];
        for (let index = 0; index <= siblings.length; index += 1) points.push({ parent: parent.id, slot: selected.slot, index, before: siblings[index], after: siblings[index - 1] });
      }
      if (selected) {
        for (const [slot, children] of Object.entries(selected.slots)) points.push({ parent: selected.id, slot, index: children.length, after: children.at(-1), end: true });
      }
      const target = this.insertionTarget;
      // Buttons are reused by key so keyboard focus and marks survive repositioning.
      const existing = new Map([...this.insertionLayer.children].map((button) => [button.dataset.key, button]));
      const keep = new Set();
      for (const point of points) {
        const anchor = this.element(point.before) || this.element(point.after) || this.element(point.parent);
        if (!anchor) continue;
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
        const box = anchor.getBoundingClientRect();
        const top = point.before && !point.end ? box.top : box.bottom;
        const marked = Boolean(target && target.parent_id === point.parent && target.slot === point.slot && target.index === point.index);
        button.setAttribute('aria-pressed', marked ? 'true' : 'false');
        button.setAttribute('aria-label', format(this.messages.insertAt, { slot: point.slot, index: point.index + 1 }));
        Object.assign(button.style, { left: `${box.left}px`, top: `${top}px`, width: `${box.width}px` });
      }
      for (const [key, button] of existing) if (!keep.has(key)) button.remove();
    }
  }

  registry.define('sf-composition-overlay', SfCompositionOverlay);
  return SfCompositionOverlay;
}

export default { OVERLAY_EVENTS, checkOverlayActions, defineCompositionOverlay, overlayNodes };
