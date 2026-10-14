// sf-empty-state: what a list, a panel or a page says when it has nothing to
// show (owner-approved assignment, 2026-10-14). One component for the four
// reasons -- nothing yet, nothing found, no access, could not load -- each
// with its icon, a title that is a real heading at the page's level, a
// sentence and what the person can do next.
import SfBaseElement from '../../core/js/smart-base';
import {pageText} from '../../core/js/page-language';
import {renderEmptyStateTemplate} from './js/templates/default';
import './scss/index.scss';

const KINDS = ['no-data', 'nothing-found', 'no-access', 'error'];
const SIZES = ['1/3', '1/2', '1', '2'];
const LAYOUTS = ['block', 'inline'];
const LIVE = ['auto', 'alert', 'off'];

const EMPTY_STATE_TEXT = {
  en: {
    'no-data-title': 'Nothing here yet', 'no-data-text': 'Items will appear here',
    'nothing-found-title': 'Nothing found', 'nothing-found-text': 'Try another query or other filters',
    'no-access-title': 'No access', 'no-access-text': 'Ask an administrator for access',
    'error-title': 'Could not load', 'error-text': 'Try again',
    retry: 'Try again',
  },
  ru: {
    'no-data-title': 'Пока ничего нет', 'no-data-text': 'Здесь появятся записи, когда они будут',
    'nothing-found-title': 'Ничего не найдено', 'nothing-found-text': 'Попробуйте изменить запрос или фильтры',
    'no-access-title': 'Нет доступа', 'no-access-text': 'Обратитесь к администратору',
    'error-title': 'Не удалось загрузить', 'error-text': 'Попробуйте ещё раз',
    retry: 'Повторить',
  },
};

const ICONS = {'no-data': 'inbox', 'nothing-found': 'search_off', 'no-access': 'lock', error: 'error'};
const TONES = {'no-data': 'neutral', 'nothing-found': 'neutral', 'no-access': 'warning', error: 'error'};

class SfEmptyState extends SfBaseElement {
  constructor() {
    super();
    this._actions = null;
  }

  static get props() {
    return {
      templateName: {attribute: 'template', default: 'default'},
      kind: {default: 'no-data'},
      size: {default: '1'},
      icon: {default: ''},
      title: {default: ''},
      text: {default: ''},
      headingLevel: {attribute: 'heading-level', default: '3'},
      layout: {default: 'block'},
      live: {default: 'auto'},
      rootClass: {default: ''},
    };
  }

  // [{id, text, appearance}]: drawn at the component's size; each raises
  // sf-empty-state-action {id}.
  get actions() {
    return this._actions;
  }

  set actions(value) {
    this._actions = Array.isArray(value) ? value.filter((action) => action && action.id !== undefined) : null;
    this.requestComponentUpdate('actions');
  }

  get kind() {
    const value = this.getAttribute('kind');
    return KINDS.includes(value) ? value : 'no-data';
  }

  get size() {
    const value = this.getAttribute('size');
    return SIZES.includes(value) ? value : '1';
  }

  // inline: one line for a list inside a menu, a dropdown or a search -- a
  // small icon, the words and at most one link action, no heading. Size 1/3
  // is always inline (owner, 2026-10-14).
  get layout() {
    if (this.getAttribute('size') === '1/3') return 'inline';
    const value = this.getAttribute('layout');
    return LAYOUTS.includes(value) ? value : 'block';
  }

  // auto: nothing-found and error are a polite status, the others say
  // nothing; alert: an error the person caused, such as a search that failed
  // as they typed; off: the host announces it itself.
  get live() {
    const value = this.getAttribute('live');
    return LIVE.includes(value) ? value : 'auto';
  }

  liveRole() {
    if (this.live === 'off') return null;
    if (this.live === 'alert') return 'alert';
    return this.kind === 'nothing-found' || this.kind === 'error' ? 'status' : null;
  }

  get icon() {
    return this.getAttribute('icon') || '';
  }

  get title() {
    return this.getAttribute('title') || '';
  }

  get text() {
    return this.getAttribute('text') || '';
  }

  get headingLevel() {
    const value = Number(this.getAttribute('heading-level'));
    return value >= 2 && value <= 6 ? String(value) : '3';
  }

  words(key) {
    return pageText(EMPTY_STATE_TEXT, key, this, 'sf-empty-state');
  }

  // The actions to draw: the host's, or «Повторить» for an error that has none.
  resolvedActions() {
    if (this._actions) return this._actions;
    if (this.hasSlotContent?.('actions')) return [];
    return this.kind === 'error' ? [{id: 'retry', text: this.words('retry'), appearance: 'outline'}] : [];
  }

  act(id) {
    this.dispatchEvent(new CustomEvent('sf-empty-state-action', {bubbles: true, composed: true, detail: {id: String(id)}}));
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
      shownTitle: this.title || this.words(`${kind}-title`),
      shownText: this.text || this.words(`${kind}-text`),
      resolvedActions: this.resolvedActions(),
      layout: this.layout,
      liveRole: this.liveRole(),
      // The line of the inline form: the host's words, else the kind's title.
      shownLine: this.text || this.title || this.words(`${kind}-title`),
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderEmptyStateTemplate(this.templateContext());
  }
}

SfEmptyState.define('sf-empty-state');
