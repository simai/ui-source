// Reset fires before the browser restores default values. Synchronize afterwards
// without synthesizing input/change events or retaining detached controls.
//
// One capture listener per document, while a control is bound to it: the first
// binding adds it and the last release takes it away, so a removed instance
// leaves nothing on the document. It used to stay for the page's life, added
// by whichever instance bound first; when that was an instance placed after
// the page settled (a closed layer's field starting late), the instance scope
// gate read it as that instance's leak (gate 36, 2026-11-11). Every bundle
// carries its own copy of this module, so the listener and the subscriptions
// live on the document, shared by the copies: one listener, not one per bundle.
const REGISTRY = Symbol.for('sf.formReset');

function registryOf(doc) {
  let registry = doc[REGISTRY];
  if (!registry) {
    registry = {subscriptions: new WeakMap(), bound: 0, listener: null};
    Object.defineProperty(doc, REGISTRY, {value: registry, configurable: true});
  }
  return registry;
}

function listen(doc, registry) {
  registry.listener = (event) => {
    const form = event.target;
    if (form?.tagName !== 'FORM') return;
    const controls = Array.from(form.elements);
    setTimeout(() => {
      if (event.defaultPrevented) return;
      for (const control of controls) {
        if (!control.isConnected || control.form !== form) continue;
        for (const callback of registry.subscriptions.get(control) || []) callback();
      }
    }, 0);
  };
  doc.addEventListener('reset', registry.listener, true);
}

export function bindFormReset(input, synchronize) {
  const doc = input.ownerDocument;
  const registry = registryOf(doc);
  if (!registry.listener) listen(doc, registry);
  let callbacks = registry.subscriptions.get(input);
  if (!callbacks) registry.subscriptions.set(input, callbacks = new Set());
  callbacks.add(synchronize);
  registry.bound += 1;
  let released = false;
  return () => {
    if (released) return false;
    released = true;
    callbacks.delete(synchronize);
    registry.bound -= 1;
    if (registry.bound <= 0 && registry.listener) {
      doc.removeEventListener('reset', registry.listener, true);
      registry.listener = null;
      registry.bound = 0;
    }
    return true;
  };
}
