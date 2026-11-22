// sf-bulk-actions: the group actions bar of a list while items are selected
// (owner decisions C291 (1) and C295, 2026-11-17; study ui-control
// control/research/2026-11-17-sf-bulk-actions/README.md, prototype
// prototypes/sf-bulk-actions-study.html, variant A).
//
//   <sf-bulk-actions count="2" page-count="12" total="240"></sf-bulk-actions>
//   bar.actions = [{id: 'publish', text: 'Опубликовать', icon: 'public'},
//                  {id: 'archive', text: 'В архив', icon: 'archive', undo: true},
//                  {id: 'delete', text: 'Удалить', icon: 'delete'}];
//
// One bar instead of the four copies sf-pagination, sf-view, sf-view-table and
// sf-gallery drew. It is shown while count is above 0: «Выбрано N» and the
// clear cross at the end; up to three labelled actions, the rest in «⋯» (the
// page's one menu, SF.menu.open, C184 (4)), a dangerous action last in it
// after a line and asked about first in the question window (sf-modal
// size="question" with sf-confirm appearance="window", C39). A reversible
// action runs at once and the notice offers «Отменить» (SF.notify, C25).
// After the page is selected, «Выбрать все N» takes all under the filter
// (all-selected, «Только эта страница» back). A short run shows in the bar
// (progress()). Where a result goes (owner decision C387, 2026-11-19, refining
// C295 and C331): a fast action's result is said in the bar in place of the
// count («Удалено: 5», then back), or which failed; a long one (more than 100
// items, or long: true) goes in the background and ends with a notice
// (SF.notify); a failure is written to «Уведомления» too (the notice's
// sf-notification record). The focus is never moved into the bar; Esc in the
// list or the bar clears the selection.
//
// The host list owns the selection, what «all under the filter» means, doing
// an action, undoing it and which items failed: the bar only says and asks.
//
// From its component.json (standard simai.smart-component 1.3.16 §3, §4, §8):
// the settings are made by core/js/element-manifest.js, the words are the
// language files'.
import {nothing} from 'lit';
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {openLayers} from '../../core/js/layer-stack';
import {pageLocale} from '../../core/js/page-language';
import {BREAKPOINTS} from '../../core/js/breakpoints.js';
import {isDestructiveAction, orderActions} from './js/danger.js';
import {LONG_OVER, VISIBLE, VISIBLE_COMPACT, actionsThatFit, foldActions, isLongAction, normalizeAction, number, resultRoute, splitActions} from './js/actions.js';
import {renderBulkActionsTemplate} from './js/templates/default';
import manifest from './component.json';
import './scss/index.scss';
import {files as languageFiles} from './lang/index.mjs';

export {actionsThatFit, foldActions, isDestructiveAction, isLongAction, normalizeAction, orderActions, resultRoute, splitActions};

const SIZES = ['1/2', '1', '2'];
const PLACES = ['dock', 'top', 'float', 'inline'];
// A run longer than this many items is a job: the host's sf-progress-run (C34).
const SHORT_RUN = LONG_OVER;
// How long a fast action's result stays in the bar before it goes back (C387).
const DONE_FOR = 4000;
// The failed items a notice names before «и ещё N».
const NAMED_FAILURES = 3;
// The live region speaks after the selection settles (Carbon, Shopify).
const SAY_AFTER = 300;
// The «⋯» row of the folded offer (C309 (1)): an id no action of a host takes.
const OFFER_ENTRY = 'sf-bulk-actions-offer';

const BulkActionsElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
  source: 'ru',
  actions: {
    progress({done, total, text} = {}) {
      return this.showProgress({done, total, text});
    },
    result({id, ok, failed, text} = {}) {
      return this.showResult({id, ok, failed, text});
    },
    clear() {
      this.clear();
      return undefined;
    },
  },
});

class SfBulkActions extends BulkActionsElement {
  constructor() {
    super();
    this._run = null;
    this._result = null;
    // A fast action's result said in place of the count, or a long one's
    // start (C387): {text, kind: done | background}, for DONE_FOR.
    this._done = null;
    // The actions sent and not answered yet, by id: what result() reports on.
    this._sent = new Map();
    this._announcement = '';
    this._compact = false;
    // C309 (1): on a phone the offer «Выбрать все N» goes into «⋯» when the
    // row would take a second line; _offerFold is the bar's width it was
    // folded at, so it comes back only on a wider bar (no flicker).
    this._offerFold = null;
    // LV3-27, LV4-23: the fold by width. _fit is how many of the visible
    // actions stand in the row (null: all of them), _fitAt the bar's width
    // it last folded or tried at, _widths each action button's measured
    // width (by id, words, size and phone), _fitSig what the row was made of.
    this._fit = null;
    this._fitAt = 0;
    this._widths = new Map();
    this._fitSig = '';
    this._onKey = (event) => this.onDocumentKey(event);
  }

