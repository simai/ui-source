import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { noteDeprecated } from '../../core/js/deprecations';
import { renderTooltipTemplate } from './js/templates/default';
import { surfaceShortcut, writeTriggerKeyShortcuts } from '../../component/tooltip/js/_keyshortcuts';
import manifest from './component.json';
import aliases from './aliases.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).

// sf-tooltip from its component.json (standard simai.smart-component 1.3.8 §3,
// §4): appearance, size, arrow, text and supporting-text are attributes and
// properties made by core/js/element-manifest.js; the axis's old name `type` is
// a dated alias of appearance (aliases.json).
const TooltipElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
  source: 'ru',
  aliases,
});

class SfTooltip extends TooltipElement {
  static get props() {
    return {
      ...super.props,
      templateName: { attribute: 'template', default: 'default' },
      // The axis is called appearance, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json. dark, the
      // inverse surface, is the plain tooltip and the default (1.2.0).
      appearance: { type: String, default: 'dark', values: ['light', 'dark'], aliases: ['type'] },
    };
  }

  // One size for every tooltip (owner decision C160 (3)): size is a former
  // name that draws nothing until 2027-01-01; a size other than the plain
  // one is noted (SF.deprecations), and the sheet draws every size alike.
  templateContext() {
    const size = this.getAttribute('size');
    if (size !== null && size !== '1/3') {
      noteDeprecated({component: 'sf-tooltip', tag: 'sf-tooltip', kind: 'setting', attribute: 'size', from: 'size', to: null, since: '2026-11-14', remove_after: '2027-01-01'});
    }
    return this.createTemplateContext({
      component: this,
      ...this.getPropsContext(),
    });
  }

  template() {
    return renderTooltipTemplate(this.templateContext());
  }

  // The shortcut the tooltip shows is said on its trigger (KB-4):
  // aria-keyshortcuts on every [data-tooltip] naming this tooltip, written
  // again when the shortcut changes and taken back when it goes. The
  // tooltip controller writes it as it links a trigger, a later one too.
  afterRender(callback) {
    const result = super.afterRender(callback);
    if (typeof callback !== 'function' && this.id && this.isConnected) {
      const shortcut = surfaceShortcut(this);
      const escaped = globalThis.CSS?.escape ? CSS.escape(this.id) : this.id.replace(/"/g, '\\"');
      this.ownerDocument.querySelectorAll(`[data-tooltip="${escaped}"]`).forEach((trigger) => {
        writeTriggerKeyShortcuts(trigger, shortcut);
      });
    }
    return result;
  }
}

SfTooltip.define('sf-tooltip');
