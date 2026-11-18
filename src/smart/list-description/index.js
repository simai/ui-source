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
// with an sf-button-copy, with a status icon and a hint, or a badge; an empty
// one says so in words («Не указан»). A label can carry a help mark, a value
// one action. A field template draws a value of its own (C302 (2), place
// Показ): an item's slot names host content drawn as the value, or the value
// is a node or a drawing given through the property (VP-24). Section items
// ({type: "section", label, action?}) split a record into sections inside
// one grid, so every label of the record shares one
// column (owner decision C33, the record card); layout grid is the summary
// under a record's heading, label over value in up to four columns. The list
// is read-only and stores and loads nothing: an action asks the page (apply).
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4,
// §8): the settings are made by core/js/element-manifest.js, the words are
// the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {renderListDescriptionTemplate} from './js/templates/default';
import manifest from './component.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).
import './scss/index.scss';

export const STATUSES = ['success', 'warning', 'error', 'info'];
// sf-alert's status icons, by the shared status words.
export const ICONS = {success: 'check_circle', warning: 'warning', error: 'error', info: 'info'};

// sf-badge's colour families, for a badge value without a status.
export const BADGE_SCHEMES = ['neutral', 'primary', 'secondary', 'tertiary', 'on-surface'];
export const COLUMNS = ['1', '2', '3', '4'];

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

/** An action: {label, event?, href?}; none without a label. */
export function normalizeAction(value) {
  if (!value || typeof value !== 'object') return null;
  const label = text(value.label);
  return label ? {label, event: text(value.event), href: text(value.href)} : null;
}

/** A badge value: {text, status?, scheme?, icon?}; none without a text. */
export function normalizeBadge(value) {
  if (!value || typeof value !== 'object') return null;
  const words = text(value.text);
  if (!words) return null;
  const status = text(value.status).toLowerCase();
  const scheme = text(value.scheme).toLowerCase();
  return {
    text: words,
    status: STATUSES.includes(status) ? status : '',
    scheme: BADGE_SCHEMES.includes(scheme) ? scheme : 'neutral',
    icon: text(value.icon),
  };
}

/**
 * A drawn value (VP-24): a DOM node or a lit drawing (a field template's
 * place Показ), given through the property; null for anything else.
 */
export function drawnValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof globalThis.Node === 'function' && value instanceof globalThis.Node) return value;
  // A drawing of any lit copy: every bundle carries its own (the marker is lit's own).
  return '_$litType$' in value ? value : null;
}

/** A value as the list writes it: text; a list joined with commas; nothing is ''. */
export function valueText(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(', ');
  if (typeof value === 'object') return '';
  return String(value).trim();
}

/**
 * The items as given, made safe: an item without a label is left out (a
 * section's label is its title); the id is the item's, else its place. A
 * status outside the four words is none. An empty value (no text and no
 * badge) has no link, no copy button and no status: it says empty-text. A
 * value with a badge draws no status icon: the badge is its one mark.
 * A drawn value -- the host content of the item's slot (hasSlot says it is
 * there) or a node given as value -- stands in place of the text. The text
 * (beside a slot the item's value, for a node its words) is what copy copies
 * and the title of a cut value. A drawn value has no link: the drawing holds
 * its own.
 */
export function normalizeItems(value, {hasSlot} = {}) {
  const list = Array.isArray(value) ? value : [];
  const items = [];
  list.forEach((item, at) => {
    if (!item || typeof item !== 'object') return;
    if (item.type === 'section') {
      const title = text(item.label);
      if (title) items.push({kind: 'section', id: text(item.id) || String(at), title, action: normalizeAction(item.action)});
      return;
    }
    const label = text(item.label);
    if (!label) return;
    const slot = text(item.slot);
    const slotted = Boolean(slot) && typeof hasSlot === 'function' && Boolean(hasSlot(slot));
    const node = slotted ? null : drawnValue(item.value);
    const drawn = slotted || Boolean(node);
    const shown = node ? valueText(typeof node.textContent === 'string' ? node.textContent : '') : valueText(item.value);
    const status = text(item.status).toLowerCase();
    const badge = normalizeBadge(item.badge);
    const empty = shown === '' && !badge && !drawn;
    items.push({
      kind: 'item',
      id: text(item.id) || String(at),
      label,
      value: shown,
      slot: slotted ? slot : '',
      node,
      drawn,
      empty,
      emptyText: typeof item.empty === 'string' ? text(item.empty) : '',
      hint: text(item.hint),
      help: text(item.help),
      mono: item.mono === true,
      numeric: item.numeric === true || typeof item.value === 'number',
      copy: item.copy === true && shown !== '',
      // A drawn value has no link of the list: the template draws it before a link.
      href: shown === '' ? '' : text(item.href),
      // One mark per value: a badge is the mark, so its row draws no status icon.
      status: !empty && !badge && STATUSES.includes(status) ? status : '',
      badge,
      action: normalizeAction(item.action),
    });
  });
  return items;
}

const ListDescriptionElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
  source: 'ru',
});

class SfListDescription extends ListDescriptionElement {
  get list() {
    return normalizeItems(this.items, {hasSlot: (name) => this.hasSlotContent?.(name)});
  }

  // A value link: the request first; not cancelled, the browser follows it.
  // An action link (an item's or a section's action with href) asks the same.
  onNavigate(event, item, href = item.href) {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const allowed = this.sfEmit('navigate', {id: item.id, href}, {cancelable: true});
    if (!allowed) event.preventDefault();
  }

  // An action button (an item's or a section's, without href): the page does
  // it (opens a form, a dialog) and sets the list again (vocabulary §5 apply,
  // scope entry). action is the action's event, «edit» when it names none.
  onApply(item) {
    this.sfEmit('apply', {action: item.action?.event || 'edit', scope: 'entry', ids: [item.id], id: item.id, kind: item.kind});
  }

  templateContext() {
    const list = this.list;
    this.sfHostState('data-empty', list.length === 0);
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      size: ['1/2', '1', '2'].includes(this.size) ? this.size : '1',
      layout: ['columns', 'stacked', 'grid'].includes(this.layout) ? this.layout : 'auto',
      columns: COLUMNS.includes(String(this.columns)) ? String(this.columns) : '4',
      level: Math.min(6, Math.max(2, Math.trunc(Number(this.headingLevel)) || 3)),
      overflow: this.overflow === 'truncate' ? 'truncate' : 'wrap',
      dividers: Boolean(this.dividers),
      label: this.label,
      list: list.map((item) => (item.kind === 'section' ? {
        ...item,
        actionLabel: item.action ? this.sfWord('action', {vars: {action: item.action.label, label: item.title}}) : '',
      } : {
        ...item,
        statusWord: item.status ? this.sfWord(`status-${item.status}`) : '',
        copyLabel: item.copy ? this.sfWord('copy', {vars: {label: item.label}}) : '',
        actionLabel: item.action ? this.sfWord('action', {vars: {action: item.action.label, label: item.label}}) : '',
        helpLabel: item.help ? this.sfWord('help', {vars: {label: item.label}}) : '',
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
