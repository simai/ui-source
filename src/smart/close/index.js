import SfBaseElement from '../../core/js/smart-base';
import { renderCloseTemplate } from './js/templates/default';

class SfClose extends SfBaseElement {
  static get props() {
    return {
      size: {
        default: '1/3',
        values: ['1/4', '1/3', '1/2', '1', '2', '3', '4', '5', '6', '7'],
      },
      rootClass: { default: '' },
    };
  }

  get size() {
    return this.getProp('size');
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
    return renderCloseTemplate(this.templateContext());
  }
}

SfClose.define('sf-close');
