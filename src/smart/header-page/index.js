// The head of an admin page: where the page is, what it is called, how many
// records it holds, whether it is a favourite, and its main action. The admin's
// top bar is gone (larena-specs frontend-interface-program, sf-admin-menu
// assignment, v5, section 6), so this is the only place a page says these
// things -- and it is a shared part because every admin page, Docara's
// included, says the same four.
//
// The host owns everything in it. The path, the start of the line on a phone
// and the actions are the host's own markup in slots; the heading, the count
// and whether the page is shared by every site are attributes. The star is the
// one control the header draws itself, and pressing it is a request the host
// answers: sf-page-header-toggle {on} is cancelable, and a host that wants to
// wait for its own answer cancels it and sets `star` when it knows.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// the settings are made by core/js/element-manifest.js, the words are the
// language files', and the old sf-page-header-star follows the toggle as a
// dated alias (aliases.json).
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {noteAuthored} from '../../core/js/density';
import {renderPageHeaderTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

const PageHeaderElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
});

// The header's slots. A child naming one of them is the page's content for it.
const HOST_SLOTS = new Set(['path', 'start', 'actions']);

class SfPageHeader extends PageHeaderElement {
  // The base takes the slot children once, when the element connects. A page
  // that adds an action later -- «Создать» once the list has loaded, a button
  // the person's rights allow -- appended it to the host, and it stood after
  // the drawn header, outside it (ui-doc «Рецепты», 2026-11-10). A child that
  // names a slot and arrives after the connection joins that slot, after the
  // ones it already holds, and the header draws again.
  onConnected() {
    super.onConnected?.();
    if (this._lateSlotObserver) return;
    this._lateSlotObserver = new MutationObserver(() => this.adoptLateSlotChildren());
    this._lateSlotObserver.observe(this, {childList: true});
    this.adoptLateSlotChildren();
  }

  onDisconnected() {
    this._lateSlotObserver?.disconnect();
    this._lateSlotObserver = null;
    super.onDisconnected?.();
  }

  adoptLateSlotChildren() {
    if (!this._slotTemplatesCaptured) return;
    const late = [...this.children].filter((child) => HOST_SLOTS.has(child.getAttribute('slot')) && child.localName !== 'template');
    if (!late.length) return;
    for (const child of late) {
      const name = child.getAttribute('slot');
      const nodes = this._liveSlotNodes.get(name) || [];
      nodes.push(child);
      this._liveSlotNodes.set(name, nodes);
      // The page's content: a size it gives stays explicit (density, C22).
      noteAuthored([child]);
      child.remove();
    }
    this.requestComponentUpdate('slot-change');
  }

  // star is optional (§4.2): absent draws no star, so it reads undefined
  // rather than the boolean's false.
  get star() {
    return this.hasAttribute('star') ? super.star : undefined;
  }

  set star(value) {
    if (value === undefined || value === null) this.removeAttribute('star');
    else this.setAttribute('star', value ? 'true' : 'false');
  }

  // The template's press: the request toggle {on}; not cancelled, the header
  // writes the star itself.
  toggleStar() {
    const on = this.star !== true;
    if (this.sfEmit('toggle', {on}, {cancelable: true})) this.star = on;
  }

  templateContext() {
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      heading: this.heading,
      count: this.count,
      level: this.level,
      star: this.star,
      rootClass: this.getRootClass(),
      text: (key) => this.sfWord(key),
      hostSlot: (name) => this.getSlotContent(name),
      hasHostSlot: (name) => this.hasSlotContent(name),
    });
  }

  template() {
    return renderPageHeaderTemplate(this.templateContext());
  }
}

SfPageHeader.define('sf-header-page');

export {SfPageHeader};
