import { bindFormReset } from '../../component/form-reset-helper';

// checked is the Smart component's live, reflected state. Keep the initial
// native reset default separate so rerenders do not turn it into the last value.
export function bindCheckableReset(component, input) {
  if (!Object.prototype.hasOwnProperty.call(component, '_resetChecked')) {
    component._resetChecked = !!component.checked;
  }
  const current = input.checked;
  input.defaultChecked = component._resetChecked;
  input.checked = current;
  return bindFormReset(input, () => {
    if (component.getInputElement() === input) component._handleChange();
  });
}
