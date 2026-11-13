// sf-change: a field's change as text (owner decision C40, 2026-11-09):
//
//   <sf-change label="Статус" before="Собран" after="Передан в доставку"></sf-change>
//   <sf-change layout="list" changes='[{"label":"Вес","before":"4,2 кг","after":"4,6 кг"}]'></sf-change>
//
// The old value quiet, an arrow, the new value in the text colour and medium
// weight; no badges and no strikethrough. inline sits in a sentence; list is
// a description list of the fields of one update; a long value in a sentence
// is revealed in place behind «Показать изменения». An empty value reads
// «пусто». sf-confirm-change draws its list with it.
//
// From its component.json (standard simai.smart-component 1.3.15 §3, §4,
// §8): the settings are made by core/js/element-manifest.js, the words are
// the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {renderChangeTemplate} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// A value longer than this (in graphemes, roughly characters) is not put in a sentence.
export const LONG = 80;

// The reveal's ids, one per element on the page (stable across renders).
let sequence = 0;

/** A value as text: null, undefined and '' are empty (null); a number is its text. */
export function valueText(value) {
  if (value === null || value === undefined) return null;
  const text = typeof value === 'object' ? '' : String(value);
  return text.trim() === '' ? null : text;
}

/** The changes made safe: {label, before, after} each, the values as text or null. */
export function normalizeChanges(value) {
  let list = value;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list.filter((item) => item && typeof item === 'object').map((item) => ({
    label: valueText(item.label) ?? '',
    before: valueText(item.before),
    after: valueText(item.after),
  }));
}

/** Whether a value is too long to stand in a sentence. */
export function isLong(text) {
  return text !== null && Array.from(text).length > LONG;
}

const ChangeElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
});

class SfChange extends ChangeElement {
  static get observedAttributes() {
    return [...new Set([...(super.observedAttributes || []), 'changes'])];
  }

  constructor() {
    super();
    this._uid = `sf-change-${++sequence}`;
    this._revealed = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback?.(name, oldValue, newValue);
    if (name === 'changes' && oldValue !== newValue) this.requestComponentUpdate('changes');
  }

  // The list: the property, else the changes attribute (JSON in markup).
  get list() {
    const given = normalizeChanges(this.changes);
    if (given.length) return given;
    return this.hasAttribute('changes') ? normalizeChanges(this.getAttribute('changes')) : [];
  }

  // The one pair of layout inline: before and after, else the first change.
  // before and after are the browser's own ChildNode methods (§3.1: the
  // manifest leaves them the browser's), so the settings are read from the
  // attributes through the base, never as this.before / this.after.
  get pair() {
    const before = valueText(this.getProp('before'));
    const after = valueText(this.getProp('after'));
    if (before !== null || after !== null || !this.list.length) return {label: valueText(this.label) ?? '', before, after};
    const first = this.list[0];
    return {...first, label: valueText(this.label) ?? first.label};
  }

  get revealed() {
    return this._revealed;
  }

  toggleReveal(open = !this._revealed) {
    this._revealed = Boolean(open);
    this.requestComponentUpdate('reveal');
  }

  templateContext() {
    const layout = this.layout === 'list' ? 'list' : 'inline';
    const changes = layout === 'list' ? this.list : [this.pair];
    const pair = changes[0] ?? {label: '', before: null, after: null};
    const folded = layout === 'inline' && this.reveal !== 'none' && (isLong(pair.before) || isLong(pair.after));
    // Nothing to say: no change in the list, or a pair with neither value.
    const empty = layout === 'list' ? !changes.length : pair.before === null && pair.after === null;
    this.sfHostState('data-empty', empty);
    this.sfHostState('data-block', layout === 'list' || folded);
    this.sfHostState('data-revealed', folded && this._revealed);
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      layout,
      // rows, not changes: the changes prop keeps its own value ([]) in the context.
      rows: changes,
      pair,
      empty,
      folded,
      revealed: folded && this._revealed,
      showLabel: Boolean(this.showLabel),
      blocksId: `${this._uid}-blocks`,
      words: {
        empty: this.sfWord('empty-text'),
        to: this.sfWord('to-text'),
        separator: this.sfWord('label-separator'),
        show: this.sfWord('show-text'),
        hide: this.sfWord('hide-text'),
        before: this.sfWord('before-text'),
        after: this.sfWord('after-text'),
      },
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderChangeTemplate(this.templateContext());
  }
}

SfChange.define('sf-change');

export {SfChange};
