import SfBaseElement from '../../core/js/smart-base';
import { fieldSize } from '../../component/field-size';
import { setProgressScaleState } from '../../component/progress-scale/js/_progress_scale';
import { renderProgressScaleTemplate } from './js/templates/default';

function normalizeProgressValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(100, parsed));
}

class SfProgressScale extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      size: { default: '1' },
      line: { default: '' },
      value: { default: '0' },
      showText: { type: Boolean, default: true },
      // The axis is called status, and speaks the shared vocabulary. `tone`
      // and its value `primary` keep working: see contracts/public-api-axes.json.
      status: {default: 'neutral', values: ['neutral', 'info', 'success', 'warning', 'error'], aliases: ['tone'], valueAliases: {neutral: ['primary']}},
      label: { default: '' },
      valueText: { default: '' },
    };
  }


  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get value() {
    return this.getAttribute('value') || '0';
  }

  set value(nextValue) {
    if (nextValue === null || nextValue === undefined) {
      this.removeAttribute('value');
      return;
    }

    this.setAttribute('value', String(nextValue));
  }

  get size() {
    return this.getAttribute('size') || '1';
  }

  // In a row or a table cell the element takes the text line of a form size,
  // so the row keeps its control height.
  get line() {
    const line = this.getAttribute('line') || '';
    return line ? fieldSize(line, 'sf-progress-scale line') : '';
  }


  get showText() {
    return this.getBooleanAttr('show-text', true);
  }

  get status() {
    return this.getProp('status');
  }

  // The legacy name, kept so a consumer reading el.tone still gets an answer.
  get tone() {
    return this.status;
  }

  get label() {
    return this.getAttribute('label') || '';
  }

  get valueText() {
    return this.getAttribute('value-text') || '';
  }

  set showText(nextValue) {
    if (nextValue === null || nextValue === undefined || nextValue === '') {
      this.removeAttribute('show-text');
      return;
    }

    if (nextValue === true) {
      this.setAttribute('show-text', '');
      return;
    }

    this.setAttribute('show-text', String(nextValue));
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
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
      tone: this.tone,
      label: this.label,
      valueText: this.valueText,
    };
  }

  getProgress() {
    return normalizeProgressValue(this.value);
  }

  setProgress(nextValue) {
    this.value = nextValue;
    return this;
  }

  resolveUpdateMode(changedAttributes = []) {
    const directPatchAttributes = ['value', 'show-text', 'tone', 'label', 'value-text'];
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
      tone: this.tone,
      label: this.label,
      valueText: this.valueText,
    });
  }
}

SfProgressScale.define('sf-progress-scale');
