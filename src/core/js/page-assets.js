// The assets a swapped part of the page brings, asked for once for the life
// of the page (simai.interface-fragment, assets-once). Region navigation and
// block refresh share one registry, and it lives on the shared global
// SF.__assets, not in this module: every bundle carries its own copy of a
// module, so a registry held in module scope would not be shared at runtime.

// The wait before a skeleton is drawn: an answer that comes sooner shows none.
export const SKELETON_DELAY_MS = 150;

const absolute = (href) => {
  try {
    return new URL(href, globalThis.location.href).href;
  } catch {
    return null;
  }
};

function registry() {
  const sf = (globalThis.SF = globalThis.SF || {});
  if (!(sf.__assets instanceof Map)) {
    Object.defineProperty(sf, '__assets', {value: new Map(), configurable: true});
  }
  return sf.__assets;
}

function isPresent(url, kind) {
  const document = globalThis.document;
  const nodes = kind === 'css'
    ? document.querySelectorAll('link[rel~="stylesheet"][href]')
    : document.querySelectorAll('script[src]');
  return [...nodes].some((node) => absolute(node.getAttribute(kind === 'css' ? 'href' : 'src')) === url);
}

// One request per asset: a second part that needs the same file waits on the
// first request, it does not make another.
export function loadAsset({href, kind, key}) {
  const url = absolute(href);
  if (!url || !['css', 'javascript'].includes(kind)) return Promise.resolve();
  const requests = registry();
  if (requests.has(url)) return requests.get(url);
  if (isPresent(url, kind)) {
    requests.set(url, Promise.resolve());
    return requests.get(url);
  }
  const document = globalThis.document;
  const node = document.createElement(kind === 'css' ? 'link' : 'script');
  if (kind === 'css') {
    node.rel = 'stylesheet';
    node.href = url;
  } else {
    node.src = url;
    node.async = false;
  }
  if (key) node.setAttribute('data-sf-asset', key);
  const loaded = new Promise((resolve) => {
    node.addEventListener('load', () => resolve(), {once: true});
    // A file that does not come is the part's loss, not the page's: the part
    // is shown, and the component that needed it reports its own state.
    node.addEventListener('error', () => resolve(), {once: true});
  });
  document.head.append(node);
  requests.set(url, loaded);
  return loaded;
}

// A script element the browser would run. A data island
// (<script type="application/json" data-sf-fragment-data>) is not one: it is
// the block's first data and stays in the markup.
const RUNNABLE = /^(?:|module|text\/javascript|application\/javascript|text\/ecmascript|application\/ecmascript)$/iu;
export const isRunnableScript = (script) => RUNNABLE.test((script.getAttribute('type') ?? '').trim());

// Before a swap takes the old markup away: every asset the new markup names
// that is on the page now is recorded as loaded, so the <script src> or
// <link> that leaves with the old markup is not asked for again.
export function noteAssets(assets) {
  const requests = registry();
  for (const {href, kind} of assets) {
    const url = absolute(href);
    if (url && !requests.has(url) && isPresent(url, kind)) requests.set(url, Promise.resolve());
  }
}

// Markup parsed but not yet placed: its stylesheets and scripts are taken out
// and returned as assets (a script set by innerHTML never runs).
export function parseMarkup(html) {
  const template = globalThis.document.createElement('template');
  template.innerHTML = String(html ?? '');
  const assets = [];
  for (const link of template.content.querySelectorAll('link[rel~="stylesheet"][href]')) {
    assets.push({href: link.getAttribute('href'), kind: 'css'});
    link.remove();
  }
  for (const script of template.content.querySelectorAll('script')) {
    if (!isRunnableScript(script)) continue;
    if (script.getAttribute('src')) assets.push({href: script.getAttribute('src'), kind: 'javascript'});
    script.remove();
  }
  return {content: template.content, assets};
}
