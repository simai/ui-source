import {
  bindTextarea,
  setTextareaState,
  unbindTextarea,
} from '../../component/textarea/js/_textarea';
import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { ladderSize } from '../../component/field-size';
import { InheritedValueField } from '../helpers/inherited-value';
import { FormField, ShownRequired, innerControlName, syncFieldValidity } from '../helpers/form-field';
import { charCount, countAnnouncement } from '../helpers/char-count';
import { renderTextareaTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-input-textarea from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §17, §20). The settings are made by core/js/element-manifest.js;
// `spellcheck` (a property of HTMLElement, §3.1) is spell-check, and `type`
// (appearance) and `error` (invalid, §17.2) are dated aliases, as is the
// trait's old event sf-field:reset (aliases.json). The host is the form
// control through ElementInternals: it submits the text and reports the native
// textarea's validity, and the textarea carries no name (§17.1).
const TextareaElement = elementFromManifest(manifest, {
  base: InheritedValueField(SfBaseElement),
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfTextarea extends ShownRequired(FormField(TextareaElement)) {
  static get props() {
    return {
      ...super.props,
      rootClass: { default: '' },
      ariaLabel: { attribute: 'aria-label', default: '' },
      labelledBy: { attribute: 'aria-labelledby', default: '' },
      // What the field falls back to while it holds nothing (simai/ui-source#28).
      inheritedValue: { attribute: 'inherited-value', default: '' },
      inheritedText: { attribute: 'inherited-text', default: '' },
      resetLabel: { attribute: 'reset-label', default: '' },
    };
  }


  constructor() {
    super();
    this._boundRoot = null;
    this._countLevel = '';
    this._countSaid = '';
    // The count follows the text (C141 (1)): with a limit, every edit redraws
    // the count and, at a threshold, the frame. The redraw keeps the caret:
    // the textarea's value is the text it already holds.
    this.addEventListener('input', () => {
      if (this.maxlength !== null) this.requestComponentUpdate?.('count');
    });
  }

  get size() {
    return ladderSize(this.getAttribute('size'));
  }

  get minlength() {
    const value = this.getNumberAttr('minlength', null);
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  get maxlength() {
    const value = this.getNumberAttr('maxlength', null);
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  // A textarea whose label is drawn outside it -- a record panel prints it, a
  // flush field in a card has none -- still owes a name. The host's aria-label
  // and aria-labelledby reach the native textarea, which is what assistive
  // technology reads; on the host they named nothing, because the host is not
  // the control (simai/ui-source#30, as sf-input does).
  get ariaLabel() {
    return this.getProp('ariaLabel') || '';
  }

  get labelledBy() {
    return this.getProp('labelledBy') || '';
  }

  // element.focus() on the host reaches the native textarea.
  focusDelegate() {
    return this.querySelector('textarea');
  }

  get value() {
    const textarea = this.querySelector('.sf-textarea textarea');
    return textarea ? textarea.value : this.getAttribute('value') || '';
  }

  set value(nextValue) {
    const normalizedValue = String(nextValue ?? '');
    if (nextValue === null || nextValue === undefined) {
      this.removeAttribute('value');
    } else {
      this.setAttribute('value', normalizedValue);
    }
    const root = this.querySelector('.sf-textarea');
    const textarea = root?.querySelector('textarea');
    if (root?.__sfTextareaMask) root.__sfTextareaMask.value = normalizedValue;
    else if (textarea) textarea.value = normalizedValue;
    this.sfSyncFormState?.();
  }

  get rows() {
    const value = Math.trunc(this.getNumberAttr('rows', 3));
    return value > 0 ? value : 3;
  }

  get minRows() {
    const value = Math.trunc(this.getNumberAttr('minRows', 1));
    return value > 0 ? value : 1;
  }

  // No cap unless one is given; a cap below min-rows is min-rows.
  get maxRows() {
    const value = Math.trunc(this.getNumberAttr('maxRows', null));
    return value > 0 ? Math.max(value, this.minRows) : null;
  }

  // C141 (2): a form field follows its text from 3 to 10 rows. It grows unless
  // the page says auto-grow="false", or fixes the height with rows (and no
  // auto-grow), or the field is flush -- a part of a composite that sizes it
  // (the chat composer), which grows only when asked, from 1 row, uncapped,
  // as before. A growing form field starts at min-rows, else rows, else 3,
  // and stops at max-rows, else 10, then scrolls inside.
  get growing() {
    if (this.hasAttribute('auto-grow')) return Boolean(this.autoGrow);
    if (this.appearance === 'flush') return false;
    return !this.hasAttribute('rows');
  }

  get growMinRows() {
    if (this.appearance === 'flush' || this.hasAttribute('min-rows')) return this.minRows;
    return this.hasAttribute('rows') ? this.rows : 3;
  }

  get growMaxRows() {
    const value = Math.trunc(this.getNumberAttr('maxRows', null));
    if (value > 0) return Math.max(value, this.growMinRows);
    return this.appearance === 'flush' ? null : Math.max(10, this.growMinRows);
  }

  // The count against maxlength (C141 (1), helpers/char-count.js): shown from
  // 80 % of the limit or always with `counter`; past the limit the field is
  // invalid and draws the error frame, and the text is kept whole.
  sfCount() {
    return charCount(this.value.length, this.maxlength, { always: Boolean(this.counter) });
  }

  // What the template draws of the count, and the polite line, which changes
  // only when a threshold is crossed.
  sfCountView() {
    const count = this.sfCount();
    const words = (state) => this.sfWord('count-text', { vars: { count: state.length, max: state.limit } });
    const said = countAnnouncement(count, this._countLevel, this._countSaid, (state) => (
      state.over ? this.sfTooLongMessage(state) : words(state)
    ));
    this._countLevel = said.level;
    this._countSaid = said.said;
    return { over: count.over, text: count.shown ? words(count) : '', said: said.said };
  }

  sfTooLongMessage(count) {
    return this.sfWord('too-long', { vars: { max: count.limit } });
  }

  // The native textarea's validity, and too-long past the limit: the native
  // maxlength would cut the text, so the field counts itself. Without
  // ElementInternals the textarea is the form control and carries it.
  sfSyncValidity() {
    const anchor = this.sfValidityAnchor();
    const count = this.sfCount();
    const message = count.over ? this.sfTooLongMessage(count) : '';
    if (!this.sfInternals && anchor?.setCustomValidity) anchor.setCustomValidity(message);
    syncFieldValidity(this, anchor, count.over ? { tooLong: message } : {});
  }

  // The inherited-value seam: the native textarea is the value, the focus and
  // what carries the description.
  inheritedFocusTarget() {
    return this.querySelector('.sf-textarea textarea');
  }

  getInputElement() {
    return this.inheritedFocusTarget();
  }

  // A reset is said the way typing is: input, then change, from the textarea.
  clearOwnValue() {
    this.value = '';
    const textarea = this.inheritedFocusTarget();
    textarea?.dispatchEvent(new Event('input', {bubbles: true}));
    textarea?.dispatchEvent(new Event('change', {bubbles: true}));
  }

  // The browser's restore of a form (back, reload) gives the text back.
  formStateRestoreCallback(state) {
    if (typeof state === 'string') this.value = state;
  }

  templateContext() {
    const props = this.getPropsContext();
    const textarea = this.querySelector('textarea');
    const count = this.sfCountView();
    const code = this.text === 'code';

    return this.createTemplateContext({
      ...props,
      // The size the field draws: one of the field ladder's five steps.
      size: this.size,
      value: this.hasAttribute('value') || !textarea ? props.value : textarea.value,
      // The default form.reset() puts back is the declared value, never the
      // live one: a render while the person types (the shown required error
      // clearing) made the first typed character the default (C55
      // acceptance F1 R2, D2).
      defaultValue: props.value ?? '',
      // The host is the form control where the browser has ElementInternals,
      // so the textarea carries no name (§17.1 item 6).
      controlName: innerControlName(this, props.name),
      // The page's error, or the required one a failed form check shows
      // (ShownRequired, C55 acceptance F1: as sf-dropdown 1.9.0), or a text
      // past the limit (C141 (1)).
      invalid: this.sfShownInvalid(props.invalid) || count.over,
      error: false,
      errorMessage: this.sfShownMessage(props.invalid, props.errorMessage),
      // Resolved names the template reads (contracts/template-context.json).
      type: this.appearance,
      minlength: this.minlength,
      maxlength: this.maxlength,
      autoGrow: this.growing,
      minRows: this.growMinRows,
      maxRows: this.growMaxRows,
      // The grip only on request, never on a touch screen (the sheet says it).
      resize: Boolean(this.resize),
      // The count: its words when shown, over the limit; the polite line.
      count: count.text,
      countOver: count.over,
      countSaid: count.said,
      // C141 (8): code -- the code font, no spelling, no wrapping.
      code,
      spellCheck: code ? false : props.spellCheck,
      inheritedValue: this.inheritedValue,
      inheritedText: this.inheritedText,
      resetLabel: this.resetLabel,
      ariaLabel: this.ariaLabel,
      labelledBy: this.labelledBy,
      component: this,
    });
  }

  onDisconnected() {
    if (this._boundRoot) {
      unbindTextarea(this._boundRoot);
      this._boundRoot = null;
    }
  }

  afterRender() {
    if (this._boundRoot) {
      unbindTextarea(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-textarea');
    if (this._boundRoot) {
      bindTextarea(this._boundRoot);
    }
    this.syncInheritedState();
    this.sfSyncFormState();
  }

  template() {
    return renderTextareaTemplate(this.templateContext());
  }

  get state() {
    const root = this.querySelector('.sf-textarea');
    const textarea = root?.querySelector?.('textarea') || null;
    return {
      value: textarea?.value || '',
      disabled: !!textarea?.disabled,
      invalid: textarea?.getAttribute('aria-invalid') === 'true',
      error: root?.classList?.contains('error') || textarea?.classList?.contains('error') || false,
    };
  }

  setState(nextState = {}) {
    const root = this.querySelector('.sf-textarea');
    return setTextareaState(root, nextState);
  }
}

SfTextarea.define('sf-input-textarea');
