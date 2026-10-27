import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { fieldSize } from '../../component/field-size';
import { renderReferenceLinkTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-reference-link from its component.json (standard simai.smart-component
// 1.3.8 §3, §4): the settings are the attributes and properties
// core/js/element-manifest.js makes from the manifest. size and line keep
// their getters (a form size mapped onto the field ladder), icon its own
// (absent is the arrow, empty is none).
const ReferenceLinkElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfReferenceLink extends ReferenceLinkElement {

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  // Without a size the reference keeps its card spacing; with one it is a
  // control of that form size.
  get size() {
    const size = this.getAttribute('size') || '';
    return size ? fieldSize(size, 'sf-reference-link') : '';
  }

  set size(value) {
    super.size = value;
  }

  // On a text line the reference is a link on the line rather than a card.
  get line() {
    const line = this.getAttribute('line') || '';
    return line ? fieldSize(line, 'sf-reference-link line') : '';
  }

  set line(value) {
    super.line = value;
  }

  // An absent attribute is the default arrow; an empty one is no icon at all.
  // Read as `|| default` the two were the same answer, so a reference drawn
  // beside its own label could not drop the arrow it does not need.
  get icon() {
    const icon = this.getAttribute('icon');
    return icon === null ? 'arrow_forward' : icon;
  }

  set icon(value) {
    super.icon = value;
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      size: this.size,
      line: this.line,
      icon: this.icon,
      appearance: this.appearance,
      ariaLabel: this.getAttribute('aria-label') || '',
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
