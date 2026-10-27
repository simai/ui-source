import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderTooltipTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-tooltip from its component.json (standard simai.smart-component 1.3.8 §3,
// §4): appearance, size, arrow, text and supporting-text are attributes and
// properties made by core/js/element-manifest.js; the axis's old name `type` is
// a dated alias of appearance (aliases.json).
const TooltipElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfTooltip extends TooltipElement {
  static get props() {
    return {
      ...super.props,
      templateName: { attribute: 'template', default: 'default' },
      // The axis is called appearance, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      appearance: { type: String, default: 'light', values: ['light', 'dark'], aliases: ['type'] },
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
