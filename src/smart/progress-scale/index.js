import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import { fieldSize } from '../../component/field-size';
import { setProgressScaleState } from '../../component/progress-scale/js/_progress_scale';
import { effectiveStatus, readThreshold } from '../../component/progress-threshold';
import { renderProgressScaleTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).

function normalizeProgressValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(100, parsed));
}

// sf-progress-scale from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §4.4): its settings are attributes and properties made by
// core/js/element-manifest.js; a job's part arrives as the stream fact chunk
// {done, total} (vocabulary 1.1.5 §5.2), which a rule hands to the action
// chunk; tone and setProgress are dated aliases (aliases.json).
const ProgressScaleElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
  source: 'ru',
  aliases,
  actions: {
    chunk({ done, total } = {}) {
      const whole = total === undefined || total === null || total === '' ? 100 : Number(total);
      const part = Number(done);
      if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) {
        return { outcome: 'refused', reason: 'invalid' };
      }
      this.value = Math.round(normalizeProgressValue((part / whole) * 100) * 100) / 100;
      return { outcome: 'applied' };
    },
  },
});

class SfProgressScale extends ProgressScaleElement {
  static get props() {
    return {
      ...super.props,
      // The axis is called status, and speaks the shared vocabulary. `tone`
      // and its value `primary` keep working: see contracts/public-api-axes.json.
      // No status (empty) is the theme's primary; neutral is grey (C131 (1)).
      status: {default: '', values: ['', 'neutral', 'info', 'success', 'warning', 'error'], aliases: ['tone'], valueAliases: {'': ['primary']}},
    };
  }

  // In a row or a table cell the element takes the text line of a form size,
  // so the row keeps its control height.
  get line() {
    const line = this.getAttribute('line') || '';
    return line ? fieldSize(line, 'sf-progress-scale line') : '';
  }

  set line(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('line');
    else this.setAttribute('line', String(value));
  }

  // The value as the scale shows it: a number clamped to 0..100 (the
  // template and the reader agree, contracts/template-context.json).
  get value() {
    return normalizeProgressValue(this.getAttribute('value') ?? 0);
  }

  set value(next) {
    if (next === null || next === undefined) this.removeAttribute('value');
    else this.setAttribute('value', String(next));
  }

  get status() {
    return this.getProp('status');
  }

  // A level of N (C185 (5)): the steps the page gave, 2..10, or none (a
  // percent scale of ten).
  get levelSteps() {
    if (!this.hasAttribute('steps')) return null;
    const parsed = Math.trunc(Number(this.getAttribute('steps')));
    return Number.isFinite(parsed) ? Math.max(2, Math.min(10, parsed)) : 10;
  }

  // «4 из 5» in the element's language.
  levelWords(lit, steps) {
    return this.sfWord('of-steps', {vars: {value: lit, total: steps}});
  }

  // A threshold holds only where the page set it.
  threshold(attribute) {
    return readThreshold(this.getAttribute(attribute));
  }

  // The status drawn (C131 (7), as sf-progress-bar): the more serious of the
  // page's status and the threshold the value reached.
  get drawnStatus() {
    return effectiveStatus(this.status, this.value, this.threshold('warning-at'), this.threshold('error-at'));
  }

  // The accessible name: label, else the host's aria-label (§3.1, §4.8).
  get accessibleLabel() {
    return this.label || this.getAttribute('aria-label') || '';
  }

  templateContext() {
    const props = this.getPropsContext();

    const status = this.drawnStatus;
    this.sfHostState('data-status', status);
    return this.createTemplateContext({
      ...props,
      drawnStatus: status,
      meter: Boolean(this.meter),
      component: this,
      line: this.line,
      label: this.accessibleLabel,
      value: normalizeProgressValue(props.value),
      steps: this.levelSteps,
      levelWords: (lit, steps) => this.levelWords(lit, steps),
    });
  }

  template() {
    return renderProgressScaleTemplate(this.templateContext());
  }

  get state() {
    return {
      size: this.size,
      line: this.line,
      value: normalizeProgressValue(this.value),
      showText: this.showText,
      status: this.status,
      drawnStatus: this.drawnStatus,
      meter: Boolean(this.meter),
      steps: this.levelSteps,
      label: this.label,
      valueText: this.valueText,
    };
  }

  // §4.4: a reader retires; read value.
  getProgress() {
    noteDeprecated({ component: 'sf-progress-scale', tag: 'sf-progress-scale', kind: 'action', from: 'getProgress', to: null,
      since: aliases.since, remove_after: aliases.remove_after });
    return normalizeProgressValue(this.value);
  }

  resolveUpdateMode(changedAttributes = []) {
    const directPatchAttributes = ['value', 'show-text', 'status', 'tone', 'warning-at', 'error-at', 'meter', 'label', 'value-text', 'aria-label'];
    if (
      changedAttributes.length > 0 &&
      changedAttributes.every((attr) => directPatchAttributes.includes(attr))
    ) {
      return 'dom';
    }

    return 'lit';
  }

  updateDom() {
    const root = this.querySelector('.sf-progress-scale');
    if (!root) return false;
    this.sfHostState('data-status', this.drawnStatus);
    // A level reads in the element's own words, not the page's (C185 (5)).
    const steps = this.levelSteps;
    const lit = steps ? Math.floor((this.value / 100) * steps + 1e-9) : 0;
    return setProgressScaleState(root, {
      value: this.value,
      showText: this.showText,
      tone: this.drawnStatus,
      meter: Boolean(this.meter),
      label: this.accessibleLabel,
      valueText: this.valueText || (steps ? this.levelWords(lit, steps) : ''),
      steps,
    });
  }
}

SfProgressScale.define('sf-progress-scale');
