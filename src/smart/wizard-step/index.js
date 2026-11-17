// sf-wizard-step: one step of sf-wizard (owner decision 2026-11-06). Its
// attributes say what the step is -- name, label, heading, description,
// type, optional, href, action-text, message -- and its state value where it
// stands; its children are the body:
//
//   <sf-wizard-step name="address" label="Адрес панели" type="form"
//     description="По этому адресу вы будете открывать панель.">
//     <form>…Framework fields…</form>
//   </sf-wizard-step>
//
// It draws nothing: the children stay live where the page put them, and the
// wizard draws the title, the «why», the indicator, the result and the footer
// around them. A change of an attribute is told to the wizard that holds the
// step, which draws it at once.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {renderWizardStepTemplate} from './js/templates/default';
import manifest from './component.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).

// The attributes the wizard reads; a change of one is the wizard's to draw.
export const STEP_ATTRIBUTES = ['name', 'label', 'heading', 'description', 'type', 'optional', 'href', 'action-text', 'message', 'state'];

const WizardStepElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
  source: 'ru',
});

class SfWizardStep extends WizardStepElement {
  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (oldValue === newValue || !STEP_ATTRIBUTES.includes(name)) return;
    // The wizard that placed the step (it may stand in a window's portal, out
    // of the wizard's own tree), else the one around it.
    const wizard = this.sfWizard ?? this.closest('sf-wizard');
    wizard?.stepChanged?.(this, name);
  }

  template() {
    return renderWizardStepTemplate(this.templateContext());
  }
}

SfWizardStep.define('sf-wizard-step');

export {SfWizardStep};
