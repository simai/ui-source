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

class SfPageHeader extends PageHeaderElement {
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

SfPageHeader.define('sf-page-header');

export {SfPageHeader};
