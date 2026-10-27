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
// chunk; tone and setProgress are dated aliases (aliases.json).
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
      status: {default: 'neutral', values: ['neutral', 'info', 'success', 'warning', 'error'], aliases: ['tone'], valueAliases: {neutral: ['primary']}},
    };
  }

  constructor() {
    super();
    this._boundRoot = null;
  }

  get status() {
    return this.getProp('status');
  }

  // The accessible name: label, else the host's aria-label (§3.1, §4.8).
  get accessibleLabel() {
    return this.label || this.getAttribute('aria-label') || '';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      label: this.accessibleLabel,
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
      label: this.label,
      valueText: this.valueText,
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
    const directPatchAttributes = ['value', 'text-position', 'status', 'tone', 'label', 'value-text', 'aria-label'];
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
    return setProgressBarState(root, {
      value: this.value,
      textPosition: this.textPosition,
      tone: this.status,
      label: this.accessibleLabel,
      valueText: this.valueText,
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
