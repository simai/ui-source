import {
  bindFileUpload,
  setFileUploadItems,
  unbindFileUpload,
} from '../../component/file-upload/js/_file_upload';
import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderFileUploadTemplate } from './js/templates/default';
import { FIELD_SIZES, fieldSize } from '../../component/field-size';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// Every word this component says is lang/<locale>.json runtime (standard
// 1.3.8 §11); a product adds any other language through
// SF.language.register("sf-file-upload", code, words).

// The class component's events, each with the name the host sends it by
// (vocabulary 1.1.5 §9.1). They stop at the host, which sends them through
// sfEmit with the entry's id; the shim sends the old name after each one.
const INNER_EVENTS = {
  'sf-file-upload:select': 'attach',
  'sf-file-upload:file-add': 'attached',
  'sf-file-upload:remove': 'detach',
  'sf-file-upload:reject': 'rejected',
  'sf-file-upload:retry': 'retry',
  'sf-file-upload:file-complete': 'completed',
  'sf-file-upload:file-error': 'failed',
  'sf-file-upload:complete': 'finished',
};

const itemState = (item) => {
  const state = String(item?.state || item?.status || 'process').toLowerCase();
  return ['process', 'done', 'error'].includes(state) ? state : 'process';
};

// An entry's id, as the class component keys its events.
const itemId = (item, index) => {
  if (item?.id) return String(item.id);
  if (item?.file?.name) return `${item.file.name}-${item.file.size}-${item.file.lastModified}`;
  if (item?.name || item?.fileName) return `${item.name || item.fileName}-${index}`;
  return `item-${index}`;
};

const itemProgress = (item) => Math.max(0, Math.min(100, Number(item?.progress ?? 0) || 0));

// sf-file-upload from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §4.4, §8, §10.8, §16.20): the settings are attributes and
// properties made by core/js/element-manifest.js, the actions answer an
// outcome, and each entry is a stream the host drives through items.
const FileUploadElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
  actions: {
    'remove-item'({ index } = {}) {
      const nextItems = Array.from(this.items);
      const normalizedIndex = Number(index);
      if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= nextItems.length) {
        return 'no-item';
      }
      nextItems.splice(normalizedIndex, 1);
      this.items = nextItems;
      return 'applied';
    },
    clear() {
      if (!this.items.length) return 'unchanged';
      this.items = [];
      return 'applied';
    },
  },
});

function formatAcceptValue(value) {
  const parts = String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^\./, ''))
    .map((part) => {
      if (part.includes('/')) {
        return part.split('/').pop() || part;
      }

      return part;
    })
    .map((part) => part.toUpperCase());

  return parts.join(', ');
}

class SfFileUpload extends FileUploadElement {
  static get props() {
    return {
      ...super.props,
      templateName: { attribute: 'template', default: 'default' },
      size: { default: '1', values: FIELD_SIZES },
      ariaLabel: { default: '' },
    };
  }


  constructor() {
    super();
    this._items = [];
    this._boundRoot = null;
    this._onSelect = null;
    this._onRemove = null;
    this._onRetry = null;
    // The streams the entries are (§10.8): id -> {state, progress}.
    this._streams = new Map();
    this._lastAttach = null;
    // A file held over the area is said on the host (§5.3).
    this.addEventListener('dragover', this._onDragState);
    this.addEventListener('dragleave', this._onDragState);
    this.addEventListener('drop', this._onDragState);
  }

  _onDragState = (event) => {
    if (event.type === 'dragover') {
      const files = Array.from(event.dataTransfer?.types || []).includes('Files');
      this.sfHostState('data-dragged-over', files && !this.disabled);
      return;
    }
    if (event.type === 'dragleave' && event.relatedTarget && this.contains(event.relatedTarget)) return;
    this.sfHostState('data-dragged-over', false);
  };

  get componentName() {
    return 'file-upload';
  }

