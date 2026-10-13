// SF.Mask belongs to Core. A page may run a field's script before Core --
// SF_PRELOADED allows it, and Docara loads every page and example frame that
// way (smart-base, the component scripts, then core.js) -- and a field that
// found no SF.Mask at bind time gave up on its mask for good: the root was
// bound and the input stayed unmasked. The fields ask for the service here
// instead; it is there at once on an ordinary page, and otherwise arrives
// with Core's sf-mask-ready (or is found at the Loader's ready or the window's
// load, for a Core that predates the event). One promise per bundle.
let pending = null;

export function maskService() {
  const current = () => (window.SF?.Mask?.create ? window.SF.Mask : null);
  const service = current();
  if (service) return Promise.resolve(service);
  if (pending) return pending;
  pending = new Promise((resolve) => {
    const events = [
      [window, 'sf-mask-ready'],
      [window, 'sf-loader-ready'],
      [window, 'load'],
      [document, 'DOMContentLoaded'],
    ];
    const check = () => {
      const found = current();
      if (!found) return;
      events.forEach(([target, type]) => target.removeEventListener(type, check));
      pending = null;
      resolve(found);
    };
    events.forEach(([target, type]) => target.addEventListener(type, check));
  });
  return pending;
}
