import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import { renderProgressRingTemplate } from './js/templates/default';
import manifest from './component.json';
import enFile from './lang/en.json';
import ruFile from './lang/ru.json';
// Only the words on screen ship in the bundle; the title, settings and events
// stay in the language files for the Studio and the docs (localization study LC-2).
const en = {runtime: enFile.runtime};
const ru = {runtime: ruFile.runtime};

// sf-progress-ring from its component.json (standard simai.smart-component
// 1.3.11 §3, §4; the 1.4 folder of five authored files): its settings are
// attributes and properties made by core/js/element-manifest.js, and a job's
// part arrives as the stream fact chunk {done, total} (vocabulary 1.1.5 §5.2),
// which a rule hands to the action chunk, as on sf-progress-bar. The drawing
// is the class component progress-ring's: the value is a custom property on
// the root, the ring carries the role, the slot content stands beside it.
const ProgressRingElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  actions: {
    chunk({ done, total } = {}) {
      return showChunk(this, done, total);
    },
  },
});

// A part of a job as a percentage of the ring: done of total (100 when the
// rule gives none), clamped to 0..100 (vocabulary §5.2).
export function showChunk(element, done, total) {
  const whole = total === undefined || total === null || total === '' ? 100 : Number(total);
  const part = Number(done);
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) {
    return { outcome: 'refused', reason: 'invalid' };
  }
  const percent = Math.max(0, Math.min(100, (part / whole) * 100));
  element.value = Math.round(percent * 100) / 100;
  return { outcome: 'applied' };
}

// The status drawn (owner decision C131 (7), as sf-progress-bar 1.2.0): the
// more serious of the page's status and the threshold the value reached. The
// thresholds are the page's, in per cent like the value; unset is none.
const RANK = { warning: 1, error: 2 };
export function drawnStatus(status, value, warningAt, errorAt) {
  const number = Number(value);
  let reached = '';
  if (Number.isFinite(number)) {
    if (Number.isFinite(errorAt) && number >= errorAt) reached = 'error';
    else if (Number.isFinite(warningAt) && number >= warningAt) reached = 'warning';
  }
  return (RANK[reached] ?? 0) > (RANK[status] ?? 0) ? reached : status;
}

class SfProgressRing extends ProgressRingElement {
  static get props() {
    return {
      ...super.props,
      // No status (empty) is the theme's primary; neutral is grey (C131 (1)).
      status: {default: '', values: ['', 'neutral', 'info', 'success', 'warning', 'error'], valueAliases: {'': ['primary']}},
    };
  }

  get status() {
    return this.getProp('status');
  }

  // A threshold holds only where the page set it.
  threshold(attribute) {
    if (!this.hasAttribute(attribute)) return null;
    const number = Number(this.getAttribute(attribute));
    return Number.isFinite(number) ? number : null;
  }

  get drawnStatus() {
    return drawnStatus(this.status, this.value, this.threshold('warning-at'), this.threshold('error-at'));
  }

  // The accessible name: label, else the host's aria-label (§3.1, §4.8).
  get accessibleLabel() {
    return this.label || this.getAttribute('aria-label') || '';
  }

  static get observedAttributes() {
    return [...new Set([...super.observedAttributes, 'aria-label'])];
  }

  // An avatar put in the ring without slot="content" is not the ring's
  // content: it stands beside the ring (AR-4, recipe C152 (8)). It is said
  // once a page -- one console warning, wherever the ring is -- and each
  // ring is listed in SF.deprecations, so a person or a probe finds it.
  noteUnslottedAvatar() {
    if (this._unslottedNoted) return;
    const stray = [...this.children].find((child) => (child.localName === 'sf-avatar' || child.classList?.contains('sf-avatar'))
      && !child.hasAttribute('slot') && !child.hasAttribute('data-sf-held'));
    if (!stray) return;
    this._unslottedNoted = true;
    noteDeprecated({component: 'sf-progress-ring', tag: 'sf-progress-ring', kind: 'markup', attribute: 'slot', from: 'sf-avatar without slot', to: 'slot="content"'});
    const root = globalThis.SF = globalThis.SF || {};
    if (root.__progressRingAvatarWarned) return;
    Object.defineProperty(root, '__progressRingAvatarWarned', {value: true, configurable: true});
    globalThis.console?.warn?.(`[SIMAI Framework] sf-progress-ring${this.id ? ` #${this.id}` : ''}: an sf-avatar inside the ring without slot="content" is drawn beside the ring, not in it. Give the sf-avatar slot="content" (decision C152 (8)).`);
  }

  templateContext() {
    this.noteUnslottedAvatar();
    const status = this.drawnStatus;
    this.sfHostState('data-status', status);
    return this.createTemplateContext({
      ...this.getPropsContext(),
      drawnStatus: status,
      label: this.accessibleLabel,
      content: this.hasSlotContent?.('content') ? this.getSlotContent('content') : null,
      rootClass: this.getRootClass(),
      component: this,
    });
  }

  template() {
    return renderProgressRingTemplate(this.templateContext());
  }
}

SfProgressRing.define('sf-progress-ring');
