import {
  bindProgressBar,
  setProgressBarState,
  unbindProgressBar,
} from '../../component/progress-bar/js/_progressbar';
import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import { renderProgressBarTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-progress-bar from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §4.4): its settings are attributes and properties made by
// core/js/element-manifest.js; a job's part arrives as the stream fact chunk
// {done, total} (vocabulary 1.1.5 §5.2), which a rule hands to the action
// chunk; tone and setProgress are dated aliases (aliases.json). warning-at and
// error-at (1.2.0) turn the bar a warning or an error by itself. indeterminate
// (1.3.0) runs a segment for work of unknown size; paused (1.3.0) is at least
// a warning and is said in the value text (C34).
const ProgressBarElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
  actions: {
    chunk({ done, total } = {}) {
      return showChunk(this, done, total);
    },
  },
});

// A part of a job as a percentage of the bar: done of total (100 when the
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

// The status the bar draws (1.2.0): the more serious of the page's status and
// the threshold the value reached. The thresholds are the page's, in per cent
// like the value; unset (null) is no threshold. neutral, info and success rank
// below warning, warning below error.
const RANK = { warning: 1, error: 2 };
export function thresholdStatus(value, warningAt, errorAt) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  if (Number.isFinite(errorAt) && number >= errorAt) return 'error';
  if (Number.isFinite(warningAt) && number >= warningAt) return 'warning';
  return '';
}

export function effectiveStatus(status, value, warningAt, errorAt) {
  const reached = thresholdStatus(value, warningAt, errorAt);
  return (RANK[reached] ?? 0) > (RANK[status] ?? 0) ? reached : status;
}

// Paused (1.3.0, C34): at least a warning; an error stays an error.
export function pausedStatus(status, paused) {
  return paused && (RANK[status] ?? 0) < RANK.warning ? 'warning' : status;
}

// What retires without a new name (aliases.json rows with `to: null`): kept
// until the date, and each call is noted with it.
function noteRetired(from) {
  noteDeprecated({ component: 'sf-progress-bar', tag: 'sf-progress-bar', kind: 'action', from, to: null,
    since: aliases.since, remove_after: aliases.remove_after });
}

class SfProgressBar extends ProgressBarElement {
  static get props() {
    return {
      ...super.props,
      // The axis is called status, and speaks the shared vocabulary. `tone`
      // and its value `primary` keep working: see contracts/public-api-axes.json.
      // No status (empty) is the theme's primary; neutral is grey (C131 (1)).
      status: {default: '', values: ['', 'neutral', 'info', 'success', 'warning', 'error'], aliases: ['tone'], valueAliases: {'': ['primary']}},
      // top | inline-end | none (C131 (4)); bottom and right are the former
      // words until 2027-01-01 (journal value-progress-text-position).
      textPosition: {default: 'none', values: ['none', 'top', 'inline-end'], attribute: 'text-position', valueAliases: {top: ['bottom'], 'inline-end': ['right']}},
    };
  }

  constructor() {
    super();
    this._boundRoot = null;
  }

  get status() {
    return this.getProp('status');
  }

  // A threshold holds only where the page set it: an unset number reads 0.
  threshold(attribute) {
    if (!this.hasAttribute(attribute)) return null;
    const number = Number(this.getAttribute(attribute));
    return Number.isFinite(number) ? number : null;
  }

  // The status drawn: the page's, or the threshold the value reached; a
  // paused bar is at least a warning (C34).
  get drawnStatus() {
    return pausedStatus(effectiveStatus(this.status, this.value, this.threshold('warning-at'), this.threshold('error-at')), this.paused);
  }

  // What a screen reader hears beside the value: the page's value text, else
  // for a paused bar the value with the word paused (C34).
  get spokenValueText() {
    if (this.valueText) return this.valueText;
    if (!this.paused) return '';
    if (this.indeterminate) return this.sfWord('paused');
    const value = Math.max(0, Math.min(100, Number(this.value) || 0));
    return this.sfWord('paused-value').replace('{value}', String(Math.round(value * 100) / 100));
  }

  // The accessible name: label, else the host's aria-label (§3.1, §4.8).
  get accessibleLabel() {
    return this.label || this.getAttribute('aria-label') || '';
  }

  templateContext() {
    const props = this.getPropsContext();

    const status = this.drawnStatus;
    this.sfHostState('data-status', status);

    // The drawn status and the spoken value text go under their own names:
    // status and valueText are the page's settings as given (their getters),
    // and the template reads what the bar resolved (template-context rule).
    return this.createTemplateContext({
      ...props,
      drawnStatus: status,
      label: this.accessibleLabel,
      spokenValueText: this.spokenValueText,
      indeterminate: Boolean(this.indeterminate),
      paused: Boolean(this.paused),
      meter: Boolean(this.meter),
      component: this,
    });
  }

  template() {
    return renderProgressBarTemplate(this.templateContext());
  }

  get state() {
    return {
      size: this.size,
      value: this.value,
      textPosition: this.textPosition,
      status: this.status,
      drawnStatus: this.drawnStatus,
      label: this.label,
      valueText: this.valueText,
      indeterminate: Boolean(this.indeterminate),
      paused: Boolean(this.paused),
      meter: Boolean(this.meter),
    };
  }

  // §4.4: a reader retires; read value.
  getProgress() {
    noteRetired('getProgress');
    return Number(this.value || 0);
  }

  // §4.4: text-position is a writable setting.
  setTextPosition(nextValue) {
    noteRetired('setTextPosition');
    this.textPosition = nextValue === null || nextValue === undefined || nextValue === '' ? null : nextValue;
    return this;
  }

  resolveUpdateMode(changedAttributes = []) {
    const directPatchAttributes = ['value', 'text-position', 'status', 'tone', 'warning-at', 'error-at', 'label', 'value-text', 'aria-label', 'indeterminate', 'paused', 'meter'];
    if (
      changedAttributes.length > 0 &&
      changedAttributes.every((attr) => directPatchAttributes.includes(attr))
    ) {
      return 'dom';
    }

    return 'lit';
  }

  updateDom() {
    const root = this.querySelector('.sf-progress-bar');
    if (!root) return false;
    const status = this.drawnStatus;
    this.sfHostState('data-status', status);
    return setProgressBarState(root, {
      value: this.value,
      textPosition: this.textPosition,
      tone: status,
      label: this.accessibleLabel,
      valueText: this.spokenValueText,
      indeterminate: Boolean(this.indeterminate),
      paused: Boolean(this.paused),
      meter: Boolean(this.meter),
    });
  }

  afterRender() {
    if (this._boundRoot) {
      unbindProgressBar(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-progress-bar');
    if (this._boundRoot) {
      bindProgressBar(this._boundRoot);
    }
  }

  onDisconnected() {
    if (this._boundRoot) {
      unbindProgressBar(this._boundRoot);
      this._boundRoot = null;
    }
  }
}

SfProgressBar.define('sf-progress-bar');
