import SfBaseElement from '../../core/js/smart-base';
import { fieldSize } from '../../component/field-size';
import { renderReferenceLinkTemplate } from './js/templates/default';


class SfReferenceLink extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      size: { default: '' },
      line: { default: '' },
      appearance: { default: 'card' },
      icon: { default: 'arrow_forward' },
      label: { default: '' },
      text: { default: '' },
      href: { default: '' },
      target: { default: '_self' },
      disabled: { type: Boolean, default: false },
      ariaLabel: { default: '' },
    };
  }


  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  // Without a size the reference keeps its card spacing; with one it is a
  // control of that form size.
  get size() {
    const size = this.getAttribute('size') || '';
    return size ? fieldSize(size, 'sf-reference-link') : '';
  }

  // On a text line the reference is a link on the line rather than a card.
  get line() {
    const line = this.getAttribute('line') || '';
    return line ? fieldSize(line, 'sf-reference-link line') : '';
  }

  // A reference is a card by default and plain where it stands inside something
  // that is already a box -- a record's field, a cell -- so a second frame and
  // fill around the value would be a box drawn twice.
  get appearance() {
    return this.getAttribute('appearance') === 'plain' ? 'plain' : 'card';
  }

  // An absent attribute is the default arrow; an empty one is no icon at all.
  // Read as `|| default` the two were the same answer, so a reference drawn
  // beside its own label could not drop the arrow it does not need.
  get icon() {
    const icon = this.getAttribute('icon');
    return icon === null ? 'arrow_forward' : icon;
  }

  get label() {
    return this.getAttribute('label') || '';
  }

  get text() {
    return this.getAttribute('text') || '';
  }

  get href() {
    return this.getAttribute('href') || '';
  }

  get target() {
    return this.getAttribute('target') || '_self';
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  get ariaLabel() {
    return this.getAttribute('aria-label') || '';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderReferenceLinkTemplate(this.templateContext());
  }

  handleRootClick = (event) => {
    if (!this.disabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
  };

  onClick(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('click', handler, options);
    }

    return this;
  }
}

SfReferenceLink.define('sf-reference-link');
