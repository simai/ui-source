/* global __webpack_public_path__: writable */

(() => {
  const cdnDefault = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/';
  if (typeof window === 'undefined') return;
  // The script that is running is Core itself: its URL names the distr/ it
  // came from. document.currentScript holds it while Core evaluates; failing
  // that (a module, a deferred evaluation), the last <script> whose path ends
  // in core/js/core.js or core/js/core.min.js stands in.
  const corePath = /\/core\/js\/core(?:\.min)?\.js$/u;
  const isCoreScript = (script) => {
    if (!script?.src) return false;
    try {
      return corePath.test(new URL(script.src, document.baseURI).pathname);
    } catch {
      return false;
    }
  };
  const findCoreScript = () => {
    if (typeof document === 'undefined') return null;
    if (isCoreScript(document.currentScript)) return document.currentScript;
    return Array.from(document.scripts || []).reverse().find(isCoreScript) || null;
  };
  const ownScript = findCoreScript();

  // A page that never set sfPath loads the rest of the runtime from where Core
  // itself came from: an npm-loaded core.js finds its siblings in the same
  // package version, a self-hosted one in the same copy.
  if (!window.sfPath && ownScript) {
    try {
      window.sfPath = new URL('../../', new URL(ownScript.src, document.baseURI)).href;
    } catch {
      /* An unreadable script URL leaves the fallback below to speak. */
    }
  }
  // Without a Core script to read, the fallback is an unpinned branch: the
  // project then serves whatever sits on main today instead of the build it
  // shipped, and nothing on screen says so. The fallback stays — a page with no
  // configuration still has to run — but it says out loud what it just did and
  // what to write instead.
  if (!window.sfPath) {
    window.sfPath = cdnDefault;
    try {
      console.warn(
        'SIMAI Framework: window.sfPath is not set and Core could not tell where '
        + `it was loaded from, so the runtime is loading from ${cdnDefault} — an `
        + 'unpinned branch that changes without notice. Set window.sfPath, before '
        + 'core.js, to your own copy of distr/ or to a released package: '
        + 'https://cdn.jsdelivr.net/npm/@simai-studio/ui@<version>/distr/ .',
      );
    } catch {
      /* A console is not something a runtime may insist on. */
    }
  }

  // A relative sfPath is resolved against the document's base, not against the
  // window's location. Inside a srcdoc frame — which is how documentation
  // renders its live examples — location.href is `about:srcdoc`, an opaque base
  // that cannot resolve a relative reference at all, and the whole runtime used
  // to die here before a single component registered. document.baseURI is a
  // real absolute URL there, and it honours a <base> tag, which is what a
  // relative path is supposed to follow anyway.
  const documentBase = typeof document === 'undefined' ? '' : document.baseURI;
  const resolveRoot = (base) => {
    try {
      return new URL(window.sfPath, base || undefined);
    } catch {
      return null;
    }
  };
  const frameworkRoot = resolveRoot(documentBase)
    || resolveRoot(window.location?.href)
    || new URL(cdnDefault);
  if (!frameworkRoot.pathname.endsWith('/')) {
    frameworkRoot.pathname += '/';
  }

  const configuredCoreRoot = frameworkRoot.pathname.endsWith('/core/')
    ? frameworkRoot
    : new URL('core/', frameworkRoot);
  const coreScript = ownScript;
  const coreRoot = coreScript
    ? new URL('../', new URL(coreScript.src, document.baseURI))
    : configuredCoreRoot;

  if (__webpack_public_path__ !== coreRoot.href) {
    __webpack_public_path__ = coreRoot.href;
  }
})();
