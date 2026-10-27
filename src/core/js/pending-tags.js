// Undefined Smart elements, kept invisible until their code arrives
// (standard simai.smart-component 1.3.8 §5.4; simai/ui-source#39).
//
// Core used to set the body's opacity to 0 until sf-loader-ready, so whatever
// the server had printed -- class markup, text, the static markup of a Smart
// element, the core skeleton shapes -- was never seen before the Loader was
// done: on a slow line a composed skeleton that was in at 2 s stayed invisible
// until 4.8 s (stand 22). The page is never hidden now. What is hidden is an
// element whose code is coming and that has nothing to show in the meantime:
// an undefined element of a tag held here, with no static child
// (`data-sf-static`) and no core skeleton shape on the host (`data-sf-skeleton`).
// `visibility` keeps its box, so nothing moves when it is defined.
//
// One stylesheet, one rule per held tag. A tag is held by Core while the page
// is parsed (every undefined sf- element it meets) and by the Loader when it
// asks for the tag's module; it is let go when the tag is defined, and in any
// case after a timeout, so a module that fails to load leaves its elements
// shown as they are rather than hidden for ever. A hold the Loader asked for
// says so on the console when it times out.
//
// Every bundle carries a copy of this module; the first one puts the store on
// the shared global, and the rest find it there.

export const PENDING_TAGS_ID = 'sf-pending-tags';
export const PENDING_TAG_TIMEOUT_MS = 10000;

const TAG_NAME = /^[a-z][a-z0-9]*-[a-z0-9._-]*$/u;

// :has() in a browser without it drops the rule, and the element is shown:
// the failure is towards showing, never towards hiding.
export function pendingTagRule(tag) {
  return `${tag}:not(:defined):not([data-sf-skeleton]):not(:has(> [data-sf-static])){visibility:hidden}`;
}

export function installPendingTags(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return undefined;
  win.SF = win.SF || {};
  const SF = win.SF;
  // SF.__internal is read-only (internal.js); made the same way where that
  // has not run yet.
  if (!SF.__internal || typeof SF.__internal !== 'object') {
    Object.defineProperty(SF, '__internal', {value: {}, configurable: true, enumerable: false, writable: false});
  }
  const internal = SF.__internal;
  if (internal.pendingTags) return internal.pendingTags;

  const doc = win.document;
  const registry = win.customElements;
  // tag -> {timer, asked}
  const held = new Map();
  let sheet = null;

  const write = () => {
    if (!doc) return;
    if (!held.size) {
      sheet?.remove();
      sheet = null;
      return;
    }
    if (!sheet) {
      sheet = doc.createElement('style');
      sheet.id = PENDING_TAGS_ID;
      sheet.setAttribute('data-sf-observer', 'ignore');
      (doc.head || doc.documentElement).append(sheet);
    }
    sheet.textContent = [...held.keys()].map(pendingTagRule).join('\n');
  };

  const release = (tag) => {
    const entry = held.get(tag);
    if (!entry) return false;
    clearTimeout(entry.timer);
    held.delete(tag);
    write();
    return true;
  };

  const expire = (tag, timeout) => {
    const entry = held.get(tag);
    if (!entry) return;
    release(tag);
    if (entry.asked && !registry?.get(tag)) {
      console.warn(`SF: <${tag}> was not defined within ${timeout} ms; its elements are shown as they are`);
    }
  };

  // asked: the Loader has asked for the tag's module. Its timer starts again
  // then, so a tag Core held while the page was parsed has the whole timeout
  // for its module, not what was left of it.
  const hold = (name, {asked = false, timeout = PENDING_TAG_TIMEOUT_MS} = {}) => {
    const tag = String(name || '').trim().toLowerCase();
    if (!TAG_NAME.test(tag) || registry?.get(tag)) return false;
    const entry = held.get(tag);
    if (entry && (!asked || entry.asked)) return true;
    if (entry) clearTimeout(entry.timer);
    held.set(tag, {
      asked: asked || Boolean(entry?.asked),
      timer: setTimeout(() => expire(tag, timeout), timeout),
    });
    if (!entry) {
      write();
      registry?.whenDefined?.(tag).then(() => release(tag));
    }
    return true;
  };

  // The holds nobody asked a module for: tags no rule claims, or elements the
  // Loader leaves for later (inside a closed container). Let go once the
  // Loader is ready; the Loader holds them again when it asks.
  const releaseUnasked = () => {
    [...held].filter(([, entry]) => !entry.asked).forEach(([tag]) => release(tag));
  };

  const api = {
    hold,
    release,
    releaseUnasked,
    isHeld: (tag) => held.has(String(tag || '').toLowerCase()),
    held: () => [...held.keys()],
  };
  internal.pendingTags = api;
  return api;
}

// Core's part: every undefined sf- element met while the page is parsed is
// held, from the first element on, so nothing that waits for its code shows
// its raw children before the Loader has even read the page. Stops at
// sf-loader-ready; from then on the Loader holds what it asks for.
export function holdUndefinedElements(win = typeof window !== 'undefined' ? window : undefined) {
  const doc = win?.document;
  const pending = win?.SF?.__internal?.pendingTags;
  if (!doc?.documentElement || !pending || typeof win.MutationObserver !== 'function') {
    return null;
  }
  const holdIn = (root) => {
    if (root.nodeType !== 1) return;
    if (root.localName.startsWith('sf-')) pending.hold(root.localName);
    root.querySelectorAll(':not(:defined)').forEach((el) => {
      if (el.localName.startsWith('sf-')) pending.hold(el.localName);
    });
  };
  holdIn(doc.documentElement);
  const observer = new win.MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach(holdIn));
  });
  observer.observe(doc.documentElement, {childList: true, subtree: true});
  win.addEventListener('sf-loader-ready', () => {
    observer.disconnect();
    pending.releaseUnasked();
  }, {once: true});
  return observer;
}
