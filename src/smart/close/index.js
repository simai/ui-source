import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderCloseTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-close from its component.json (standard simai.smart-component 1.3.8 §3,
// §4): the decorative cross of a close action. `size` is the attribute and
// property core/js/element-manifest.js makes from the manifest; a value outside
// the ladder reads as the default 1/3. The glyph is aria-hidden: the native
// button it stands in owns the name, focus and the action.
const CloseElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfClose extends CloseElement {
  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      size: this.size,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderCloseTemplate(this.templateContext());
  }
}

SfClose.define('sf-close');
