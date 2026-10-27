import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import { fieldSize } from '../../component/field-size';
import { setProgressScaleState } from '../../component/progress-scale/js/_progress_scale';
import { renderProgressScaleTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

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
  lang: { en, ru },
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
      status: {default: 'neutral', values: ['neutral', 'info', 'success', 'warning', 'error'], aliases: ['tone'], valueAliases: {neutral: ['primary']}},
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

  // The accessible name: label, else the host's aria-label (§3.1, §4.8).
  get accessibleLabel() {
    return this.label || this.getAttribute('aria-label') || '';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      line: this.line,
      label: this.accessibleLabel,
      value: normalizeProgressValue(props.value),
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
    const directPatchAttributes = ['value', 'show-text', 'status', 'tone', 'label', 'value-text', 'aria-label'];
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
    return setProgressScaleState(root, {
      value: this.value,
      showText: this.showText,
      tone: this.status,
      label: this.accessibleLabel,
      valueText: this.valueText,
    });
  }
}

SfProgressScale.define('sf-progress-scale');
