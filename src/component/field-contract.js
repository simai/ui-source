import {instancePath, partId, pathIsSettled} from '../core/js/instance-path.js';

// A field's ids come from its instance's role path (standard 1.3.8 §7.1.1;
// simai/ui-source#41), never from a counter: core/js/instance-path.js.
const fieldIdentities = new WeakMap();

// The bases the page's fields hold, on a page-wide table (SF.__fieldIds):
// every bundle that carries this file has its own module copy, so a table
// here would be one per bundle. An id is kept per instance, and a path in
// document order is read when the instance first settles, so an instance
// that settles later in front of it reads the same index: sf-mail-library's
// and sf-mail-letters' search fields were both sf-input-1--control (Mail set
// 1.0.0, GB20). A base another connected instance holds, or that an element
// outside this instance already carries, takes the next free «-<n>».
function claimedBases() {
  const sf = (globalThis.SF ||= {});
  if (!(sf.__fieldIds instanceof Map)) {
    Object.defineProperty(sf, '__fieldIds', {value: new Map(), configurable: true});
  }
  return sf.__fieldIds;
}

function heldElsewhere(owner, base, claims) {
  const holder = claims.get(base)?.deref?.();
  if (holder && holder !== owner && holder.isConnected && holder.ownerDocument === owner.ownerDocument) return true;
  const taken = owner?.ownerDocument?.getElementById?.(`${base}--control`);
  return Boolean(taken && taken !== owner && !owner.contains?.(taken));
}

function freeBase(owner, path) {
  const base = partId(path);
  if (!pathIsSettled(owner) || typeof globalThis.WeakRef !== 'function') return base;
  const claims = claimedBases();
  let free = base;
  for (let n = 2; heldElsewhere(owner, free, claims); n += 1) free = `${base}-${n}`;
  claims.set(free, new globalThis.WeakRef(owner));
  return free;
}

function nextIdentity(owner, prefix) {
  if (owner && fieldIdentities.has(owner)) return fieldIdentities.get(owner);

  const base = freeBase(owner, instancePath(owner, {kind: prefix}));
  const identity = {
    base,
    controlId: `${base}--control`,
    messageId: `${base}--message`,
  };

  // An instance not yet in the page has no place in it: its path is settled
  // when it is, so it is not kept before.
  if (owner && (typeof owner === 'object' || typeof owner === 'function') && pathIsSettled(owner)) {
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
  // A root that is not a label carries its label text as a <label> of its
  // own (div.sf-input, 1.13.0): it points at the control too.
  if (labelNode?.tagName === 'LABEL' && !labelNode.hasAttribute('for')) {
    labelNode.setAttribute('for', control.id);
  }
  // Name the field by its visible label, not every hint or adjacent button.
  // Author-provided accessible names remain authoritative.
  if (labelNode?.textContent?.trim()
    && !control.hasAttribute('aria-label')
    && !control.hasAttribute('aria-labelledby')) {
    // An id of its own: «<control>-label» may already name another element
    // (a page that gave the field's root that id), and aria-labelledby would
    // then read that element's whole text, the hint with it (DF-3).
    if (!labelNode.id) {
      const doc = labelNode.ownerDocument;
      let id = `${control.id}-label`;
      for (let n = 2; doc?.getElementById?.(id); n += 1) id = `${control.id}-label-${n}`;
      labelNode.id = id;
    }
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