  connectedCallback() {
    super.connectedCallback?.();
    this.ownerDocument.addEventListener('keydown', this._onKey);
    this.watchWidth();
  }

  disconnectedCallback() {
    this.ownerDocument.removeEventListener('keydown', this._onKey);
    this._widthObserver?.disconnect();
    this._widthObserver = null;
    this._rowObserver?.disconnect();
    this._rowObserver = null;
    cancelAnimationFrame(this._fitFrame);
    cancelAnimationFrame(this._compactFrame);
    clearTimeout(this._sayTimer);
    clearTimeout(this._doneTimer);
    super.disconnectedCallback?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback?.(name, oldValue, newValue);
    if (oldValue === newValue) return;
    if (name === 'count' || name === 'all-selected') this.selectionChanged(name, oldValue);
  }

  // The selection moved: «Выбрать все N» lasts while the page stays selected
  // (any other change resets it), a result lasts while its failed items are
  // what is selected, and the live region says the new count.
  selectionChanged(name, oldValue) {
    const count = this.selectedCount;
    if (name === 'count' && this.allSelected && this.pageCount && count !== this.pageCount) {
      this.removeAttribute('all-selected');
      return;
    }
    if (this._result && count !== this._result.failed.length) this._result = null;
    // A new selection takes the place of a said result; the selection going
    // to none after the action (the rows it deleted) leaves it said.
    if (this._done && count > 0 && name === 'count') this.endDone({update: false});
    if (this._run) return;
    const before = name === 'count' ? number(oldValue) : count;
    if (this._done && count === 0) return;
    const all = this.allSelected && this.total ? this.total : 0;
    if (count > 0) this.say(() => (all ? this.word('all-text', all) : this.word('count-text', count)));
    else if (before > 0) this.say(() => this.sfWord('cleared-text'));
  }

  // The size the host gives, or the nearest sized element's around it (the
  // list that places it), or 1.
  get size() {
    const own = this.getAttribute('size');
    if (SIZES.includes(own)) return own;
    const around = this.parentElement?.closest?.('[size]')?.getAttribute('size');
    return SIZES.includes(around) ? around : '1';
  }

  get place() {
    const value = this.getAttribute('place');
    return PLACES.includes(value) ? value : 'dock';
  }

  get selectedCount() {
    return number(this.getAttribute('count'));
  }

  get pageCount() {
    return number(this.getAttribute('page-count'));
  }

  get total() {
    return number(this.getAttribute('total'));
  }

  get allSelected() {
    const raw = this.getAttribute('all-selected');
    return raw !== null && raw !== 'false';
  }

  /** How many the next action goes to: all under the filter, or the selection. */
  get effectiveCount() {
    return this.allSelected && this.total ? this.total : this.selectedCount;
  }

  /** What the bar does now: idle, running a short run, showing a result or a done line. */
  get runState() {
    if (this._run) return 'running';
    if (this._result) return 'result';
    if (this._done) return 'done';
    return this.selectedCount > 0 ? 'shown' : 'hidden';
  }

  word(key, count, vars) {
    return this.sfWord(key, {count, vars});
  }

  formatNumber(value) {
    try {
      return new Intl.NumberFormat(pageLocale(this) || undefined).format(value);
    } catch {
      return String(value);
    }
  }

  // The live region, after the selection settles. A line made of the
  // element's own words is passed as a function and made when it is spoken
  // and at every drawing after, so it is in the page's language even when the
  // language part arrives after the mark that asked for it (view round 10,
  // V10-1: the first mark spoke «1 selected» on a Russian page while the
  // part was 400 ms late). The function holds the numbers of its moment.
  say(text) {
    clearTimeout(this._sayTimer);
    this._sayTimer = setTimeout(() => {
      this._announcement = text;
      this.requestComponentUpdate('announcement');
    }, SAY_AFTER);
  }

  get announcement() {
    const said = this._announcement;
    if (typeof said !== 'function') return said ?? '';
    try {
      return String(said() ?? '');
    } catch {
      return '';
    }
  }

