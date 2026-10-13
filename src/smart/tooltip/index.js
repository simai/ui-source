import SfBaseElement from '../../core/js/smart-base';
import { renderTooltipTemplate } from './js/templates/default';

class SfTooltip extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      // The axis is called appearance, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      appearance: {type: String, default: 'light', aliases: ['type']},
      size: { default: '1' },
      arrow: { default: 'none' },
      text: { default: '' },
      supportingText: { default: '' },
    };
  }

  templateContext() {
    return this.createTemplateContext({
      component: this,
      ...this.getPropsContext(),
    });
  }

  template() {
    return renderTooltipTemplate(this.templateContext());
  }
}

SfTooltip.define('sf-tooltip');
