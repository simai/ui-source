// sf-pager: navigation to the neighbouring document by meaning (decision C97,
// 2026-11-12), in three looks: cards (the previous and the next page at the
// bottom of documentation), row (the previous and the next article) and
// counter («‹ 3 из 240 ›» in a record card: the record's place in its list,
// across the list's pages, with keys and the way back to the list). Not list
// paging: sf-pagination keeps 1, 2, 3 ….
//
// steps and course still draw until 2027-01-01, each use noted in
// SF.deprecations (change journal value-pager-steps-course-retired): a
// wizard's steps are sf-wizard's, and no product walks a course. Image
// counters and dots are sf-gallery's and sf-slider's.
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
import {applied, refused, elementFromManifest} from '../../core/js/element-manifest';
import {renderPagerTemplate} from './js/templates/default';
import {noteDeprecated} from '../../core/js/deprecations.js';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';


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

// The looks that leave sf-pager (C97): steps for sf-wizard, course with no
// product to walk one.
const RETIRED = {steps: 'sf-wizard', course: null};

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

  // The current place clamped to what there is; the template reads it as
  // `at`.
  get at() {
    const {count, open} = this.span;
    if (open) return Math.max(0, Math.trunc(Number(this.current)) || 0);
    return clampIndex(this.current, count);
  }

  // How many places the walk has. counter's records are the list's: total
  // says how many there are across the list's pages, so a record card walks
  // past the page it was opened from and the host loads the next one when
  // asked (navigate carries the index). Without total the count is not
  // known unless items is the whole list and has-next is off: the walk is
  // then open ahead («3 из многих»), Next while has-next says so. Every other
  // look walks items.
  get span() {
    const length = this.list.length;
    if (this.appearance !== 'counter') return {count: length, open: false};
    const total = Math.trunc(Number(this.total));
    if (Number.isFinite(total) && total > 0) return {count: total, open: false};
    if (length && !this.hasNext) return {count: length, open: false};
    return {count: Math.max(length, this.at0 + 1), open: true};
  }

  // current as written, a whole number from 0.
  get at0() {
    const number = Math.trunc(Number(this.current));
    return Number.isFinite(number) && number > 0 ? number : 0;
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
    if (this.appearance === 'counter') return this.moveRecord(direction, wanted, {person});
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

  // A move of counter: one record back or on, or to a place, in the list's
  // records (total, or items). The request names the record's place in the
  // whole list; a host that has not loaded that page loads it, or cancels and
  // goes there itself. An item with an address is opened.
  moveRecord(direction, wanted, {person = false} = {}) {
    const {count, open} = this.span;
    if (!count && !open) return refused('empty');
    const from = this.at;
    let index;
    if (direction === 'prev') {
      if (from <= 0) return refused('first');
      index = from - 1;
    } else if (direction === 'next') {
      if (open ? !this.hasNext : from >= count - 1) return refused('last');
      index = from + 1;
    } else {
      const number = Math.max(0, Math.trunc(Number(wanted)) || 0);
      index = open ? number : Math.min(count - 1, number);
      if (index === from) return refused('current');
      direction = 'go-to';
    }
    const item = this.list[index] ?? null;
    const allowed = this.sfEmit('navigate', {direction, index, id: item?.id ?? null, href: item?.href || null}, {cancelable: true});
    if (!allowed) return refused('prevented');
    this.apply(index, false, person);
    if (item?.href) globalThis.location?.assign?.(item.href);
    return applied();
  }

  apply(index, complete, person) {
    const previous = this.at;
    const focused = this.focusedControl();
    this.current = index;
    this.complete = complete;
    this.sfHostState('data-complete', complete);
    const item = this.list[index];
    if (person) this.sfEmit('change', {previous, current: index, complete, item: item ? {...item} : null});
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

  // ArrowLeft / ArrowRight on the page (keys set), and for counter [ and ]
  // as well (the record keys of mail and trackers, which a record page does
  // not give to text): never in a field, never a key another component took,
  // never while the pager is not shown.
  onKey(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (this.appearance === 'counter' && (event.key === '[' || event.key === ']')) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(EDITABLE) || target?.isContentEditable) return;
      if (!this.shown || !this.querySelector(':scope > nav')?.getClientRects().length) return;
      const outcome = this.press(event.key === ']' ? 'next' : 'prev');
      if (outcome.outcome === 'applied') event.preventDefault();
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(EDITABLE) || target?.isContentEditable) return;
    if (!this.shown || !this.querySelector(':scope > nav')?.getClientRects().length) return;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const forward = (event.key === 'ArrowRight') !== rtl;
    const outcome = this.press(forward ? 'next' : 'prev');
    if (outcome.outcome === 'applied') event.preventDefault();
  }

  // A retired look still draws; its use is noted once (C97).
  noteRetired(appearance) {
    if (!(appearance in RETIRED)) return;
    noteDeprecated({
      component: 'sf-pager',
      tag: 'sf-pager',
      kind: 'value',
      attribute: 'appearance',
      from: appearance,
      to: RETIRED[appearance],
      since: '2026-11-12',
      remove_after: '2027-01-01',
    });
  }

  templateContext() {
    const list = this.list;
    const appearance = this.appearance;
    const {count: spanCount, open} = this.span;
    const current = appearance === 'counter' ? this.at : clampIndex(this.current, list.length);
    const count = appearance === 'counter' ? spanCount : list.length;
    const n = count || open ? current + 1 : 0;
    const word = (key, vars) => this.sfWord(key, vars ? {vars} : {});
    this.noteRetired(appearance);
    const place = appearance === 'steps' ? word('step', {n, count})
      : appearance === 'course' ? word('lesson', {n, count})
        : appearance === 'counter' ? (open ? word('position-many', {n}) : word('position', {n, count})) : '';
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
      count,
      hasNextRecord: open ? Boolean(this.hasNext) : current < count - 1,
      listHref: appearance === 'counter' ? text(this.listHref) : '',
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
        toList: word('to-list'),
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
