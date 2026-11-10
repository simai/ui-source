import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderCloseTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-button-close from its component.json (standard simai.smart-component 1.3.8 §3,
// §4): the close button of the SIMAI Framework (owner decision C14, 1.2.0). The
// settings are the attributes and properties core/js/element-manifest.js makes
// from the manifest; a value outside an enum reads as its default.
//
// Standalone, the element draws a native <button type="button"> in the icon
// button's box with the cross inside: it takes focus, Enter and Space press
// it, and the page listens to its click. Its name is the host's aria-label,
// else the runtime word close («Закрыть»).
//
// Inside a containing button -- sf-button-icon kind="close", a page's own
// .sf-icon-button -- it stays the decorative cross of 1.1.x: aria-hidden, never
// focusable; the containing button owns the name and the action.
const CloseElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

// A containing button: a native one, a role="button", or the icon button's
// box that a page writes as plain markup.
const CONTAINER = 'button, [role="button"], .sf-icon-button';

class SfClose extends CloseElement {
  // aria-label is the host's (§3.1), not a setting; it is watched so a name
  // changed after the first drawing reaches the button.
  static get observedAttributes() {
    return [...new Set([...super.observedAttributes, 'aria-label'])];
  }

  // The size the box is drawn at (1.3.0, DEV D1 on C35). A page's size wins.
  // Without one, a close asked for a height is a control of its place, as an
  // unsized sf-button is: the place's step, size 1, which a compact region
  // moves down because no size attribute holds it (C22) -- so
  // <sf-button-close height="low"> is 32, compact and phone 28, the notice's
  // close. Without a size or a height it stays the default 1/3.
  get placeSize() {
    if (this.hasAttribute('size')) return this.size;
    const height = this.height;
    return height && height !== 'default' ? '1' : this.size;
  }

  get isGlyph() {
    return Boolean(this.parentElement?.closest?.(CONTAINER));
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      glyph: this.isGlyph,
      // The declared size, as the template-context contract asks (1.3.1); the
      // box is drawn at placeSize, which a height without a size moves to 1.
      size: this.size,
      placeSize: this.placeSize,
      // The box's height (1.3.0, decisions C27 and C35).
      height: this.height,
      appearance: this.appearance,
      scheme: this.scheme,
      radius: this.radius,
      backdrop: this.backdrop,
      disabled: this.disabled,
      label: this.getAttribute('aria-label') || this.sfWord('close'),
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderCloseTemplate(this.templateContext());
  }

  focus(options) {
    const button = this.querySelector(':scope > button.sf-button-close');
    if (button) button.focus(options);
    return this;
  }
}

SfClose.define('sf-button-close');
