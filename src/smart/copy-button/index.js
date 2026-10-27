// sf-copy-button: copies a value and says so (owner-approved assignment,
// 2026-10-14). The icon turns to a check for a moment and the result is
// announced politely; when the browser refuses the clipboard (an embedded
// frame, a policy), the source is selected instead and the person is told to
// press Ctrl+C, so the copy is never simply lost.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// the settings are made by core/js/element-manifest.js; copy is the action
// and answers an outcome; the facts are sf-copy-button-copied and
// sf-copy-button-copy-failed, the old sf-copy and sf-copy-error their dated
// aliases (aliases.json); the words are the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {renderCopyButtonTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

function isMac() {
  return /Mac|iPhone|iPad/u.test(globalThis.navigator?.platform ?? globalThis.navigator?.userAgent ?? '');
}

// The clipboard, and execCommand where the API is absent or refused; the
// same order the clipboard class uses.
async function writeText(text, documentRef) {
  if (globalThis.isSecureContext && globalThis.navigator?.clipboard?.writeText) {
    try {
      await globalThis.navigator.clipboard.writeText(text);
      return 'native';
    } catch { /* refused: the fallback is for exactly this */ }
  }
  const area = documentRef.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;inset-inline-start:-9999px;opacity:0';
  documentRef.body.append(area);
  area.select();
  let copied = false;
  try { copied = documentRef.execCommand('copy'); } catch { copied = false; }
  area.remove();
  if (!copied) throw new Error('denied');
  return 'legacy';
}

const CopyButtonElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
  actions: {
    copy() { return this.runCopy(); },
  },
});

class SfCopyButton extends CopyButtonElement {
  constructor() {
    super();
    this.state = {phase: 'idle', message: ''};
    this._timer = null;
    this._pending = false;
  }

  // An absent duration is two seconds: read as Number(null) it was zero, and
  // the result was gone before anyone could hear it. A negative one is too.
  get duration() {
    const raw = this.getAttribute('duration');
    const value = Number(raw);
    return raw !== null && raw !== '' && Number.isFinite(value) && value >= 0 ? value : 2000;
  }

  set duration(next) { super.duration = next; }

  words(key, vars) {
    return this.sfWord(key, vars ? {vars} : {});
  }

  sourceElement() {
    const id = this.target.trim();
    if (!/^#[A-Za-z][\w:.-]*$/u.test(id)) return null;
    return this.ownerDocument.getElementById(id.slice(1));
  }

  // What is copied: the value, or the target's -- an input's value, an
  // element's text, a numbered code block's code without its numbers.
  source() {
    const hasValue = this.hasAttribute('value');
    const hasTarget = Boolean(this.target.trim());
    if (hasValue && hasTarget) throw new Error('ambiguous_source');
    if (hasValue) return this.value;
    if (!hasTarget) throw new Error('empty_source');
    const element = this.sourceElement();
    if (!element) throw new Error('missing_target');
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.value;
    const rows = element.querySelectorAll(':scope .sf-code-lines > .sf-code-line > .sf-code-line__content');
    if (rows.length) return Array.from(rows, (row) => (row.textContent === ' ' ? '' : row.textContent)).join('\n');
    return element.textContent ?? '';
  }

  // Refused by the browser: the text is selected so the person can copy it.
  selectSource(text) {
    const element = this.sourceElement();
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.focus();
      element.select();
      return;
    }
    const selection = globalThis.getSelection?.();
    if (!selection) return;
    selection.removeAllRanges();
    if (element) {
      const range = this.ownerDocument.createRange();
      range.selectNodeContents(element);
      selection.addRange(range);
      return;
    }
    // A value with no element on the page: a hidden field holds it to select.
    let holder = this.querySelector('.sf-copy-button-holder');
    if (!holder) {
      holder = this.ownerDocument.createElement('span');
      holder.className = 'sf-copy-button-holder';
      this.append(holder);
    }
    holder.textContent = text;
    const range = this.ownerDocument.createRange();
    range.selectNodeContents(holder);
    selection.addRange(range);
  }

  // The action copy (component.json): the generated method calls this and
  // answers its outcome; the press of the template calls the method.
  async runCopy() {
    if (this._pending) return {outcome: 'refused', reason: 'busy'};
    this._pending = true;
    this.setPhase('pending', '');
    try {
      const text = this.source();
      if (!text) throw new Error('empty_source');
      const method = await writeText(text, this.ownerDocument);
      this.setPhase('success', this.successText || this.words('copied'));
      this.sfEmit('copied', {text, method});
      return {outcome: 'applied', text, method};
    } catch (error) {
      const code = ['empty_source', 'missing_target', 'ambiguous_source'].includes(error?.message) ? error.message : 'denied';
      if (code === 'denied') {
        let text = '';
        try { text = this.source(); } catch { /* nothing to select */ }
        this.selectSource(text);
        const keys = isMac() ? '⌘C' : 'Ctrl+C';
        this.setPhase('error', this.words('selected', {keys}));
      } else {
        this.setPhase('error', this.errorText || this.words('failed'));
      }
      this.sfEmit('copy-failed', {code});
      return {outcome: 'refused', reason: code};
    } finally {
      this._pending = false;
    }
  }

  setPhase(phase, message) {
    clearTimeout(this._timer);
    this.state = {phase, message};
    this.requestComponentUpdate('phase');
    if (phase === 'success' || phase === 'error') {
      this._timer = setTimeout(() => {
        this.state = {phase: 'idle', message: ''};
        this.requestComponentUpdate('phase');
      }, this.duration);
    }
  }

  disconnectedCallback() {
    clearTimeout(this._timer);
    super.disconnectedCallback?.();
  }

  templateContext() {
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      size: this.size,
      appearance: this.appearance,
      text: this.text,
      icon: this.icon,
      successIcon: this.successIcon,
      // The name says what is copied when the host says so.
      name: this.label || this.text || this.words('copy'),
      phase: this.state.phase,
      message: this.state.message,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderCopyButtonTemplate(this.templateContext());
  }
}

SfCopyButton.define('sf-copy-button');