  shouldClearLightDomBeforeFirstRender() {
    return super.shouldClearLightDomBeforeFirstRender()
      || (this.templateName === 'default'
        && !!this.querySelector(':scope > .sf-file-upload[data-render-managed="1"]'));
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get size() {
    return fieldSize(this.getAttribute('size') || '1', 'sf-file-upload');
  }

  get formats() {
    return (
      this.getAttribute('formats') ||
      formatAcceptValue(this.accept) ||
      // The component cannot know what a field accepts: it names formats only
      // when the host gives them or an accept list says so.
      ''
    );
  }

  get supportingText() {
    return (
      this.getAttribute('supporting-text') ||
      this.formats
    );
  }

  get ariaLabel() {
    return this.getAttribute('aria-label') || '';
  }

  get items() {
    return Array.isArray(this._items) ? this._items : [];
  }

  set items(value) {
    this._items = Array.isArray(value) ? value : [];
    this.syncRuntimeItems();
    this._trackStreams(this._items);
    this.requestComponentUpdate('items');
  }

  // The stream facts of §10.8 that the class component does not send: begun
  // when an entry enters process, chunk when the host moves its progress,
  // cancelled when it leaves while in process. completed and failed are the
  // class component's file-complete and file-error, sent on by the host.
  _trackStreams(items = []) {
    const seen = new Set();
    items.forEach((item, index) => {
      const id = itemId(item, index);
      seen.add(id);
      const state = itemState(item);
      const progress = itemProgress(item);
      const before = this._streams.get(id);
      this._streams.set(id, {state, progress, item});
      if (state !== 'process') return;
      if (!before || before.state !== 'process') {
        this.sfEmit('begun', { id, item });
        if (progress > 0) this.sfEmit('chunk', { id, done: progress, total: 100, item });
      } else if (progress !== before.progress) {
        this.sfEmit('chunk', { id, done: progress, total: 100, item });
      }
    });
    for (const [id, stream] of [...this._streams]) {
      if (seen.has(id)) continue;
      this._streams.delete(id);
      if (stream.state === 'process') this.sfEmit('cancelled', { id, item: stream.item });
    }
  }

  // The class component's events stop at the host and leave it by their
  // vocabulary names, with the entry's id (§8, §10.8). Its change -- the file
  // input's own, or the one it sends for a drop -- stops too: the host sends
  // change once per choice, after the streams began, with the files chosen.
  _onInnerEvent = (event) => {
    if (event.target !== this._boundRoot && event.type !== 'change') return;
    event.stopPropagation();
    if (event.type === 'change') return;
    const verb = INNER_EVENTS[event.type];
    if (!verb) return;
    const detail = { ...(event.detail || {}) };
    if (detail.item) detail.id = itemId(detail.item, detail.index);
    if (verb === 'failed') {
      detail.reason = String(detail.item?.reason || 'error');
      detail.message = String(detail.item?.errorMessage || detail.item?.error || '');
    }
    if (verb === 'attach') this._lastAttach = { files: detail.files, source: detail.source };
    this.sfEmit(verb, detail);
  };

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      linkText: this.linkText,
      text: this.text,
      retryText: this.sfWord('retry'),
      component: this,
      formats: this.formats,
      supportingText: this.supportingText,
      items: this.items,
    });
  }

  template() {
    return renderFileUploadTemplate(this.templateContext());
  }

  get state() {
    return {
      size: this.size,
      icon: this.icon,
      linkText: this.linkText,
      text: this.text,
      formats: this.formats,
      supportingText: this.supportingText,
      accept: this.accept,
      multiple: this.multiple,
      disabled: this.disabled,
      items: this.items,
    };
  }

  getItems() {
    return this.items;
  }

  onFileAdd(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-upload:file-add', handler, options);
    }

    return this;
  }

  onFileError(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-upload:file-error', handler, options);
    }

    return this;
  }

  onFileComplete(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-upload:file-complete', handler, options);
    }

    return this;
  }

  onFileRemove(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-upload:remove', handler, options);
    }

    return this;
  }

  onFileRetry(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-upload:retry', handler, options);
    }

    return this;
  }

  onComplete(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-file-upload:complete', handler, options);
    }

    return this;
  }

  // items is a writable setting (§4.4); setItems stays for the pages that
  // call it, outside the interface.
  setItems(nextItems = []) {
    this.items = nextItems;
    return this;
  }

  setState(nextState = {}) {
    if (!nextState || typeof nextState !== 'object') {
      return this;
    }

    const attributeState = { ...nextState };

    if ('items' in attributeState) {
      this._items = Array.isArray(attributeState.items) ? attributeState.items : [];
      delete attributeState.items;
    }

    super.setState(attributeState);
    this.syncRuntimeItems();
    this._trackStreams(this.items);
    this.requestComponentUpdate('state');
    return this;
  }

  beforeRender() {
    this.teardownRuntime();
  }

  afterRender(callback) {
    if (typeof callback === 'function') return super.afterRender(callback);

    this._boundRoot = this.querySelector('.sf-file-upload');
    if (!this._boundRoot) {
      return;
    }

    bindFileUpload(this._boundRoot);
    this.syncRuntimeItems();

    const refresh = () => {
      this._items = Array.from(this._boundRoot?.__sfFileUploadItems || []);
      this._trackStreams(this._items);
      if (this._lastAttach) {
        const chosen = this._lastAttach;
        this._lastAttach = null;
        // change keeps its native name (§8, §17.3).
        this.sfEmit('change', chosen);
      }
      this.requestComponentUpdate('items');
    };
    this._onSelect = refresh;
    this._onRemove = refresh;
    this._onRetry = refresh;

    for (const type of [...Object.keys(INNER_EVENTS), 'change']) {
      this._boundRoot.addEventListener(type, this._onInnerEvent);
    }
    this._boundRoot.addEventListener('sf-file-upload:select', this._onSelect);
    this._boundRoot.addEventListener('sf-file-upload:remove', this._onRemove);
    this._boundRoot.addEventListener('sf-file-upload:retry', this._onRetry);
  }

  onDisconnected() {
    this.teardownRuntime();
  }

  syncRuntimeItems() {
    if (!this._boundRoot) {
      return;
    }

    setFileUploadItems(this._boundRoot, this.items);
  }

  teardownRuntime() {
    if (this._boundRoot && this._onSelect) {
      this._boundRoot.removeEventListener('sf-file-upload:select', this._onSelect);
    }

    if (this._boundRoot && this._onRemove) {
      this._boundRoot.removeEventListener('sf-file-upload:remove', this._onRemove);
    }

    if (this._boundRoot && this._onRetry) {
      this._boundRoot.removeEventListener('sf-file-upload:retry', this._onRetry);
    }

    if (this._boundRoot) {
      for (const type of [...Object.keys(INNER_EVENTS), 'change']) {
        this._boundRoot.removeEventListener(type, this._onInnerEvent);
      }
    }

    if (this._boundRoot) {
      unbindFileUpload(this._boundRoot);
      this._boundRoot = null;
    }

    this._onSelect = null;
    this._onRemove = null;
    this._onRetry = null;
  }
}

SfFileUpload.define('sf-file-upload');
