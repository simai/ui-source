import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderProgressRingTemplate } from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

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

  templateContext() {
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
