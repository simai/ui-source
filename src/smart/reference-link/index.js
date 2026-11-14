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

  // An absent attribute is the default icon; an empty one is no icon at all.
  // Read as `|| default` the two were the same answer, so a reference drawn
  // beside its own label could not drop the arrow it does not need.
  // An absent icon is the arrow in a card, a size or on a line; a reference
  // in text (appearance inline) has no arrow unless one is named -- a link
  // in a sentence is told by its colour and line, the icon there says the
  // record's type (C147 (1), (2)).
  get icon() {
    const icon = this.getAttribute('icon');
    if (icon === null) return this.getAttribute('appearance') === 'inline' ? '' : 'arrow_forward';
    return icon;
  }

  set icon(value) {
    super.icon = value;
  }

  // What the copy button copies (C147 (8)): the address in full, as the
  // browser's own «copy link address» gives it, not the href as written.
  get copyValue() {
    const href = this.getAttribute('href') || '';
    if (!href) return '';
    try {
      return new URL(href, this.ownerDocument?.baseURI || globalThis.location?.href).href;
    } catch {
      return href;
    }
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
      state: this.state,
      copy: this.copy,
      copyValue: this.copyValue,
      words: {
        // Said after the name (C147 (4)), as sf-file-download says it (C25).
        newTab: this.sfWord('new-tab-text'),
        copy: this.sfWord('copy-label'),
        missing: this.sfWord('missing-text'),
        forbidden: this.sfWord('forbidden-text'),
      },
      ariaLabel: this.getAttribute('aria-label') || '',
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderReferenceLinkTemplate(this.templateContext());
  }

  afterRender(callback) {
    if (typeof callback === 'function') return super.afterRender(callback);
    this.markCutName();
    this.observeRoom();
    return undefined;
  }

  disconnectedCallback() {
    this._roomObserver?.disconnect();
    this._roomObserver = null;
    this._roomRoot = null;
    super.disconnectedCallback();
  }

  // A long name (C147 (9)): a card shows two lines, a sized reference or one
  // on a line (a table cell, a field) one; past that an ellipsis. A name cut
  // that way has its whole text in the Framework tooltip on hover and
  // keyboard focus (as the breadcrumbs, C93 (6)), through the tooltip
  // component's controller (data-tooltip). Text that wraps in a sentence is
  // never cut, so an inline reference has none.
  markCutName() {
    const root = this.querySelector(':scope > .sf-reference-link');
    const link = root && !root.classList.contains('sf-reference-link--inline')
      ? root.querySelector('a.sf-reference-link__link')
      : null;
    const label = link?.querySelector('.sf-reference-link__label');
    const cut = Boolean(link && label)
      && (link.scrollWidth > link.clientWidth + 1 || link.scrollHeight > link.clientHeight + 1);
    let surface = this._cutTooltip;
    if (!cut) {
      if (surface) {
        if (this._cutLink?.getAttribute('data-tooltip') === surface.id) this._cutLink.removeAttribute('data-tooltip');
        surface.remove();
        this._cutTooltip = null;
        this._cutLink = null;
      }
      return;
    }
    const doc = this.ownerDocument;
    const words = label.textContent.replace(/\s+/gu, ' ').trim();
    if (!surface) {
      // The Framework's plain tooltip in class markup, as the clipboard
      // component writes it for an icon button's name.
      surface = doc.createElement('span');
      surface.className = 'sf-tooltip sf-tooltip--dark sf-tooltip--size-1/3 sf-reference-link__name-tooltip flex';
      surface.hidden = true;
      const content = doc.createElement('span');
      // A name is long by definition: the plate is a block (the utility
      // hint of the tooltip sheet), so a second line keeps its fill.
      content.className = 'sf-tooltip-content flex flex-col items-start';
      const text = doc.createElement('span');
      text.className = 'sf-tooltip-text';
      content.append(text);
      surface.append(content);
      const base = `${this.id ? `page/${this.id}` : 'sf-reference-link'}/name`;
      let id = base.replace(/[^\w:./-]/gu, '-');
      for (let index = 2; doc.getElementById(id); index++) id = `${base}-${index}`;
      surface.id = id;
      this._cutTooltip = surface;
    }
    surface.querySelector('.sf-tooltip-text').textContent = words;
    if (!surface.isConnected) this.append(surface);
    if (this._cutLink && this._cutLink !== link) this._cutLink.removeAttribute('data-tooltip');
    this._cutLink = link;
    if (link.getAttribute('data-tooltip') !== surface.id) link.setAttribute('data-tooltip', surface.id);
  }

  // The host is display: contents, so the box watched is the root it draws.
  observeRoom() {
    const root = this.querySelector(':scope > .sf-reference-link');
    if (typeof ResizeObserver === 'undefined' || !root || root === this._roomRoot) return;
    this._roomObserver?.disconnect();
    this._roomRoot = root;
    this._roomObserver = new ResizeObserver(() => {
      if (this._roomFrame) return;
      this._roomFrame = requestAnimationFrame(() => {
        this._roomFrame = 0;
        this.markCutName();
      });
    });
    this._roomObserver.observe(root);
  }

  handleRootClick = (event) => {
    if (!this.disabled) {
      this.followFromRoute(event);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
  };

  // The route stands above the link's overlay so it can be selected (RL-11).
  // A press on it still follows the link, unless the reader has just selected
  // text: then the press was a selection, not a choice.
  followFromRoute(event) {
    const route = event.target?.closest?.('.sf-reference-link__meta');
    const link = route?.closest('.sf-reference-link')?.querySelector('.sf-reference-link__link');
    if (!route || !link || event.defaultPrevented) {
      return;
    }

    const selection = globalThis.getSelection?.();
    if (selection && !selection.isCollapsed && String(selection).trim()) {
      return;
    }

    // One click reaches the page: the link's, as if the press had been on it.
    event.preventDefault();
    event.stopPropagation();
    link.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: globalThis,
      button: event.button,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    }));
  }

  onClick(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('click', handler, options);
    }

    return this;
  }
}

SfReferenceLink.define('sf-reference-link');
