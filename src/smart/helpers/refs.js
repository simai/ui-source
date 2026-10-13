import { nothing } from 'lit';

function resolveRef(refOrName, component = null) {
  if (typeof refOrName === 'string') {
    return component?.refs?.[refOrName] || null;
  }

  return refOrName || null;
}

export function whenRef(callback, refOrName, component = null, options = {}) {
  const ref = resolveRef(refOrName, component);
  const owner = component || ref?.__sfOwner || null;

  if (!owner?.registerRefEffect || !ref) {
    return nothing;
  }

  owner.registerRefEffect(ref, callback, options);
  return nothing;
}
