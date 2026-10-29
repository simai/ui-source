// sf-pager: navigation to the neighbouring page or step by meaning -- the
// previous and the next documentation page, a wizard's steps, a course's
// lessons, a record counter. Not list paging: sf-pagination keeps 1, 2, 3 ….
//
// One input, two forms. cards and row take two sides from string settings
// (prev-href, prev-title, next-href, next-title), so a server prints plain
// links that work without the script; without them a side is the neighbour
// in items. steps, course and counter read items and current.
//
// Every move a person makes is first the cancelable request
// sf-pager-navigate (vocabulary 1.1.5 §5 navigate {id, href}, with direction
// and index): a page cancels it to keep a step that is not valid yet, or to
// go there itself. A move in items is then the fact sf-pager-change. A
// link's request is followed by the browser, not by a change.
//
// From its component.json (standard simai.smart-component 1.3.13 §3, §4,
// §8): the settings and values are made by core/js/element-manifest.js,
// prev, next and go-to are the actions and answer outcomes, the words are
// the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {renderPagerTemplate} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

const applied = () => ({outcome: 'applied'});
const refused = (reason) => ({outcome: 'refused', reason});

// A key pressed in a field is the field's: the keys setting never takes it.
const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"], [role="spinbutton"], [role="slider"]';

const text = (value) => (value === undefined || value === null ? '' : String(value));

// items as given: a list of objects with a title; anything else is left out.
export function normalizeItems(value) {
  const list = Array.isArray(value) ? value : [];
  return list
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => ({
      id: text(item.id) || String(index),
      title: text(item.title),
      href: text(item.href),
      meta: text(item.meta),
    }));
}

// current clamped to items (0 with no items).
export function clampIndex(value, length) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number) || length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, number));
}

const PagerElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  actions: {
    prev() { return this.move('prev'); },
    next() { return this.move('next'); },
    'go-to'({index} = {}) { return this.move('go-to', index); },
  },
});

class SfPager extends PagerElement {
  constructor() {
    super();
    this._onKey = (event) => this.onKey(event);
    this._keysBound = false;
  }

  static get observedAttributes() {
    return [...new Set([...super.observedAttributes, 'dir'])];
  }

  onConnected() {
    super.onConnected?.();
    this.sfHostState('data-complete', this.complete);
    this.bindKeys();
  }

