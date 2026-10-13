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
// one control the header draws itself, and pressing it is an intent the host
// answers: `sf-page-header-star` is cancelable, and a host that wants to wait
// for its own answer cancels it and sets `star` when it knows.
import SfBaseElement from '../../core/js/smart-base';
import {pageText} from '../../core/js/page-language';
import {renderPageHeaderTemplate} from './js/templates/default';

export const PAGE_HEADER_TEXT = {
  en: {
    star: 'Add to favourites',
    unstar: 'Remove from favourites',
    allSites: 'for all sites',
  },
  ru: {
    star: 'В избранное',
    unstar: 'Убрать из избранного',
    allSites: 'для всех сайтов',
  },
};

class SfPageHeader extends SfBaseElement {
  static get props() {
    return {
      heading: {default: ''},
      count: {default: ''},
      // A page that belongs to the install rather than to one site says so
      // beside its heading, the same mark the menu puts under the install root.
      level: {default: 'site', values: ['site', 'install']},
      // '' draws no star; 'off' and 'on' draw it in that state.
      star: {default: '', values: ['', 'off', 'on']},
      rootClass: {attribute: 'root-class', default: ''},
    };
  }

  text(key) {
    return pageText(PAGE_HEADER_TEXT, key, this, 'sf-page-header');
  }

  toggleStar() {
    const on = this.getProp('star') !== 'on';
    const event = new CustomEvent('sf-page-header-star', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: {on},
    });
    if (this.dispatchEvent(event)) this.setAttribute('star', on ? 'on' : 'off');
  }

  templateContext() {
    const props = this.getPropsContext();
    return this.createTemplateContext({
      ...props,
      component: this,
      heading: this.getProp('heading'),
      count: this.getProp('count'),
      level: this.getProp('level'),
      star: this.getProp('star'),
      rootClass: this.getRootClass(),
      text: (key) => this.text(key),
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
