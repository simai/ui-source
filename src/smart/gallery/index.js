import SfBaseElement from '../../core/js/smart-base';
import { applied, elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import { renderGalleryTemplate } from './js/templates/default';
import { installViewer } from './js/viewer.js';
import { normalizeSlideContent } from '../../component/slider/js/_slide-content';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-gallery 1.3.0 from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §8), owner decision C150 (2026-11-14): a set of pictures is a
// grid of picture tiles by default, or the main picture with thumbnails; a
// press opens the one full-screen viewer of the page (js/viewer.js, SF.Gallery,
// shared with sf-file-preview, C149 (6)); a media library chooses tiles with
// check boxes. The slider and the window it was built from (sf-slider,
// sf-modal) are gone: a row that scrolls is sf-slider (C143). Their settings
// are dated rows of aliases.json, read and ignored until the date.
const GalleryElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

const viewer = installViewer();

const RETIRE = { since: '2026-11-14', remove_after: '2027-01-01' };
const RETIRED_SETTINGS = aliases.aliases
  .filter((row) => row.kind === 'setting' && row.to === null && row.since === RETIRE.since)
  .map((row) => row.from);

// What retires without a new name (aliases.json rows with `to: null`): kept
// until the date, and each use is noted with it.
function noteRetired(from, kind = 'action', dates = aliases) {
  noteDeprecated({ component: 'sf-gallery', tag: 'sf-gallery', kind, attribute: kind === 'attribute' ? from : '', from, to: null,
    since: dates.since, remove_after: dates.remove_after });
}

function normalizeSlotNodes(content) {
  if (!content || content === null || typeof content === 'undefined') {
    return [];
  }

  return normalizeSlideContent(content).filter((node) => node instanceof Element);
}

// A copy of a page's picture for a tile (GL-10, C150 (6)). A plain cloneNode
// cannot hold a picture back: a copied parser-made <img loading="lazy">
// starts its download at once (Chrome). The copy is made from the markup
// with the sources held back, and each picture gets its loading (the page's
// own, else lazy, or eager when asked) and decoding before its source. The
// picture's own object-position -- its focus point (C94 (3)) -- stays.
const SOURCE_ATTRIBUTES = ['srcset', 'src'];

function copyPicture(node, eager = false) {
  if (!(node instanceof Element)) return null;
  const template = document.createElement('template');
  template.innerHTML = node.outerHTML;
  const inert = template.content.firstElementChild;
  if (!inert) return node.cloneNode(true);
  const held = [];
  [inert, ...inert.querySelectorAll('img, source')].filter((one) => one.matches('img, source')).forEach((one) => {
    const sources = SOURCE_ATTRIBUTES.filter((name) => one.hasAttribute(name)).map((name) => [name, one.getAttribute(name)]);
    sources.forEach(([name]) => one.removeAttribute(name));
    held.push(sources);
  });
  const copy = document.importNode(inert, true);
  [copy, ...copy.querySelectorAll('img, source')].filter((one) => one.matches('img, source')).forEach((one, index) => {
    if (one.localName === 'img') {
      if (!one.hasAttribute('loading') || eager) one.loading = eager ? 'eager' : 'lazy';
      if (!one.hasAttribute('decoding')) one.decoding = 'async';
      one.removeAttribute('slot');
      one.removeAttribute('title');
    }
    held[index].forEach(([name, value]) => one.setAttribute(name, value));
  });
  copy.removeAttribute('slot');
  return copy;
}

function usableHref(value) {
  const href = String(value || '').trim();
  return href && href !== '#' ? href : '';
}

