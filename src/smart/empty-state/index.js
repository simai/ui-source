// sf-empty-state: what a list, a panel or a page says when it has nothing to
// show (owner-approved assignment, 2026-10-14). One component for the
// reasons -- nothing yet, the first time, nothing found, no access, could not
// load, no connection, being prepared (owner decision C120) -- each with its
// icon, a title that is a real heading at the page's level, a sentence and
// what the person can do next.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {renderEmptyStateTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// From its component.json (standard simai.smart-component 1.3.8 §3, §4,
// §7.4.1, §8): settings are attributes and properties made by
// core/js/element-manifest.js, the words are lang/<locale>.json (a product
// adds a language through SF.language.register("sf-empty-state", code,
// words)), and title is a dated alias of heading.
const EmptyStateElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
});

// The icon rule (owner decision C120): an empty place shows the icon of its
// section (the icon setting; inbox without one), the first time in the
// primary role; nothing found is search_off (filter_alt_off by filters, passed
// as the icon); a problem is its own glyph in its tone -- error in the error
// role, lock and cloud_off in the warning role. processing draws a spinner in
// the same circle instead of a glyph, or with a known share (value) an
// sf-progress-ring of the circle's size with the percentage.
const ICONS = {
  'no-data': 'inbox',
  'first-use': 'inbox',
  'nothing-found': 'search_off',
  'no-access': 'lock',
  error: 'error',
  offline: 'cloud_off',
  processing: '',
};
const TONES = {
  'no-data': 'neutral',
  'first-use': 'primary',
  'nothing-found': 'neutral',
  'no-access': 'warning',
  error: 'error',
  offline: 'warning',
  processing: 'neutral',
};
// The reasons that say themselves politely under live auto: what the person
// asked for did not come (nothing found, error, offline), and work that
// started (processing).
const SPOKEN = new Set(['nothing-found', 'error', 'offline', 'processing']);

class SfEmptyState extends EmptyStateElement {
  static get props() {
    return {...super.props, rootClass: {default: ''}};
  }

  // offline retries by itself when the network comes back: the window's
  // online event sends action {id: retry, auto: true} to the host, which does
  // the loading. The element makes no request of its own.
  connectedCallback() {
    super.connectedCallback();
    if (!this.__sfOnline) this.__sfOnline = () => { if (this.kind === 'offline') this.act('retry', {auto: true}); };
    globalThis.addEventListener?.('online', this.__sfOnline);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.__sfOnline) globalThis.removeEventListener?.('online', this.__sfOnline);
  }

  // [{id, text, appearance}]: drawn at the component's size; each sends
  // sf-empty-state-action {id}. Unset is null, so an error offers «Повторить».
  get actions() {
    return Array.isArray(this.__sfManifestData?.actions) ? this.__sfManifestData.actions : null;
  }

  set actions(value) {
    if (!this.__sfManifestData) this.__sfManifestData = {};
    this.__sfManifestData.actions = Array.isArray(value) ? value.filter((action) => action && action.id !== undefined) : null;
    this.requestComponentUpdate('actions');
  }

  // inline: one line for a list inside a menu, a dropdown or a search -- a
  // small icon, the words and at most one link action, no heading. Size 1/3
  // is always inline (owner, 2026-10-14).
  get layout() {
    if (this.getAttribute('size') === '1/3') return 'inline';
    return this.getAttribute('layout') === 'inline' ? 'inline' : 'block';
  }

  set layout(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('layout');
    else this.setAttribute('layout', String(value));
  }

  // A heading at the page's level, 2..6; 3 when the attribute says otherwise.
  get headingLevel() {
    const value = Number(this.getAttribute('heading-level'));
    return Number.isInteger(value) && value >= 2 && value <= 6 ? value : 3;
  }

  set headingLevel(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('heading-level');
    else this.setAttribute('heading-level', String(value));
  }

  // auto: nothing-found, error, offline and processing are a polite status,
  // the others say nothing; alert: an error the person caused, such as a
  // search that failed as they typed; off: the host announces it itself.
  liveRole() {
    if (this.live === 'off') return null;
    if (this.live === 'alert') return 'alert';
    return SPOKEN.has(this.kind) ? 'status' : null;
  }

  words(key) {
    return this.sfWord(key);
  }

  // The actions to draw: the host's, or the reason's own when it has none --
  // «Повторить» for an error and offline, the primary «Создать» for the first
  // time. processing offers nothing: the work goes on without the person.
  resolvedActions() {
    const actions = this.actions;
    if (actions) return actions;
    if (this.hasSlotContent?.('actions')) return [];
    if (this.kind === 'error' || this.kind === 'offline') return [{id: 'retry', text: this.words('retry'), appearance: 'outline'}];
    if (this.kind === 'first-use') return [{id: 'create', text: this.words('create'), appearance: 'default'}];
    return [];
  }

  // The share done of a processing job, a whole per cent 0..100, or null
  // while it is unknown (no value): then the spinner turns instead.
  share() {
    const raw = this.value;
    if (raw === null || raw === undefined || raw === '') return null;
    const number = Number(raw);
    return Number.isFinite(number) ? Math.round(Math.max(0, Math.min(100, number))) : null;
  }

  act(id, more = {}) {
    this.sfEmit('action', {id: String(id), ...more});
  }

  templateContext() {
    const kind = this.kind;
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      kind,
      size: this.size,
      headingLevel: this.headingLevel,
      shownIcon: kind === 'processing' ? '' : (this.icon || ICONS[kind] || ICONS['no-data']),
      processing: kind === 'processing',
      // processing with a known share (value 0..100): the ring in the circle.
      share: kind === 'processing' ? this.share() : null,
      shareLabel: this.words('processing-share'),
      tone: TONES[kind] ?? 'neutral',
      shownTitle: this.heading || this.words(`${kind}-title`),
      shownText: this.text || this.words(`${kind}-text`),
      resolvedActions: this.resolvedActions(),
      layout: this.layout,
      liveRole: this.liveRole(),
      // The line of the inline form: the host's words, else the kind's title.
      shownLine: this.text || this.heading || this.words(`${kind}-title`),
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderEmptyStateTemplate(this.templateContext());
  }
}

SfEmptyState.define('sf-empty-state');
