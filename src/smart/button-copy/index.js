// sf-button-copy: copies a value and says so (owner-approved assignment,
// 2026-10-14). The icon turns to a check for a moment and the result is
// announced politely; when the browser refuses the clipboard (an embedded
// frame, a policy), the source is selected instead and the person is told to
// press Ctrl+C, so the copy is never simply lost.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// the settings are made by core/js/element-manifest.js; copy is the action
// and answers an outcome; the facts are sf-button-copy-copied and
// sf-button-copy-copy-failed (sf-copy-button-* until 2027-01-01), the old sf-copy and sf-copy-error their dated
// aliases (aliases.json); the words are the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
// The copy and what it says are core's (core/js/copy-feedback.js over
// SF.copyText; decision C48, 2026-11-11), shared with the attribute route
// data-sf-copy of the clipboard component: one phase, timer and set of words.
import {createCopyFeedback, readCopyText} from '../../core/js/copy-feedback.js';
import BundledPosition from '../../core/js/position.js';
import {instancePath, partId} from '../../core/js/instance-path.js';
import {tagSelector} from '../../core/js/tag-aliases.js';
import {preloadControlIcons} from '../helpers/cycle';
import {renderCopyButtonTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// Prefer the placement helper Core published; an isolated bundle uses its own copy.
const positioning = () => globalThis.SF?.Position || BundledPosition;

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
    this._feedback = createCopyFeedback({
      duration: () => this.duration,
      onPhase: (phase, message) => {
        this.state = {phase, message};
        this.requestComponentUpdate('phase');
      },
    });
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
    return readCopyText(element);
  }

  // The action copy (component.json): the generated method calls this and
  // answers its outcome; the press of the template calls the method.
  async runCopy() {
    const result = await this._feedback.run({
      read: () => this.source(),
      // Refused by the browser: the target is selected, or the value in a
      // hidden holder inside the host, so the person can copy it.
      element: () => this.sourceElement(),
      host: this,
      holderClass: 'sf-copy-button-holder',
      document: this.ownerDocument,
      words: (key, vars) => this.words(key, vars),
      messages: {copied: this.successText, failed: this.errorText},
    });
    if (result.outcome === 'applied') {
      this.sfEmit('copied', {text: result.text, method: result.method});
      return {outcome: 'applied', text: result.text, method: result.method};
    }
    if (result.reason === 'busy') return {outcome: 'refused', reason: 'busy'};
    // The event's codes: the source's own, else denied (a refusal or no clipboard).
    const code = ['empty_source', 'missing_target', 'ambiguous_source'].includes(result.reason) ? result.reason : 'denied';
    this.sfEmit('copy-failed', {code});
    return {outcome: 'refused', reason: code};
  }

  disconnectedCallback() {
    this._feedback.cancel();
    this.stopResult();
    super.disconnectedCallback?.();
  }

  // The result glyphs are asked for with the first drawing, not when they are
  // first drawn: an icon the subset has not got draws nothing until a second
  // font arrives, and the error glyph came about a second after a refusal
  // (docs pre-check, copy anatomy finding 7).
  afterRender() {
    super.afterRender?.();
    preloadControlIcons(this, [this.successIcon || 'check', 'error']);
    this.placeResult();
  }

  // The failed copy's words, shown above the control (the template draws the
  // surface; this places it with SF.Position while it shows, and lets it go).
  placeResult() {
    const result = this.querySelector(':scope .sf-copy-button-result');
    // The drawn control, under its current tag or an old one in its window.
    const hosts = [tagSelector('sf-button'), tagSelector('sf-button-icon')].join(', ');
    const control = this.querySelector(`:scope .sf-copy-button > :is(${hosts})`)?.querySelector('.sf-button, .sf-icon-button');
    if (!result || result.hidden || !control) {
      this.stopResult();
      return;
    }
    if (this._result?.box === result) return;
    this.stopResult();
    const placed = positioning().anchor(control, result, {side: 'block-start', align: 'center', fitHeight: false});
    this._result = {box: result, placed};
  }

  stopResult() {
    this._result?.placed?.stop?.();
    this._result = null;
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
      nameTooltipId: partId(instancePath(this, {kind: 'sf-button-copy'}), 'name'),
      phase: this.state.phase,
      message: this.state.message,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderCopyButtonTemplate(this.templateContext());
  }
}

SfCopyButton.define('sf-button-copy');