  disconnectedCallback() {
    this.unbindKeys();
    super.disconnectedCallback?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name === 'keys' && oldValue !== newValue && this.isConnected) this.bindKeys();
    if (name === 'complete' && oldValue !== newValue) this.sfHostState('data-complete', this.complete);
  }

  get list() {
    return normalizeItems(this.items);
  }

  // The current place clamped to items; the template reads it as `at`.
  get at() {
    return clampIndex(this.current, this.list.length);
  }

  // One side of cards or row: the settings first, else the neighbour in items.
  sideOf(which) {
    const href = which === 'prev' ? this.prevHref : this.nextHref;
    const title = which === 'prev' ? this.prevTitle : this.nextTitle;
    if (href || title) return {href: text(href), title: text(title) || text(href), index: null, id: null};
    const list = this.list;
    if (!list.length) return null;
    const index = this.at + (which === 'prev' ? -1 : 1);
    const item = list[index];
    return item ? {href: item.href, title: item.title, index, id: item.id} : null;
  }

  // A press on a side of cards or row.
  onSide(event, which) {
    const target = this.sideOf(which);
    if (!target) return;
    // A link opened in a new tab or window: the page stays, nothing is asked.
    if (target.href && (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    const allowed = this.sfEmit('navigate', {direction: which, index: target.index, id: target.id, href: target.href || null}, {cancelable: true});
    if (!allowed) {
      event.preventDefault();
      return;
    }
    // A link: the browser follows it. A side from items with no address
    // moves the place.
    if (!target.href && target.index !== null) this.apply(target.index, false, true);
  }

  // A move in items: the request, then the place, then the fact.
  //
  // person: a press, a key or a side of cards and row, reported by change;
  // an action called by a page asks the same request and moves silently (§8:
  // a value set from outside is not reported back).
  move(direction, wanted, {person = false} = {}) {
    const list = this.list;
    if (!list.length) return refused('empty');
    const from = this.at;
    const finishing = this.appearance === 'steps' || this.appearance === 'course';
    let index;
    let complete = false;
    if (direction === 'prev') {
      if (from <= 0) return refused('first');
      index = from - 1;
    } else if (direction === 'next') {
      if (from >= list.length - 1) {
        if (!finishing || this.complete) return refused('last');
        index = from;
        complete = true;
        direction = 'finish';
      } else {
        index = from + 1;
      }
    } else if (direction === 'restart') {
      index = 0;
    } else {
      index = clampIndex(wanted, list.length);
      if (index === from && !this.complete) return refused('current');
    }
    const item = list[index];
    const allowed = this.sfEmit('navigate', {direction, index, id: item.id, href: item.href || null}, {cancelable: true});
    if (!allowed) return refused('prevented');
    this.apply(index, complete, person);
    // An item with an address is a page of its own: go there.
    if (item.href && direction !== 'finish') globalThis.location?.assign?.(item.href);
    return applied();
  }

  apply(index, complete, person) {
    const previous = this.at;
    const focused = this.focusedControl();
    this.current = index;
    this.complete = complete;
    this.sfHostState('data-complete', complete);
    if (person) this.sfEmit('change', {previous, current: index, complete, item: {...this.list[index]}});
    this.keepFocus(focused);
  }

  // A press on a control of steps, course or counter.
  press(direction) {
    return this.move(direction, undefined, {person: true});
  }

  // Which of the pager's two controls had focus before a move.
  focusedControl() {
    const active = document.activeElement;
    if (!active || !this.contains(active)) return '';
    if (active.closest('.sf-pager-back')) return 'back';
    if (active.closest('.sf-pager-forward')) return 'forward';
    if (active.closest('.sf-pager-lesson-action')) return 'lesson';
    return '';
  }

  // A control that became disabled, or was drawn anew, hands focus on: the
  // same control while it can take it, else the other one (§19.2's rule that
  // focus never falls to the page).
  keepFocus(was) {
    if (!was) return;
    const settle = () => {
      const pick = (name) => {
        const host = this.querySelector(`:scope .sf-pager-${name}`);
        const button = host?.querySelector('button') ?? host;
        return button && !button.disabled && button.getClientRects().length ? button : null;
      };
      const order = was === 'back' ? ['back', 'forward'] : was === 'forward' ? ['forward', 'back', 'lesson-action'] : ['lesson-action', 'forward'];
      const target = order.map(pick).find(Boolean);
      if (target && document.activeElement !== target) target.focus({preventScroll: true});
    };
    // Lit draws in a microtask and the buttons theirs after it.
    if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(settle);
    else Promise.resolve().then(settle);
  }

  bindKeys() {
    const want = Boolean(this.keys) && this.isConnected;
    if (want && !this._keysBound) {
      document.addEventListener('keydown', this._onKey);
      this._keysBound = true;
    } else if (!want) {
      this.unbindKeys();
    }
  }

  unbindKeys() {
    if (!this._keysBound) return;
    document.removeEventListener('keydown', this._onKey);
    this._keysBound = false;
  }

  // ArrowLeft / ArrowRight on the page (keys set): never in a field, never a
  // key another component took, never while the pager is not shown.
  onKey(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(EDITABLE) || target?.isContentEditable) return;
    if (!this.shown || !this.querySelector(':scope > nav')?.getClientRects().length) return;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const forward = (event.key === 'ArrowRight') !== rtl;
    const outcome = this.press(forward ? 'next' : 'prev');
    if (outcome.outcome === 'applied') event.preventDefault();
  }

  templateContext() {
    const list = this.list;
    const current = clampIndex(this.current, list.length);
    const count = list.length;
    const n = count ? current + 1 : 0;
    const appearance = this.appearance;
    const word = (key, vars) => this.sfWord(key, vars ? {vars} : {});
    const place = appearance === 'steps' ? word('step', {n, count})
      : appearance === 'course' ? word('lesson', {n, count})
        : appearance === 'counter' ? word('position', {n, count}) : '';
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      appearance,
      size: this.size,
      label: this.label,
      prevLabel: this.prevLabel,
      nextLabel: this.nextLabel,
      doneLabel: this.doneLabel,
      prev: appearance === 'cards' || appearance === 'row' ? this.sideOf('prev') : null,
      next: appearance === 'cards' || appearance === 'row' ? this.sideOf('next') : null,
      list,
      at: current,
      complete: Boolean(this.complete),
      placeText: place,
      words: {
        nextLesson: word('next-lesson'),
        lastLesson: word('last-lesson'),
        start: word('start'),
        finished: word('finished'),
        restart: word('restart'),
        prevItem: word('prev-item'),
        nextItem: word('next-item'),
      },
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderPagerTemplate(this.templateContext());
  }
}

SfPager.define('sf-pager');

export {SfPager};