// What one child of the gallery is: an <img>, a <picture>, a <figure> with its
// caption, or a link to the large file around a small picture.
function readSlide(slide) {
  const image = slide.matches('img') ? slide : slide.querySelector('img');
  const picture = slide.matches('img, picture') ? slide : (slide.querySelector('picture') || image);
  const link = slide.matches('a[href]') ? slide : slide.querySelector('a[href]');
  const figcaption = slide.querySelector('figcaption');
  const caption = slide.getAttribute('data-caption') || figcaption?.textContent?.trim() || slide.getAttribute('title')
    || image?.getAttribute('title') || '';
  const source = slide.getAttribute('data-src') || image?.getAttribute('data-src') || usableHref(link?.getAttribute('href'))
    || image?.getAttribute('src') || '';
  return {
    slide,
    picture,
    alt: image?.getAttribute('alt') || '',
    caption,
    item: {
      src: source,
      type: slide.getAttribute('data-type') || link?.getAttribute('type') || undefined,
      alt: image?.getAttribute('alt') || '',
      caption,
      width: Number(image?.getAttribute('width')) || undefined,
      height: Number(image?.getAttribute('height')) || undefined,
    },
  };
}

const GALLERY_TRIGGER_SELECTOR = '[data-sf-gallery]';
// How long a finger holds a tile before it is chosen (C150 (9), a phone).
const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 10;

function galleryGroup(element) {
  return String(element?.getAttribute?.('data-sf-gallery') || '').trim();
}

// A page's linked pictures: one data-sf-gallery group is one set (the same
// viewer). The large file is the link's address (or data-sf-src / data-src);
// the caption its data-caption, title or figure caption; the picture's alt
// stays the picture's.
function delegatedItem(element) {
  const image = element.matches?.('img') ? element : element.querySelector?.('img');
  const source = element.getAttribute?.('data-sf-src') || element.getAttribute?.('data-src')
    || usableHref(element.getAttribute?.('href')) || element.getAttribute?.('src') || image?.currentSrc || image?.src || '';
  if (!source) return null;
  const figcaption = element.closest?.('figure')?.querySelector?.('figcaption');
  return {
    src: source,
    type: element.getAttribute?.('data-type') || undefined,
    alt: image?.getAttribute?.('alt') || '',
    caption: element.getAttribute?.('data-caption') || element.getAttribute?.('title') || figcaption?.textContent?.trim?.() || '',
  };
}

function delegatedGroup(trigger) {
  const group = galleryGroup(trigger);
  if (!group) return [trigger];
  return Array.from(document.querySelectorAll(GALLERY_TRIGGER_SELECTOR)).filter((item) => galleryGroup(item) === group);
}

function delegatedOption(trigger, items, names) {
  for (const element of [trigger, ...items]) {
    for (const name of names) {
      if (element?.hasAttribute?.(name)) return element.getAttribute(name);
    }
  }
  return null;
}

class SfGallery extends GalleryElement {
  static globalDelegationBound = false;
  // The page's pictures stay where they were until the first drawing takes
  // them, so the grid core.styles holds before the code (C150 (6)) is never
  // empty for a frame.
  static holdsSlotNodesUntilDrawn = true;

  static get props() {
    return {
      ...super.props,
      templateName: { attribute: 'template', default: 'default' },
      rootClass: { default: '' },
    };
  }

  static bindGlobalDelegation() {
    if (SfGallery.globalDelegationBound) return;
    SfGallery.globalDelegationBound = true;
    document.addEventListener('click', SfGallery.handleDelegatedGalleryClick);
  }

  static handleDelegatedGalleryClick(event) {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const trigger = event.target.closest?.(GALLERY_TRIGGER_SELECTOR);
    if (!trigger || trigger.closest('sf-gallery')) return;
    const elements = delegatedGroup(trigger);
    const items = elements.map(delegatedItem);
    const at = elements.indexOf(trigger);
    if (!items[at]) return;
    const listed = items.filter(Boolean);
    event.preventDefault();
    const loop = delegatedOption(trigger, elements, ['data-sf-gallery-loop', 'data-sf-slider-loop']);
    viewer.view(listed, {
      start: listed.indexOf(items[at]) + 1,
      opener: trigger,
      label: delegatedOption(trigger, elements, ['data-sf-modal-heading', 'data-sf-modal-title', 'data-sf-gallery-title']) || undefined,
      loop: loop !== null && loop !== 'false',
    });
  }

  constructor() {
    super();
    this._current = null;
    this._selected = new Set();
    this._lastPicked = null;
    this._tileCache = { nodes: [], tiles: [] };
    this._viewing = false;
    this._syncing = false;
    this._press = null;
    this._swallowClick = false;
    this._handleClick = this._handleClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleChange = this._handleChange.bind(this);
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerEnd = this._handlePointerEnd.bind(this);
  }

