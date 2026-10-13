let fieldSequence = 0;
const fieldIdentities = new WeakMap();

function nextIdentity(owner, prefix) {
  if (owner && fieldIdentities.has(owner)) return fieldIdentities.get(owner);

  const explicit = owner?.id ? String(owner.id).trim() : '';
  const base = explicit || `${prefix}-${++fieldSequence}`;
  const identity = {
    controlId: `${base}-control`,
    messageId: `${base}-message`,
  };

  if (owner && (typeof owner === 'object' || typeof owner === 'function')) {
    fieldIdentities.set(owner, identity);
  }

  return identity;
}

function mergeIdRefs(existing, additions) {
  return [...new Set([
    ...String(existing || '').split(/\s+/).filter(Boolean),
    ...additions.filter(Boolean),
  ])].join(' ');
}

export function createFieldContract(owner, {
  prefix = 'sf-field',
  required = false,
  invalid = false,
  hint = '',
  errorMessage = '',
} = {}) {
  const identity = nextIdentity(owner, prefix);
  const normalizedInvalid = Boolean(invalid);
  const message = normalizedInvalid && errorMessage ? errorMessage : hint;

  return {
    ...identity,
    required: Boolean(required),
    invalid: normalizedInvalid,
    message,
    describedBy: message ? identity.messageId : '',
    errorMessageId: normalizedInvalid && errorMessage ? identity.messageId : '',
  };
}

export function syncFieldContract(root, control, {
  prefix = 'sf-field',
  required = false,
  invalid = false,
  messageNode = null,
  labelNode = null,
  errorMessage = '',
} = {}) {
  if (!root || !control) return null;

  const hint = messageNode?.textContent?.trim() || '';
  const contract = createFieldContract(root, {
    prefix,
    required,
    invalid,
    hint,
    errorMessage,
  });

  if (!control.id) control.id = contract.controlId;
  if (root.tagName === 'LABEL' && !root.hasAttribute('for')) {
    root.setAttribute('for', control.id);
  }
  // Name the field by its visible label, not every hint or adjacent button.
  // Author-provided accessible names remain authoritative.
  if (labelNode?.textContent?.trim()
    && !control.hasAttribute('aria-label')
    && !control.hasAttribute('aria-labelledby')) {
    if (!labelNode.id) labelNode.id = `${control.id}-label`;
    control.setAttribute('aria-labelledby', labelNode.id);
  }
  control.required = contract.required;
  root.classList.toggle('error', contract.invalid);
  control.classList.toggle('error', contract.invalid);

  if (contract.invalid) control.setAttribute('aria-invalid', 'true');
  else control.removeAttribute('aria-invalid');

  if (messageNode) {
    if (!messageNode.id) messageNode.id = contract.messageId;
    control.setAttribute(
      'aria-describedby',
      mergeIdRefs(control.getAttribute('aria-describedby'), [messageNode.id]),
    );
  }

  if (contract.errorMessageId && messageNode) {
    control.setAttribute('aria-errormessage', messageNode.id);
  } else {
    control.removeAttribute('aria-errormessage');
  }

  return contract;
}