  // Compact below the Framework's sm step, measured on the box the bar
  // stands in (a narrow panel is a phone too).
  watchWidth() {
    const box = this.parentElement;
    if (!box || typeof ResizeObserver !== 'function') return;
    const measure = () => {
      const rem = Number.parseFloat(getComputedStyle(this.ownerDocument.documentElement).fontSize) || 16;
      const width = box.getBoundingClientRect().width || globalThis.innerWidth || 0;
      const compact = width > 0 && width < Number.parseFloat(BREAKPOINTS.sm) * rem;
      if (compact === this._compact) return;
      this._compact = compact;
      this.requestComponentUpdate('compact');
    };
    // From the observer the switch is made in the next frame (BB-2): drawn
    // inside its call, the new row resized the box it watches and the browser
    // reported a «ResizeObserver loop» on every widening past the sm step.
    this._widthObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this._compactFrame);
      this._compactFrame = requestAnimationFrame(measure);
    });
    this._widthObserver.observe(box);
    measure();
  }

  // One line on a phone (owner decision C309 (1), 2026-11-18): the bar never
  // wraps under a finger. When its row would take a second line with the
  // offer «Выбрать все N» (or «Только эта страница») shown -- size 1 with a
  // count of hundreds, 90 px in two rows before -- the offer moves into «⋯»
  // as its first row, and comes back when the bar is wider than the width it
  // left at. Read after each draw and on every change of the bar's size.
  afterRender() {
    const root = this.querySelector(':scope > .sf-bulk-actions');
    if (root && typeof ResizeObserver === 'function' && this._rowRoot !== root) {
      this._rowObserver?.disconnect();
      this._rowRoot = root;
      // The fit is made in the next frame, not inside the observer's call: a
      // fold changes the bar's height, and a change made while the observer
      // delivers is reported as a «ResizeObserver loop» error (LV3-27).
      this._rowObserver = new ResizeObserver(() => {
        cancelAnimationFrame(this._fitFrame);
        this._fitFrame = requestAnimationFrame(() => this.fitRow());
      });
      this._rowObserver.observe(root);
    }
    this.fitRow();
    // The held row keeps its size when a button comes in late (a new action
    // button draws after the bar, and clipped it moves no edge the observer
    // sees): the fit is read again in the next frame, once it has drawn.
    cancelAnimationFrame(this._fitFrame);
    this._fitFrame = requestAnimationFrame(() => this.fitRow());
  }

  rowWraps(root) {
    const parts = [...root.querySelectorAll('.sf-bulk-actions__count, .sf-bulk-actions__offer > button, .sf-bulk-actions__actions > * > button, .sf-bulk-actions__more > button, .sf-bulk-actions__clear > button')]
      .map((part) => part.getBoundingClientRect()).filter((box) => box.height > 0);
    if (parts.length < 2) return false;
    const middles = parts.map((box) => box.top + box.height / 2);
    return Math.max(...middles) - Math.min(...middles) > Math.min(...parts.map((box) => box.height)) / 2;
  }

  // The width the row needs on one line (BB-1): the held row never wraps, its
  // parts shrink and overflow instead, so the need is the parts' own widths --
  // a group (the start, the end, the actions) is the sum of its items and its
  // gaps, a host drawn as display: contents is its button.
  rowNeed(element) {
    const items = [];
    const take = (node) => {
      for (const child of node.children) {
        const style = getComputedStyle(child);
        if (style.display === 'none') continue;
        if (style.display === 'contents') take(child);
        else items.push(child);
      }
    };
    take(element);
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
    const widths = items.map((item) => (item.matches('.sf-bulk-actions__lead, .sf-bulk-actions__end, .sf-bulk-actions__actions')
      ? this.rowNeed(item) : item.getBoundingClientRect().width)).filter((width) => width > 0);
    return widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * gap;
  }

  // Whether the row does not fit: on the held row (sf-bulk-actions--held,
  // one line, clipped) by width; on a row that may wrap (a done line or a
  // result) by its parts' lines.
  rowOverflows(root) {
    if (!root.classList.contains('sf-bulk-actions--held')) return this.rowWraps(root);
    const style = getComputedStyle(root);
    const inner = root.clientWidth - (Number.parseFloat(style.paddingInlineStart) || 0) - (Number.parseFloat(style.paddingInlineEnd) || 0);
    return this.rowNeed(root) > inner + 0.5;
  }

  fitRow() {
    const root = this._rowRoot;
    if (!root || !root.isConnected || root.hidden) return;
    const width = root.getBoundingClientRect().width;
    if (!(width > 0)) return;
    // Nothing is measured before the bar's own sheet draws it as a row: an
    // unstyled bar stacks its parts and would fold every action (and keep
    // their unstyled widths). The sheet's arrival resizes the bar, and the
    // observer fits it then.
    if (getComputedStyle(root).display !== 'flex') return;
    this.measureActions(root);
    if (!this._compact) {
      if (this._offerFold !== null) {
        this._offerFold = null;
        this.requestComponentUpdate('offer-fold');
        return;
      }
    } else {
      // C309 (1): on a phone the offer goes first, then the actions.
      const offerShown = Boolean(root.querySelector('.sf-bulk-actions__offer'));
      if (this._offerFold === null) {
        if (offerShown && this.rowOverflows(root)) {
          this._offerFold = width;
          this.requestComponentUpdate('offer-fold');
          return;
        }
      } else if (width > this._offerFold + 1) {
        this._offerFold = null;
        this.requestComponentUpdate('offer-fold');
        return;
      }
    }
    this.fitActions(root, width);
  }

  widthKey(action) {
    return `${action.id}|${action.text}|${this.size}|${this._compact ? 'icon' : 'text'}`;
  }

  // The width of each action button drawn now, kept for when it is in «⋯».
  measureActions(root) {
    for (const host of root.querySelectorAll('.sf-bulk-actions__actions > .sf-bulk-actions__action')) {
      const id = host.getAttribute('data-sf-bulk-action') ?? host.querySelector('[data-sf-bulk-action]')?.getAttribute('data-sf-bulk-action');
      const button = host.localName === 'button' ? host : host.querySelector('button');
      const action = id ? this.findAction(id) : null;
      const box = button?.getBoundingClientRect();
      // A button without its sheet yet is not a width to keep.
      const styled = button && getComputedStyle(button).display.includes('flex');
      if (action && styled && box.width > 0) this._widths.set(this.widthKey(action), box.width);
    }
  }

  // The free width of the row beside what stands in it: the start slot, the
  // count and the offer, and the end group (the actions, «⋯», ×).
  rowRoom(root) {
    const style = getComputedStyle(root);
    const inner = root.clientWidth - (Number.parseFloat(style.paddingInlineStart) || 0) - (Number.parseFloat(style.paddingInlineEnd) || 0);
    return inner - this.rowNeed(root);
  }

  // LV3-27, LV4-23: the actions fold by width. While the row wraps the last
  // visible action goes into «⋯», one by one (the words never wrap and
  // «Выбрано N» stays on the line); when the row has room for the next one
  // by its measured width it comes back. One not measured yet is tried once
  // the bar is wider than where it last folded.
  fitActions(root, width) {
    const actions = root.querySelector('.sf-bulk-actions__actions');
    if (!actions) return;
    const shown = actions.querySelectorAll(':scope > .sf-bulk-actions__action').length;
    if (this.rowOverflows(root)) {
      if (shown > 0) {
        this._fit = shown - 1;
        this._fitAt = width;
        this.requestComponentUpdate('fit');
      }
      return;
    }
    if (this._fit === null) return;
    const base = this.baseSplit();
    const next = base.visible.slice(this._fit);
    if (!next.length) {
      this._fit = null;
      return;
    }
    const widths = next.map((action) => this._widths.get(this.widthKey(action)));
    if (!Number.isFinite(widths[0]) && width <= this._fitAt + 1) return;
    const gap = Number.parseFloat(getComputedStyle(actions).columnGap) || 0;
    const more = actions.querySelector(':scope > .sf-bulk-actions__more > button')?.getBoundingClientRect().width ?? 0;
    const freed = !base.rest.length && !this.offerFolded ? more + gap : 0;
    // A pixel of slack: a measured width that rounds over the edge is not
    // taken back to wrap and fold again.
    const take = actionsThatFit({room: this.rowRoom(root) - 1, widths, gap, freed});
    if (take <= 0) return;
    const fit = this._fit + take;
    this._fit = fit >= base.visible.length ? null : fit;
    this._fitAt = width;
    this.requestComponentUpdate('fit');
  }

  get offerFolded() {
    return this._compact && this._offerFold !== null;
  }

  get actionList() {
    const actions = this.actions;
    return Array.isArray(actions) ? actions : [];
  }

  findAction(id) {
    return this.actionList.map(normalizeAction).find((action) => action?.id === id) ?? null;
  }

  // Why an action cannot go now: its own disabled, or a count outside its min
  // and max (C164 (4): pale, still reached, with its reason).
  unavailableReason(action, count = this.effectiveCount) {
    if (action.max && count > action.max) return action.reason || this.sfWord('max-reason', {vars: {max: this.formatNumber(action.max)}});
    if (action.min && count < action.min) return action.reason || this.sfWord('min-reason', {vars: {min: this.formatNumber(action.min)}});
    if (action.disabled) return action.reason || '';
    return null;
  }

  // Escape in the list or the bar clears the selection, unless a menu, a
  // window or a field took it first.
  onDocumentKey(event) {
    if (event.key !== 'Escape' || event.defaultPrevented || this.runState === 'hidden' || this._run) return;
    if (openLayers().length) return;
    const target = event.target;
    const editable = target?.isContentEditable
      || (target?.localName === 'textarea')
      || (target?.localName === 'input' && !['checkbox', 'radio', 'button'].includes(target.type));
    if (editable) return;
    const scope = this.parentElement;
    const inScope = target === this.ownerDocument.body || target === this.ownerDocument.documentElement
      || this.contains(target) || Boolean(scope?.contains?.(target));
    if (!inScope) return;
    event.preventDefault();
    this.clear('escape');
  }

  clear(reason = 'button') {
    this._result = null;
    this.endDone({update: false});
    const count = this.selectedCount;
    const all = this.allSelected;
    if (all) this.removeAttribute('all-selected');
    this.sfEmit('clear', {count, scope: all ? 'all' : 'selection', reason});
    this.requestComponentUpdate('clear');
  }

  selectAll() {
    if (!this.total) return;
    this.setAttribute('all-selected', '');
    this.sfEmit('select-all', {total: this.total, count: this.selectedCount});
    const total = this.total;
    this.say(() => this.word('all-text', total));
  }

  selectPage() {
    this.removeAttribute('all-selected');
    this.sfEmit('select-page', {count: this.selectedCount});
    const count = this.selectedCount;
    this.say(() => this.word('count-text', count));
  }

  pressAction(id, event) {
    const action = this.findAction(id);
    if (!action) return;
    if (this.unavailableReason(action) !== null) {
      event?.preventDefault?.();
      return;
    }
    this.runAction(action);
  }

  async openMore(anchor) {
    const {rest} = this.split();
    const count = this.effectiveCount;
    const entries = [];
    // C309 (1): the folded offer is the menu's first row.
    const offer = this.offerFolded ? this.currentOffer() : null;
    if (offer) entries.push({id: OFFER_ENTRY, text: offer.text, icon: offer.kind === 'all' ? 'select_all' : 'deselect'});
    // The menu itself draws a destructive row last, after a line (C164 (5)).
    rest.forEach((action) => {
      const reason = this.unavailableReason(action, count);
      entries.push({
        id: action.id,
        text: action.text,
        icon: action.icon || undefined,
        status: action.danger ? 'danger' : undefined,
        disabled: reason !== null,
        caption: reason || undefined,
      });
    });
    const open = globalThis.SF?.menu?.open;
    if (typeof open !== 'function') return;
    const button = anchor?.querySelector?.('button') ?? anchor;
    const choice = await open({anchor: button, entries, label: this.sfWord('more-text'), size: this.size});
    if (offer && choice?.id === OFFER_ENTRY) {
      if (offer.kind === 'all') this.selectAll();
      else this.selectPage();
      return;
    }
    const action = choice?.id ? this.findAction(choice.id) : null;
    if (action && this.unavailableReason(action) === null) this.runAction(action);
  }

  // One action: the question first when it deletes or asks for one (C39),
  // then the event the host does it on; a reversible one offers «Отменить»
  // in the notice (C25).
  async runAction(action, {retry = false} = {}) {
    const scope = this.allSelected && this.total && !retry ? 'all' : 'selection';
    const count = retry && this._result ? this._result.failed.length : this.effectiveCount;
    if (!count) return {outcome: 'refused', reason: 'empty'};
    if (action.confirm) {
      const yes = await this.ask(action, count, scope);
      if (!yes) return {outcome: 'refused', reason: 'declined'};
    }
    this._result = null;
    this.endDone({update: false});
    this._lastAction = action.id;
    // C387: long (more than 100 items, or the author's long) goes in the
    // background and ends with a notice; the host reads it here too.
    const long = isLongAction(action, count);
    const detail = {id: action.id, scope, count, long};
    const allowed = this.sfEmit('action', detail);
    this.requestComponentUpdate('action');
    if (!allowed) return {outcome: 'refused', reason: 'prevented'};
    this._sent.set(action.id, {action, detail});
    if (action.undo) this.offerUndo(action, detail);
    else if (long) this.showDone(this.sfWord('background-text', {vars: {action: action.text}}), 'background');
    return {outcome: 'applied'};
  }

  // A line in place of the count for DONE_FOR, then back (C387): a fast
  // action's «Удалено: 5», or a long one's start in the background.
  showDone(text, kind = 'done') {
    clearTimeout(this._doneTimer);
    this._done = {text, kind};
    this.say(text);
    this.requestComponentUpdate('done');
    this._doneTimer = setTimeout(() => this.endDone(), DONE_FOR);
  }

  endDone({update = true} = {}) {
    clearTimeout(this._doneTimer);
    if (!this._done) return;
    this._done = null;
    if (update) this.requestComponentUpdate('done');
  }

  // What a done action says: its own word («Удалено: 5») or «Готово: 5».
  doneLine(action, ok) {
    const n = this.formatNumber(ok);
    return action?.doneText
      ? this.sfWord('done-own-text', {count: ok, vars: {done: action.doneText, n}})
      : this.word('done-text', ok);
  }

  // «Опубликовать: не удалось 2 из 12».
  failureLine(action, shown) {
    return this.sfWord('failure-text', {count: shown.failed.length, vars: {
      action: action?.text ?? '', failed: this.formatNumber(shown.failed.length), total: this.formatNumber(shown.total)}});
  }

  // A failure for «Уведомления» (C331, C332, C341): one record with the
  // action, how many of how many, the first failed items and why. A long
  // action's is shown as an error notice that stays until closed (C339); a
  // fast one's only recorded (the bar shows it): SF.notify's sf-notification
  // event is what a notification centre writes down.
  noticeFailure({action, shown, show}) {
    const notify = globalThis.SF?.notify;
    if (typeof notify !== 'function') return;
    const fallback = this.sfWord('failed-reason');
    const named = shown.failed.slice(0, NAMED_FAILURES)
      .map((item) => `${item.text || item.id} — ${item.reason || fallback}`);
    const more = shown.failed.length - named.length;
    if (more > 0) named.push(this.word('more-failed-text', more));
    const title = show ? shown.text : this.failureLine(action, shown);
    notify({
      status: 'error',
      title,
      text: named.join('; '),
      source: 'sf-bulk-actions',
      key: `sf-bulk-actions|${action?.id ?? ''}|${title}`,
      silent: !show,
      actions: show ? [{label: this.sfWord('details-text'), onSelect: () => this.showDetails(shown)}] : undefined,
    });
  }

  offerUndo(action, detail) {
    const notify = globalThis.SF?.notify;
    if (typeof notify !== 'function') return;
    notify({
      status: 'success',
      title: this.sfWord('notice-text', {vars: {action: action.text, n: this.formatNumber(detail.count)}}),
      source: 'sf-bulk-actions',
      actions: [{label: this.sfWord('undo-text'), onSelect: () => this.sfEmit('undo', detail)}],
    });
  }

  // The question window (C39): sf-modal size="question" holding sf-confirm
  // appearance="window", red, with what will be lost. Answers true for «yes».
  ask(action, count, scope) {
    const doc = this.ownerDocument;
    const own = action.confirm || {};
    const n = this.formatNumber(count);
    const heading = own.question || this.sfWord('question-text', {count, vars: {action: action.text}});
    const accept = own['accept-text'] || own.acceptText || this.sfWord('accept-text', {vars: {action: action.text, n}});
    const consequence = own.consequence ?? (action.danger ? this.sfWord('consequence-text') : '');
    const modal = doc.createElement('sf-modal');
    modal.setAttribute('size', 'question');
    modal.setAttribute('heading', heading);
    modal.setAttribute('data-sf-bulk-question', action.id);
    const confirm = doc.createElement('sf-confirm');
    confirm.setAttribute('slot', 'content');
    confirm.setAttribute('appearance', 'window');
    if (action.danger) confirm.setAttribute('status', 'danger');
    confirm.setAttribute('accept-text', accept);
    if (consequence) confirm.setAttribute('consequence', consequence);
    if (scope === 'all') {
      const description = doc.createElement('p');
      description.setAttribute('slot', 'description');
      description.textContent = this.sfWord('all-scope-text', {count, vars: {n}});
      confirm.append(description);
    }
    modal.append(confirm);
    doc.body.append(modal);
    return new Promise((resolve) => {
      let answered = false;
      const finish = (value) => {
        if (answered) return;
        answered = true;
        doc.removeEventListener('sf-confirm-answer', onAnswer, true);
        if (value) modal.close?.({reason: 'api'});
        setTimeout(() => modal.remove(), 400);
        resolve(value);
      };
      // The window moves its content to the top layer: the answer is heard
      // on the document, from this question only.
      const onAnswer = (event) => {
        const path = event.composedPath?.() ?? [];
        if (event.target === confirm || path.includes(confirm)) finish(Boolean(event.detail?.accepted));
      };
      doc.addEventListener('sf-confirm-answer', onAnswer, true);
      modal.addEventListener('sf-modal-closed', () => finish(false));
      customElements.whenDefined('sf-modal').then(() => modal.open?.());
      globalThis.SF?.Loader?.ensure?.([modal.localName, confirm.localName]);
    });
  }

  // A short run in the bar: «Выполняем: 4 из 12» over a bar. Over 100 items
  // it is a job for the host's sf-progress-run (C34): refused.
  showProgress({done = 0, total = 0, text = ''} = {}) {
    const all = number(total);
    if (all > SHORT_RUN) return 'long';
    if (!all) return 'invalid';
    const made = Math.min(all, number(done));
    this._result = null;
    this._run = made >= all ? null : {done: made, total: all, text: String(text || '')};
    this.say(() => this.progressText(made, all, text));
    this.requestComponentUpdate('progress');
    return undefined;
  }

  progressText(done, total, text) {
    const vars = {done: this.formatNumber(done), total: this.formatNumber(total)};
    return text ? `${text}: ${vars.done} / ${vars.total}` : this.sfWord('progress-text', {vars});
  }

  // How an action went (C387). id names the action (the last one sent when
  // not given). A fast one's result is in place: «Удалено: 5» for a while and
  // back, or «Готово 10 из 12 · 2 не удалось» with «Подробнее» and «Повторить
  // для 2» (the host keeps the failed items selected). A long one's is a
  // notice: success, or an error that stays with «Подробнее». A failure is
  // written to «Уведомления» either way.
  showResult({id, ok = 0, failed = [], text = ''} = {}) {
    const refusals = (Array.isArray(failed) ? failed : [])
      .map((item) => (item && typeof item === 'object' ? item : {id: String(item ?? '')}))
      .map((item) => ({id: String(item.id ?? ''), text: String(item.text ?? item.id ?? ''), reason: String(item.reason ?? '')}));
    const done = number(ok);
    const total = done + refusals.length;
    const actionId = id === undefined || id === null || id === '' ? this._lastAction ?? null : String(id);
    const sent = actionId !== null ? this._sent.get(actionId) : null;
    if (sent) this._sent.delete(actionId);
    const action = sent?.action ?? (actionId !== null ? this.findAction(actionId) : null);
    const long = sent?.detail.long ?? false;
    const route = resultRoute({long, failed: refusals.length, undo: Boolean(action?.undo)});
    const line = refusals.length
      ? text || (long
        ? this.failureLine(action, {failed: refusals, total})
        : [
          this.sfWord('result-text', {vars: {ok: this.formatNumber(done), total: this.formatNumber(total)}}),
          this.word('failed-text', refusals.length),
        ].join(' · '))
      : text || this.doneLine(action, done);
    const shown = {ok: done, total, failed: refusals, text: line, action: actionId};
    if (!long) {
      this._run = null;
      this._result = route.bar === 'failed' ? shown : null;
      if (route.bar === 'done') this.showDone(line, 'done');
      else {
        this.endDone({update: false});
        this.say(line);
      }
      this.requestComponentUpdate('result');
    } else if (route.notice === 'success') {
      globalThis.SF?.notify?.({status: 'success', title: line, source: 'sf-bulk-actions'});
    }
    if (route.record) this.noticeFailure({action, shown, show: long});
    return undefined;
  }

  showDetails(shown = this._result) {
    if (!shown) return;
    const doc = this.ownerDocument;
    const modal = doc.createElement('sf-modal');
    modal.setAttribute('size', 'question');
    modal.setAttribute('heading', this.sfWord('details-heading', {vars: {
      failed: this.formatNumber(shown.failed.length), total: this.formatNumber(shown.total)}}));
    modal.setAttribute('data-sf-bulk-details', '');
    const content = doc.createElement('div');
    content.setAttribute('slot', 'content');
    const list = doc.createElement('sf-list-description');
    content.append(list);
    modal.append(content);
    doc.body.append(modal);
    const fallback = this.sfWord('failed-reason');
    customElements.whenDefined('sf-list-description').then(() => {
      list.items = shown.failed.map((item) => ({id: item.id, label: item.text || item.id, value: item.reason || fallback}));
    });
    modal.addEventListener('sf-modal-closed', () => setTimeout(() => modal.remove(), 400));
    customElements.whenDefined('sf-modal').then(() => modal.open?.());
    globalThis.SF?.Loader?.ensure?.([modal.localName, list.localName]);
  }

  retry() {
    const action = this._result?.action ? this.findAction(this._result.action) : null;
    if (action) this.runAction(action, {retry: true});
  }

  // Up to three labelled actions (one icon button on a phone), by priority.
  baseSplit() {
    return this._compact
      ? splitActions(this.actionList, VISIBLE_COMPACT, {iconOnly: true})
      : splitActions(this.actionList, VISIBLE);
  }

  // What the row shows: the split, less what the width folds (LV3-27).
  split() {
    return foldActions(this.baseSplit(), this._fit);
  }

  // A new set of actions, another size or the phone's row is measured anew.
  resetFit() {
    const sig = [this.size, this._compact ? 'icon' : 'text',
      ...this.actionList.map((item, index) => normalizeAction(item, index)).filter(Boolean).map((action) => `${action.id}:${action.text}`)].join('|');
    if (sig === this._fitSig) return;
    this._fitSig = sig;
    this._fit = null;
    this._fitAt = 0;
  }

  // «Выбрать все N» once the whole page is selected and the total is larger;
  // «Только эта страница (N)» while all are; nothing while a run or a result
  // holds the start (a done line keeps it beside it while items are selected).
  currentOffer() {
    if (this._run || this._result) return null;
    const count = this.selectedCount;
    const total = this.total;
    const pageCount = this.pageCount;
    if (this.allSelected && total > 0) return {kind: 'page', text: this.word('select-page-text', pageCount || count)};
    if (total && pageCount && count === pageCount && total > pageCount) return {kind: 'all', text: this.word('select-all-text', total)};
    return null;
  }

  templateContext() {
    this.resetFit();
    const count = this.selectedCount;
    const effective = this.effectiveCount;
    const total = this.total;
    const all = this.allSelected && total > 0;
    const {visible, rest} = this.split();
    const mark = (action) => {
      const reason = this.unavailableReason(action, effective);
      return {...action, unavailable: reason !== null, reason: reason || ''};
    };
    const offer = this.currentOffer();
    const folded = Boolean(offer) && this.offerFolded;
    const countText = this.getAttribute('count-text') || (all ? this.word('all-text', total) : this.word('count-text', count));
    const run = this._run ? {
      text: this.progressText(this._run.done, this._run.total, this._run.text),
      percent: Math.round((this._run.done / this._run.total) * 100),
    } : null;
    const result = this._result ? {
      text: this._result.text,
      failed: this._result.failed.length,
      details: this.sfWord('details-text'),
      retry: this._result.action ? this.word('retry-text', this._result.failed.length) : '',
    } : null;
    // A done line in place of the count (C387); the actions stay while items
    // are still selected (an action that keeps them, «В архив»).
    const done = this._done && !this._run && !this._result ? {...this._done, actions: count > 0} : null;
    const shown = count > 0 || Boolean(this._run) || Boolean(this._result) || Boolean(done);
    this.sfHostState('data-state', this.runState);
    this.sfHostState('data-place', this.place);
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      size: this.size,
      place: this.place,
      compact: this._compact,
      shown,
      label: this.label || this.sfWord('label-text'),
      countText,
      offer: folded ? null : offer,
      offerFolded: folded,
      visible: visible.map(mark),
      rest,
      run,
      result,
      done,
      start: this.hasSlotContent('start') ? this.getSlotContent('start') : nothing,
      end: this.hasSlotContent('end') ? this.getSlotContent('end') : nothing,
      announcement: this.announcement,
      words: {
        more: this.sfWord('more-text'),
        clear: this.sfWord('clear-text'),
        clearHint: this.sfWord('clear-hint'),
      },
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderBulkActionsTemplate(this.templateContext());
  }
}

SfBulkActions.define('sf-bulk-actions');

export {SfBulkActions};
