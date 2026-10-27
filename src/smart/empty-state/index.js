// sf-empty-state: what a list, a panel or a page says when it has nothing to
// show (owner-approved assignment, 2026-10-14). One component for the four
// reasons -- nothing yet, nothing found, no access, could not load -- each
// with its icon, a title that is a real heading at the page's level, a
// sentence and what the person can do next.
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

const ICONS = {'no-data': 'inbox', 'nothing-found': 'search_off', 'no-access': 'lock', error: 'error'};
const TONES = {'no-data': 'neutral', 'nothing-found': 'neutral', 'no-access': 'warning', error: 'error'};

class SfEmptyState extends EmptyStateElement {
  static get props() {
    return {...super.props, rootClass: {default: ''}};
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

  // auto: nothing-found and error are a polite status, the others say
  // nothing; alert: an error the person caused, such as a search that failed
  // as they typed; off: the host announces it itself.
  liveRole() {
    if (this.live === 'off') return null;
    if (this.live === 'alert') return 'alert';
    return this.kind === 'nothing-found' || this.kind === 'error' ? 'status' : null;
  }

  words(key) {
    return this.sfWord(key);
  }

  // The actions to draw: the host's, or «Повторить» for an error that has none.
  resolvedActions() {
    const actions = this.actions;
    if (actions) return actions;
    if (this.hasSlotContent?.('actions')) return [];
    return this.kind === 'error' ? [{id: 'retry', text: this.words('retry'), appearance: 'outline'}] : [];
  }

  act(id) {
    this.sfEmit('action', {id: String(id)});
  }

  templateContext() {
    const kind = this.kind;
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      kind,
      size: this.size,
      headingLevel: this.headingLevel,
      shownIcon: this.icon || ICONS[kind],
      tone: TONES[kind],
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
