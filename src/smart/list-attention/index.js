// sf-list-attention: the problems that need a person, on an overview screen --
// server health, site checks, import errors, update readiness, a form's
// validation summary:
//
//   <sf-list-attention><script type="application/json" data-sf-settings>
//     {"items": [{"id": "cert", "status": "warning", "title": "…",
//       "text": "…", "action": {"label": "Продлить", "href": "/ssl/"}}]}
//   </script></sf-list-attention>
//
// The items are ordered error, warning, info, success, the host's order
// inside a status; the heading shows their count. With none the list draws
// nothing (empty none) or one quiet line (empty line), never an empty card.
// An action with href is a link and asks navigate; one with event is a
// button and sends apply. The list stores and loads nothing.
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4,
// §8): the settings are made by core/js/element-manifest.js, the words are
// the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {renderListAttentionTemplate} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// The heading's id, one per list on the page (stable across renders).
let sequence = 0;

export const STATUSES = ['error', 'warning', 'info', 'success'];
const RANK = {error: 0, warning: 1, info: 2, success: 3};
// sf-alert's status icons, by the shared status words.
export const ICONS = {error: 'error', warning: 'warning', info: 'info', success: 'check_circle'};

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

/** An item's status: the four words; danger is read as error, anything else as info. */
export function statusOf(value) {
  const word = text(value).toLowerCase();
  if (word === 'danger') return 'error';
  return STATUSES.includes(word) ? word : 'info';
}

/**
 * The items as given, made safe and ordered by severity; inside a status the
 * host's order. An item without an id or a title, or with an id seen before,
 * is left out. An action needs a label and an href or an event.
 */
export function normalizeItems(value) {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  const items = [];
  list.forEach((item, order) => {
    if (!item || typeof item !== 'object') return;
    const id = text(item.id);
    const title = text(item.title);
    if (!id || !title || seen.has(id)) return;
    seen.add(id);
    const given = item.action && typeof item.action === 'object' ? item.action : null;
    const label = text(given?.label);
    const href = text(given?.href);
    const event = text(given?.event);
    items.push({
      id,
      status: statusOf(item.status),
      title,
      text: text(item.text),
      action: label && (href || event) ? {label, href, event} : null,
      order,
    });
  });
  return items.sort((a, b) => (RANK[a.status] - RANK[b.status]) || (a.order - b.order));
}

const ListAttentionElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
});

class SfListAttention extends ListAttentionElement {
  constructor() {
    super();
    this._headingId = `sf-list-attention-heading-${++sequence}`;
  }

  get list() {
    return normalizeItems(this.items);
  }

  // An action link: the request first; not cancelled, the browser follows it.
  onNavigate(event, item) {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const allowed = this.sfEmit('navigate', {id: item.id, status: item.status, href: item.action?.href ?? ''}, {cancelable: true});
    if (!allowed) event.preventDefault();
  }

  // An action button: the fact; the host does it.
  onApply(item) {
    this.sfEmit('apply', {action: item.action?.event ?? '', scope: 'entry', ids: [item.id], id: item.id, status: item.status});
  }

  templateContext() {
    const list = this.list;
    const count = list.length;
    const status = list[0]?.status ?? '';
    const level = Math.min(6, Math.max(2, Math.trunc(Number(this.headingLevel)) || 3));
    this.sfHostState('data-status', status);
    this.sfHostState('data-empty', count === 0);
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      size: this.size === '1/2' ? '1/2' : '1',
      label: this.label,
      level,
      headingId: this._headingId,
      list: list.map((item) => ({...item, statusWord: this.sfWord(`status-${item.status}`)})),
      count,
      status,
      empty: this.empty === 'line' ? 'line' : 'none',
      emptyText: this.emptyText,
      icons: ICONS,
      countText: this.sfWord('count', {vars: {count}}),
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderListAttentionTemplate(this.templateContext());
  }
}

SfListAttention.define('sf-list-attention');

export {SfListAttention};
