import SfBaseElement from '../../core/js/smart-base';
import { renderListItemTemplate } from './js/templates/default';
import { nearestFieldSize } from '../../component/field-size';

function normalizeSizeGroup(value) {
  const size = value;

  if (size === '1/3' || size === '1/2') {
    return {
      item: size,
      checkbox: nearestFieldSize(size),
      avatarGroup: '1/2',
      colorTag: '1/2',
    };
  }

  return {
    item: size,
    checkbox: nearestFieldSize(size),
    avatarGroup: size,
    colorTag: '1',
  };
}

class SfListItem extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      itemValue: { attribute: 'value', default: '' },
      // The axis is called kind, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      kind: {default: 'text', values: ['text', 'icon', 'checkbox', 'avatar', 'color'], aliases: ['type']},
      size: { default: '1', values: ['1/3', '1/2', '1', '2', '3'] },
      text: { default: '' },
      icon: { default: 'person' },
      checked: { type: Boolean, default: false },
      selected: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
      colorClass: { default: 'bg-tertiary' },
      avatarImageUrl: { default: '' },
      avatarTitle: { default: '' },
      ariaLabel: { default: '' },
    };
  }


  get componentName() {
    return 'list-item';
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get kind() {
    return this.getProp('kind');
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer.
  get type() {
    return this.kind;
  }

  get itemValue() {
    return this.getAttribute('value') || '';
  }

  get size() {
    return this.getEnumAttr('size', ['1/3', '1/2', '1', '2', '3'], '1');
  }

  get sizeGroup() {
    return normalizeSizeGroup(this.size);
  }

  get text() {
    return this.getAttribute('text') || '';
  }

  get icon() {
    return this.getAttribute('icon') || 'person';
  }

  get checked() {
    return this.getBooleanAttr('checked', false);
  }

  get selected() {
    return this.getBooleanAttr('selected', false);
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  get colorClass() {
    return this.getAttribute('color-class') || 'bg-tertiary';
  }

  get avatarImageUrl() {
    return this.getAttribute('avatar-image-url') || '';
  }

  get avatarTitle() {
    return this.getAttribute('avatar-title') || this.text;
  }

  get ariaLabel() {
    return this.getAttribute('aria-label') || '';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      sizeGroup: this.sizeGroup,
      avatarTitle: this.avatarTitle,
      // Resolved names the template reads (contracts/template-context.json).
      type: this.type,
      value: this.itemValue,
      option: false,
    });
  }

  template() {
    return renderListItemTemplate(this.templateContext());
  }

  resolveUpdateMode(changedAttributes = []) {
    if (
      changedAttributes.length > 0 &&
      changedAttributes.every((attr) =>
        ['text', 'aria-label', 'disabled', 'selected', 'checked'].includes(attr),
      )
    ) {
      return 'dom';
    }

    return 'lit';
  }

  updateDom(changedAttributes = []) {
    const root = this.querySelector('.sf-list-item');
    const textNode = this.querySelector(
      '.sf-list-item-container, .sf-avatar-label-group-title, .sf-tag-container',
    );
    const checkbox = this.querySelector('.sf-checkbox input');

    if (!root) return false;

    if (changedAttributes.includes('text') && textNode) {
      textNode.textContent = this.text;
    }

    if (changedAttributes.includes('disabled')) {
      root.classList.toggle('disabled', this.disabled);

      if (checkbox) {
        checkbox.disabled = this.disabled;
      }
    }

    if (changedAttributes.includes('selected')) {
      root.classList.toggle('selected', this.selected);
    }

    if (
      checkbox &&
      (changedAttributes.includes('checked') || changedAttributes.includes('selected'))
    ) {
      checkbox.checked = this.checked || this.selected;
    }

    return true;
  }

  get value() {
    return {
      template: this.templateName,
      value: this.itemValue,
      type: this.type,
      size: this.size,
      text: this.text,
      icon: this.icon,
      checked: this.checked,
      selected: this.selected,
      disabled: this.disabled,
      colorClass: this.colorClass,
      avatarImageUrl: this.avatarImageUrl,
      avatarTitle: this.avatarTitle,
      ariaLabel: this.ariaLabel,
    };
  }

  set value(nextValue) {
    if (!nextValue || typeof nextValue !== 'object') return;

    const { value: itemValue, ...attributes } = nextValue;
    if (Object.prototype.hasOwnProperty.call(nextValue, 'value')) {
      this.setAttributeValue('value', itemValue);
    }
    this.setValueAttributes(attributes);
  }
}

SfListItem.define('sf-list-item');
