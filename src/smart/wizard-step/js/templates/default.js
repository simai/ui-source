import {nothing} from 'lit';

// sf-wizard-step draws nothing of its own: its children are the step's body
// and stay where the page put them. sf-wizard reads the step's attributes and
// draws its title, its «why», its result and the footer around the body.
export function renderWizardStepTemplate() {
  return nothing;
}
