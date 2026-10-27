// The form-control half of a field built from its component.json (standard
// simai.smart-component 1.3.8 §17.1, §17.2), shared by the field family.
//
// core/js/element-manifest.js makes the host form-associated and gives it
// ElementInternals, sfFormValue() and sfSyncForm(). What a field adds is the
// same in every member, so it is written once here:
//
// - validity (§17.2): the host reports what its inner native control knows
//   (value-missing, too-short, pattern-mismatch, ...) with the control as the
//   anchor, so reportValidity() points at the box the person types in; a
//   custom error set with setCustomValidity() or the action set-error wins
//   until it is cleared;
// - the inner controls stay out of the page's form (§17.1 item 6): they carry
//   no name while the host is the form control;
// - form reset and fieldset[disabled] (§17.1 items 3, 4): the host syncs its
//   form value and validity after the browser has reset its parts.
//
// Without ElementInternals nothing here runs, and the named inner control
// submits as it always did.

// ValidityState's own flags, in the order of §17.2's list.
export const VALIDITY_FLAGS = Object.freeze([
  'valueMissing', 'typeMismatch', 'patternMismatch', 'tooShort', 'tooLong',
  'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput',
]);

/** The name an inner native control carries: none while the host submits (§17.1 item 6). */
export function innerControlName(component, name) {
  return component?.sfInternals ? '' : String(name || '');
}

/**
 * The host's validity from its inner control: the control's failed flags and
 * message, or the custom error the page set, or valid. `own` adds flags the
 * component reads itself, {flag: message} (a number field's range and step,
 * which its text box cannot know).
 */
export function syncFieldValidity(component, control, own = {}) {
  const internals = component?.sfInternals;
  if (!internals) return;
  try {
    const custom = component.sfCustomError || '';
    if (custom) {
      internals.setValidity({customError: true}, custom, control || undefined);
      return;
    }
    const validity = control?.validity;
    const flags = {};
    let message = '';
    if (validity && !validity.valid && control.willValidate !== false) {
      for (const flag of VALIDITY_FLAGS) if (validity[flag]) flags[flag] = true;
      message = control.validationMessage;
    }
    for (const [flag, text] of Object.entries(own || {})) {
      flags[flag] = true;
      message ||= String(text || '');
    }
    if (Object.keys(flags).length) internals.setValidity(flags, message || ' ', control || undefined);
    else internals.setValidity({});
  } catch (error) {
    component.reportComponentError?.(error, 'validity');
  }
}

/**
 * The field family's form plumbing over a manifest element. A component
 * names the control its validity comes from with `sfValidityAnchor()`
 * (default: getInputElement()).
 */
export const FormField = (Base) => class extends Base {
  constructor() {
    super();
    // A person's edit reaches the host as input/change; the form value and
    // validity follow it without a redraw.
    this.__sfFormSync = () => this.sfSyncFormState();
    this.addEventListener('input', this.__sfFormSync);
    this.addEventListener('change', this.__sfFormSync);
  }

  sfValidityAnchor() {
    return this.getInputElement?.() || null;
  }

  /** The form value and the validity, now. */
  sfSyncFormState() {
    this.sfSyncForm?.();
    syncFieldValidity(this, this.sfValidityAnchor());
  }

  setCustomValidity(message = '') {
    this.sfCustomError = String(message ?? '');
    syncFieldValidity(this, this.sfValidityAnchor());
  }

  // The browser resets the parts after it calls this: the sync waits for them,
  // and once more for the parts that put their own default back a task later
  // (component/form-reset-helper.js: masks, the checkables' attributes).
  formResetCallback() {
    Promise.resolve().then(() => this.sfSyncFormState());
    setTimeout(() => this.sfSyncFormState(), 0);
  }
};
