// sf-list-description: facts as label and value rows -- a site summary,
// server facts, a record's header, a job's parameters, licence details:
//
//   <sf-list-description><script type="application/json" data-sf-settings>
//     {"items": [{"label": "Адрес", "value": "demo.test", "href": "https://demo.test/"},
//       {"label": "Корень сайта", "value": "/var/www/demo", "mono": true, "copy": true}]}
//   </script></sf-list-description>
//
// A native dl: the labels in a column of their own as wide as the longest
// one, the values beside them; on a phone (a column narrower than 24rem) each
// label over its value. A value is text: monospace, a link (navigate), copied
// with an sf-button-copy, with a status icon and a hint; an empty one shows
// «—». The list is read-only and stores and loads nothing.
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4,
// §8): the settings are made by core/js/element-manifest.js, the words are
// the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {renderListDescriptionTemplate} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

export const STATUSES = ['success', 'warning', 'error', 'info'];
// sf-alert's status icons, by the shared status words.
export const ICONS = {success: 'check_circle', warning: 'warning', error: 'error', info: 'info'};

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

/** A value as the list writes it: text; a list joined with commas; nothing is ''. */
export function valueText(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(', ');
  if (typeof value === 'object') return '';
  return String(value).trim();
}

/**
 * The items as given, made safe: an item without a label is left out; the
 * id is the item's, else its place. A status outside the four words is none.
 */
export function normalizeItems(value) {
  const list = Array.isArray(value) ? value : [];
  const items = [];
  list.forEach((item, at) => {
    if (!item || typeof item !== 'object') return;
    const label = text(item.label);
    if (!label) return;
    const shown = valueText(item.value);
    const status = text(item.status).toLowerCase();
    items.push({
      id: text(item.id) || String(at),
      label,
      value: shown,
      empty: shown === '',
      hint: text(item.hint),
      mono: item.mono === true,
      copy: item.copy === true && shown !== '',
      href: shown === '' ? '' : text(item.href),
      status: STATUSES.includes(status) ? status : '',
    });
  });
  return items;
}

const ListDescriptionElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
});

class SfListDescription extends ListDescriptionElement {
  get list() {
    return normalizeItems(this.items);
  }

  // A value link: the request first; not cancelled, the browser follows it.
  onNavigate(event, item) {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const allowed = this.sfEmit('navigate', {id: item.id, href: item.href}, {cancelable: true});
    if (!allowed) event.preventDefault();
  }

  templateContext() {
    const list = this.list;
    this.sfHostState('data-empty', list.length === 0);
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      size: ['1/2', '1', '2'].includes(this.size) ? this.size : '1',
      layout: ['columns', 'stacked'].includes(this.layout) ? this.layout : 'auto',
      overflow: this.overflow === 'truncate' ? 'truncate' : 'wrap',
      dividers: Boolean(this.dividers),
      label: this.label,
      list: list.map((item) => ({
        ...item,
        statusWord: item.status ? this.sfWord(`status-${item.status}`) : '',
        copyLabel: item.copy ? this.sfWord('copy', {vars: {label: item.label}}) : '',
      })),
      emptyText: this.emptyText,
      icons: ICONS,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderListDescriptionTemplate(this.templateContext());
  }
}

SfListDescription.define('sf-list-description');

export {SfListDescription};