  connectedCallback() {
    // Every child is a picture of the set (§4.5): a child the page did not
    // name joins the slide slot.
    Array.from(this.children).forEach((child) => {
      if (!child.hasAttribute('slot') && !child.hasAttribute('data-sf-static') && child.localName !== 'script' && child.localName !== 'template') {
        child.setAttribute('slot', 'slide');
      }
    });
    RETIRED_SETTINGS.filter((name) => this.hasAttribute(name)).forEach((name) => noteRetired(name, 'attribute', RETIRE));
    super.connectedCallback();
    this.addEventListener('click', this._handleClick);
    this.addEventListener('keydown', this._handleKeyDown);
    this.addEventListener('change', this._handleChange);
    this.addEventListener('pointerdown', this._handlePointerDown);
    this.addEventListener('pointerup', this._handlePointerEnd);
    this.addEventListener('pointercancel', this._handlePointerEnd);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._handleClick);
    this.removeEventListener('keydown', this._handleKeyDown);
    this.removeEventListener('change', this._handleChange);
    this.removeEventListener('pointerdown', this._handlePointerDown);
    this.removeEventListener('pointerup', this._handlePointerEnd);
    this.removeEventListener('pointercancel', this._handlePointerEnd);
    clearTimeout(this._press?.timer);
    if (this._viewing) viewer.close();
    super.disconnectedCallback();
  }

  // ── the set ──
  _slides() {
    return normalizeSlotNodes(this.getSlotContent('slide'));
  }

  // The tiles are built once per set of children: a change of the current
  // picture or of the choice draws the same nodes again.
  _tiles() {
    const nodes = this._slides();
    const cache = this._tileCache;
    if (nodes.length === cache.nodes.length && nodes.every((node, index) => node === cache.nodes[index])) return cache.tiles;
    // Each copy is made when a look first draws it: a copy of the first
    // picture made eager for the main frame would load even in the grid.
    const tiles = nodes.map((node, index) => {
      const read = readSlide(node);
      const copies = {};
      const copy = (name, eager = false) => {
        if (!(name in copies)) {
          copies[name] = copyPicture(read.picture, eager);
          if (copies[name]) this.copyRuntimeData(read.picture, copies[name]);
        }
        return copies[name];
      };
      return {
        ...read,
        index: index + 1,
        tilePicture: () => copy('tile'),
        mainPicture: () => copy('main', index === 0),
        thumbPicture: () => copy('thumb'),
      };
    });
    this._tileCache = { nodes, tiles };
    return tiles;
  }

  get slidesTotal() {
    return this._slides().length;
  }

  get openState() {
    return this.getProp('open');
  }

  get current() {
    if (this._current !== null) return this._normalizeCurrent(this._current);
    return this._normalizeCurrent(this.getProp('current') || 1);
  }

  // current is a value a page may also write (§4.3): the picture to show.
  set current(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('current');
    else this.setAttribute('current', String(value));
  }

  _normalizeCurrent(value) {
    const total = this.slidesTotal;
    const parsed = Number.parseInt(String(value || 1), 10);
    const safe = Number.isFinite(parsed) ? parsed : 1;
    return total ? Math.min(Math.max(safe, 1), total) : Math.max(safe, 1);
  }

  _setCurrent(index, source = 'api', { emit = true } = {}) {
    const next = this._normalizeCurrent(index);
    const previous = this.current;
    this._current = next;
    if (String(this.getAttribute('current') ?? '') !== String(next)) {
      this._syncing = true;
      this.setAttribute('current', String(next));
      this._syncing = false;
    }
    if (source !== 'lightbox' && this._viewing) viewer.view(this._viewerItems(), { ...this._viewerOptions(), start: next });
    // The thumbnails look draws the shown picture: a drawing, not a DOM update.
    if (this.getProp('layout') === 'thumbnails') this.requestComponentUpdate('shown');
    if (emit && next !== previous) {
      // §8: data only; sf-change follows with the same detail until the date.
      this.sfEmit('change', { previous, current: next, total: this.slidesTotal, from: source });
    }
    return next;
  }

  // ── selection (C150 (9)) ──
  get selected() {
    return [...this._selected].sort((a, b) => a - b);
  }

  set selected(value) {
    const list = Array.isArray(value) ? value : String(value ?? '').split(/[\s,]+/u);
    const total = this.slidesTotal;
    this._selected = new Set(list.map((one) => Number.parseInt(String(one), 10))
      .filter((one) => Number.isFinite(one) && one >= 1 && (!total || one <= total)));
    this.requestComponentUpdate('selected');
  }

  get _selecting() {
    return this.getProp('selection') === 'many';
  }

  _toggleSelected(index, range = false) {
    if (!this._selecting) return;
    if (range && this._lastPicked !== null) {
      const [from, to] = [Math.min(this._lastPicked, index), Math.max(this._lastPicked, index)];
      for (let one = from; one <= to; one += 1) this._selected.add(one);
    } else if (this._selected.has(index)) {
      this._selected.delete(index);
    } else {
      this._selected.add(index);
    }
    this._lastPicked = index;
    this._selectionChanged();
  }

  _selectionChanged() {
    this.requestComponentUpdate('selected');
    this.sfEmit('select', { selected: this.selected, count: this._selected.size, total: this.slidesTotal });
  }

  // ── drawing ──
  get state() {
    const props = this.getPropsContext();
    return {
      ...props,
      open: this.openState,
      current: this.current,
      rootClass: this.getRootClass(),
      slidesTotal: this.slidesTotal,
    };
  }

  _word(key, vars, count) {
    return this.sfWord(key, { vars, count });
  }

  templateContext() {
    const tiles = this._tiles();
    const total = tiles.length;
    const selecting = this._selecting;
    const selectedCount = selecting ? this._selected.size : 0;
    const ratio = ['1/1', '4/3', '16/9', 'auto'].includes(this.getProp('ratio')) ? this.getProp('ratio') : '1/1';
    const [w, h] = this.hasAttribute('ratio') && ratio !== 'auto' ? ratio.split('/') : [];
    const label = this.getAttribute('heading') || this.getAttribute('aria-label') || this._word('heading');
    return this.createTemplateContext({
      ...this.state,
      label,
      ratio,
      mainRatio: w && h ? `${w} / ${h}` : '',
      layout: this.getProp('layout') === 'thumbnails' ? 'thumbnails' : 'grid',
      tileSize: ['s', 'm', 'l'].includes(this.getProp('tileSize')) ? this.getProp('tileSize') : 'm',
      caption: this.getProp('caption') === 'under' ? 'under' : 'viewer',
      inline: this.getProp('inline') !== false,
      lightbox: this.getProp('lightbox') !== false,
      selecting,
      selectedCount,
      selectedText: this._word('selected-count', { count: selectedCount }, selectedCount),
      barLabel: this._word('selection'),
      clearLabel: this._word('clear-selection'),
      actions: this.hasSlotContent('actions') ? this.getSlotContent('actions') : '',
      countText: this._word('count', { n: this.current, total }),
      tiles: tiles.map((tile) => {
        const vars = { n: tile.index, total, alt: tile.alt };
        const thumbnails = this.getProp('layout') === 'thumbnails';
        return {
          index: tile.index,
          caption: tile.caption,
          picture: thumbnails ? null : tile.tilePicture(),
          mainPicture: thumbnails && tile.index === this.current ? tile.mainPicture() : null,
          thumbPicture: thumbnails && total > 1 ? tile.thumbPicture() : null,
          selected: selecting && this._selected.has(tile.index),
          openLabel: this._word(tile.alt ? 'open-picture-named' : 'open-picture', vars),
          thumbLabel: this._word(tile.alt ? 'show-picture-named' : 'show-picture', vars),
          pickLabel: this._word(tile.alt ? 'pick-picture-named' : 'pick-picture', vars),
        };
      }),
    });
  }

  template() {
    return renderGalleryTemplate(this.templateContext());
  }

  resolveUpdateMode(changedAttributes = []) {
    if (changedAttributes.length > 0 && changedAttributes.every((name) => name === 'open' || name === 'current')) {
      return 'dom';
    }
    return 'lit';
  }

  updateDom(changedAttributes = []) {
    if (this.resolveUpdateMode(changedAttributes) !== 'dom') return false;
    if (this._syncing) return true;
    if (changedAttributes.includes('current')) this._setCurrent(this.getProp('current'), 'api', { emit: false });
    if (changedAttributes.includes('open')) {
      if (this.openState && !this._viewing) this.open();
      else if (!this.openState && this._viewing) viewer.close();
    }
    return true;
  }

  afterRender() {
    // A gallery the page opened in its markup (open) opens once it has drawn.
    if (this.openState && !this._viewing && this.isConnected) requestAnimationFrame(() => this.openState && !this._viewing && this.open());
  }

  // ── the viewer ──
  _viewerItems() {
    return this._tiles().map((tile) => tile.item);
  }

  _viewerOptions() {
    return {
      label: this.getAttribute('heading') || this._word('heading'),
      loop: this.getProp('loop') === true,
      onChange: ({ current }) => this._setCurrent(current, 'lightbox'),
      onClose: ({ current }) => this._viewerClosed(current),
    };
  }

  // Where the focus goes when the viewer closes (GL-5, C150 (7)): the tile of
  // the picture the person ended on (or the main picture), else whatever
  // opened the viewer.
  _returnTarget(opener) {
    return (current) => {
      const tile = this.querySelector(`[data-sf-gallery-open="${current}"]`)
        || this.querySelector('.sf-gallery-main [data-sf-gallery-open]');
      if (tile instanceof HTMLElement && tile.isConnected && tile.getClientRects().length) return tile;
      return opener;
    };
  }

  _viewerClosed(current) {
    this._viewing = false;
    if (this.hasAttribute('open')) {
      this._syncing = true;
      this.removeAttribute('open');
      this._syncing = false;
    }
    this.sfEmit('closed', { current, total: this.slidesTotal });
  }

  // The actions (§4.4) answer outcomes. `index` comes as a number or as
  // {index}, the manifest's parameter object.
  open(index = null) {
    const at = index && typeof index === 'object' ? index.index : index;
    if (this.getProp('lightbox') === false) return { outcome: 'refused', reason: 'no-lightbox' };
    const items = this._viewerItems();
    if (!items.length) return { outcome: 'refused', reason: 'empty' };
    if (at !== null && typeof at !== 'undefined') this._setCurrent(at, 'api');
    const active = document.activeElement;
    const opener = active && active !== document.body ? active : null;
    this._viewing = true;
    viewer.view(items, { ...this._viewerOptions(), start: this.current, opener: this._returnTarget(opener) });
    if (!this.hasAttribute('open')) {
      this._syncing = true;
      this.setAttribute('open', '');
      this._syncing = false;
    }
    this.sfEmit('opened', { current: this.current, total: items.length });
    return applied();
  }

  close() {
    if (!this._viewing && !this.openState) return { outcome: 'refused', reason: 'closed' };
    if (this._viewing) viewer.close();
    else this.removeAttribute('open');
    return applied();
  }

  toggle(index = null) {
    return this._viewing ? this.close() : this.open(index);
  }

  goTo(index) {
    const at = index && typeof index === 'object' ? index.index : index;
    if (!Number.isFinite(Number.parseInt(String(at), 10))) return { outcome: 'refused', reason: 'invalid' };
    this._setCurrent(at, 'api');
    return applied();
  }

  next() {
    const total = this.slidesTotal;
    const next = this.getProp('loop') === true && this.current >= total ? 1 : this.current + 1;
    return this.goTo(next);
  }

  prev() {
    const total = this.slidesTotal;
    const prev = this.getProp('loop') === true && this.current <= 1 ? total : this.current - 1;
    return this.goTo(prev);
  }

  clearSelection() {
    if (!this._selected.size) return { outcome: 'refused', reason: 'empty' };
    this._selected.clear();
    this._lastPicked = null;
    this._selectionChanged();
    return applied();
  }

  // §4.4: the readers of the slider and the window retire; kept until the
  // date and noted on each call. There is no slider or window to give.
  getModal() {
    noteRetired('getModal');
    return null;
  }

  getInlineSlider() {
    noteRetired('getInlineSlider');
    return null;
  }

  getLightboxSlider() {
    noteRetired('getLightboxSlider');
    return null;
  }

  // ── the person ──
  _handleClick(event) {
    if (this._swallowClick) {
      this._swallowClick = false;
      event.preventDefault();
      return;
    }
    const clear = event.target.closest?.('[data-sf-gallery-clear]');
    if (clear) {
      this.clearSelection();
      this.querySelector('[data-sf-gallery-open]')?.focus?.();
      return;
    }
    if (event.target.closest?.('.sf-figure-pick')) return;
    const thumb = event.target.closest?.('[data-sf-gallery-thumb]');
    if (thumb) {
      this._setCurrent(Number(thumb.getAttribute('data-sf-gallery-thumb')), 'inline');
      return;
    }
    const trigger = event.target.closest?.('[data-sf-gallery-open]');
    if (!trigger) return;
    const index = Number.parseInt(trigger.getAttribute('data-sf-gallery-open') || '1', 10);
    // Once anything is chosen, a press on a tile chooses; Shift a range.
    if (this._selecting && (this._selected.size || event.shiftKey)) {
      event.preventDefault();
      this._toggleSelected(index, event.shiftKey);
      return;
    }
    if (this.getProp('lightbox') === false) return;
    this.open(index);
  }

  _handleChange(event) {
    const box = event.target.closest?.('[data-sf-gallery-pick]');
    if (!box) return;
    // The check box's change is the gallery's select, not the page's change.
    event.stopPropagation();
    this._toggleSelected(Number(box.getAttribute('data-sf-gallery-pick')), Boolean(this._shiftPick));
    this._shiftPick = false;
  }

  _handleKeyDown(event) {
    if (event.target.closest?.('[data-sf-gallery-pick]')) this._shiftPick = event.shiftKey;
    if (event.key === 'Escape' && this._selecting && this._selected.size && !event.defaultPrevented) {
      event.preventDefault();
      this.clearSelection();
      return;
    }
    const thumb = event.target.closest?.('[data-sf-gallery-thumb]');
    if (!thumb || event.altKey || event.ctrlKey || event.metaKey) return;
    const total = this.slidesTotal;
    const rtl = getComputedStyle(thumb).direction === 'rtl';
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key];
    let next;
    if (step) next = this.current + step;
    else if (event.key === 'Home') next = 1;
    else if (event.key === 'End') next = total;
    else return;
    event.preventDefault();
    next = Math.min(Math.max(next, 1), total);
    this._setCurrent(next, 'inline');
    requestAnimationFrame(() => this.querySelector(`[data-sf-gallery-thumb="${next}"]`)?.focus());
  }

  // A phone has no hover: a long press on a tile chooses it, and then the
  // check boxes show on every tile (C150 (9)).
  _handlePointerDown(event) {
    if (event.target.closest?.('[data-sf-gallery-pick]')) this._shiftPick = event.shiftKey;
    if (!this._selecting || event.pointerType !== 'touch') return;
    const trigger = event.target.closest?.('[data-sf-gallery-open]');
    if (!trigger) return;
    clearTimeout(this._press?.timer);
    const press = { x: event.clientX, y: event.clientY };
    press.timer = setTimeout(() => {
      this._press = null;
      this._swallowClick = true;
      this._toggleSelected(Number(trigger.getAttribute('data-sf-gallery-open')));
    }, LONG_PRESS_MS);
    press.move = (moveEvent) => {
      if (Math.hypot(moveEvent.clientX - press.x, moveEvent.clientY - press.y) > LONG_PRESS_SLOP) this._handlePointerEnd();
    };
    this.addEventListener('pointermove', press.move);
    this._press = press;
  }

  _handlePointerEnd() {
    const press = this._press;
    if (!press) return;
    clearTimeout(press.timer);
    this.removeEventListener('pointermove', press.move);
    this._press = null;
  }
}

SfGallery.define('sf-gallery');
SfGallery.bindGlobalDelegation();
