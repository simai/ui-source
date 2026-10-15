// Region navigation (simai.interface-fragment 1.0.0, region-navigation and
// full-load-fallback; Larena handoff 2026-10-15). A link inside the shell
// changes one region of the page instead of the page: the shell (a menu, a
// profile) stays, and only the content is asked for, swapped and announced.
//
// The product names its own contract when it turns this on; nothing here is a
// product's name:
//
//   SF.RegionNavigation.enable({
//     region: 'content',                       // the region asked for
//     root: '#larena-admin-content',           // where it stands on the page
//     header: 'X-Larena-Region',               // the request header that asks for it
//     revisionMeta: 'larena-shell-revision',   // <meta name> holding the shell's revision
//     scope: '/admin',                         // only addresses under this path
//   });
//
// The answer the host gives is JSON: {region, html, title, assets: [{key,
// href, kind: 'css' | 'javascript'}], shell_revision, url}. Anything else --
// another status, a redirect, HTML, another region, a shell revision that is
// not the page's own, a failure -- and the page is loaded in full instead. A
// half-swapped page is never left on screen.
//
// What is kept true: Back and Forward work and bring the scroll back; focus
// goes to the new heading; an asset already on the page is not asked for
// again, whether it came in `assets` or as a <link>/<script src> in the html;
// the elements that leave are disconnected, so their routes and listeners go
// with them.

const SKELETON_DELAY_MS = 150;
const TIMEOUT_MS = 15000;

let config = null;
let controller = null;
let sequence = 0;
const assetRequests = new Map();

const absolute = (href) => {
  try {
    return new URL(href, globalThis.location.href).href;
  } catch {
    return null;
  }
};

function rootElement() {
  if (!config) return null;
  return typeof config.root === 'string' ? globalThis.document.querySelector(config.root) : config.root;
}

function shellRevision() {
  return globalThis.document.querySelector(`meta[name="${config.revisionMeta}"]`)?.getAttribute('content') ?? null;
}

// A link this navigator may take: a plain left click on an address of this
// site, under the scope, not a download, not another window, not a jump on
// the same page, and not marked for a full load.
function takenLink(event) {
  if (!config || event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = event.composedPath().find((node) => node instanceof globalThis.Element && node.matches('a[href]'));
  if (!link) return null;
  if (link.closest('[data-full-load]') || link.hasAttribute('download')) return null;
  const target = link.getAttribute('target');
  if (target && target !== '_self') return null;
  const url = new URL(link.href, globalThis.location.href);
  const here = new URL(globalThis.location.href);
  if (url.origin !== here.origin) return null;
  if (!url.pathname.startsWith(config.scope)) return null;
  if (url.hash && url.pathname === here.pathname && url.search === here.search) return null;
  return url.href;
}

function onClick(event) {
  const url = takenLink(event);
  if (!url) return;
  event.preventDefault();
  navigate(url);
}

function onPopState(event) {
  const state = event.state;
  if (!config || !state?.sfRegion) return;
  navigate(globalThis.location.href, {history: 'none', scroll: state.scroll ?? 0});
}

// The scroll of the entry being left, so Back brings it back.
function rememberScroll() {
  const state = globalThis.history.state ?? {};
  globalThis.history.replaceState({...state, sfRegion: true, scroll: globalThis.scrollY}, '');
}

function fullLoad(url, reason) {
  globalThis.document.dispatchEvent(new CustomEvent('sf-region-fallback', {detail: {url, reason}}));
  if (config?.onFullLoad) {
    config.onFullLoad(url, reason);
    return;
  }
  if (url === globalThis.location.href) globalThis.location.reload();
  else globalThis.location.assign(url);
}

function isPresent(url, kind) {
  const document = globalThis.document;
  const nodes = kind === 'css'
    ? document.querySelectorAll('link[rel~="stylesheet"][href]')
    : document.querySelectorAll('script[src]');
  return [...nodes].some((node) => absolute(node.getAttribute(kind === 'css' ? 'href' : 'src')) === url);
}

// One request per asset for the life of the page: a second region that needs
// the same file waits on the first request, it does not make another.
function loadAsset({href, kind, key}) {
  const url = absolute(href);
  if (!url || !['css', 'javascript'].includes(kind)) return Promise.resolve();
  if (assetRequests.has(url)) return assetRequests.get(url);
  if (isPresent(url, kind)) {
    assetRequests.set(url, Promise.resolve());
    return assetRequests.get(url);
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
    // A file that does not come is the region's loss, not the page's: the
    // region is shown, and the component that needed it reports its own state.
    node.addEventListener('error', () => resolve(), {once: true});
  });
  document.head.append(node);
  assetRequests.set(url, loaded);
  return loaded;
}

// The region's html, parsed but not yet placed: its stylesheets and scripts
// are taken out and loaded as assets (a script set by innerHTML never runs).
function parseRegion(html) {
  const template = globalThis.document.createElement('template');
  template.innerHTML = String(html ?? '');
  const assets = [];
  for (const link of template.content.querySelectorAll('link[rel~="stylesheet"][href]')) {
    assets.push({href: link.getAttribute('href'), kind: 'css'});
    link.remove();
  }
  for (const script of template.content.querySelectorAll('script')) {
    if (script.getAttribute('src')) assets.push({href: script.getAttribute('src'), kind: 'javascript'});
    script.remove();
  }
  return {content: template.content, assets};
}

function validAnswer(answer, revision) {
  return answer && typeof answer === 'object'
    && answer.region === config.region
    && typeof answer.html === 'string'
    && typeof answer.shell_revision === 'string'
    && answer.shell_revision === revision
    && (answer.assets === undefined || Array.isArray(answer.assets));
}

export async function navigate(url, {history = 'push', scroll = 0} = {}) {
  if (!config) {
    globalThis.location.assign(url);
    return false;
  }
  const root = rootElement();
  const revision = shellRevision();
  if (!root || !revision) {
    fullLoad(url, 'no-region');
    return false;
  }
  const allowed = globalThis.document.dispatchEvent(new CustomEvent('sf-region-navigate', {
    cancelable: true, detail: {url, region: config.region},
  }));
  if (!allowed) return false;
  controller?.abort();
  controller = new AbortController();
  const mine = ++sequence;
  const skeleton = setTimeout(() => {
    if (mine !== sequence) return;
    root.setAttribute('aria-busy', 'true');
    root.setAttribute('data-sf-region-loading', '');
  }, SKELETON_DELAY_MS);
  const timeout = setTimeout(() => controller?.abort(), TIMEOUT_MS);
  let answer;
  try {
    const response = await globalThis.fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {[config.header]: config.region, Accept: 'application/json'},
      signal: controller.signal,
    });
    if (response.redirected || response.status !== 200 || !/application\/json/u.test(response.headers.get('content-type') ?? '')) {
      throw new Error(`region answer ${response.status}${response.redirected ? ' redirected' : ''}`);
    }
    answer = await response.json();
    if (!validAnswer(answer, revision)) throw new Error(answer?.shell_revision !== revision ? 'shell-revision' : 'region-answer');
  } catch (error) {
    clearTimeout(skeleton);
    clearTimeout(timeout);
    if (mine !== sequence) return false;
    root.removeAttribute('aria-busy');
    root.removeAttribute('data-sf-region-loading');
    if (error?.name === 'AbortError' && controller?.signal.aborted && mine === sequence) {
      fullLoad(url, 'timeout');
      return false;
    }
    fullLoad(url, String(error?.message ?? error));
    return false;
  }
  clearTimeout(timeout);
  if (mine !== sequence) return false;
  const address = typeof answer.url === 'string' && absolute(answer.url)?.startsWith(globalThis.location.origin)
    ? absolute(answer.url)
    : url;
  const parsed = parseRegion(answer.html);
  const assets = [...(answer.assets ?? []), ...parsed.assets];
  // Stylesheets before the swap, so the new content never shows unstyled;
  // scripts after, so the elements they define upgrade in place.
  await Promise.all(assets.filter((asset) => asset.kind === 'css').map(loadAsset));
  if (mine !== sequence) return false;
  if (history === 'push') {
    rememberScroll();
    globalThis.history.pushState({sfRegion: true, scroll: 0}, '', address);
  } else if (history === 'replace') {
    globalThis.history.replaceState({sfRegion: true, scroll: 0}, '', address);
  }
  const swap = () => {
    clearTimeout(skeleton);
    // Replacing the children disconnects the elements that leave: each one
    // releases its routes, listeners and timers in its own disconnect.
    root.replaceChildren(parsed.content);
    root.removeAttribute('aria-busy');
    root.removeAttribute('data-sf-region-loading');
    if (typeof answer.title === 'string' && answer.title) globalThis.document.title = answer.title;
  };
  const transition = typeof globalThis.document.startViewTransition === 'function'
    && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? globalThis.document.startViewTransition(swap)
    : null;
  if (transition) await transition.updateCallbackDone.catch(() => {});
  else swap();
  for (const asset of assets.filter((entry) => entry.kind === 'javascript')) await loadAsset(asset);
  globalThis.scrollTo(0, history === 'none' ? scroll : 0);
  const heading = root.querySelector('h1');
  if (heading) {
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({preventScroll: true});
  }
  globalThis.document.dispatchEvent(new CustomEvent('sf-region-load', {
    detail: {url: address, region: config.region, title: globalThis.document.title},
  }));
  return true;
}

export function enable(options = {}) {
  const next = {
    region: options.region ?? 'content',
    root: options.root,
    header: options.header,
    revisionMeta: options.revisionMeta,
    scope: options.scope ?? '/',
    onFullLoad: typeof options.onFullLoad === 'function' ? options.onFullLoad : null,
  };
  if (!next.root || !next.header || !next.revisionMeta) throw new TypeError('region navigation needs root, header and revisionMeta');
  if (config) disable();
  config = next;
  globalThis.document.addEventListener('click', onClick);
  globalThis.addEventListener('popstate', onPopState);
  if ('scrollRestoration' in globalThis.history) globalThis.history.scrollRestoration = 'manual';
  // The entry the page opened on takes part in Back like any other.
  const state = globalThis.history.state ?? {};
  globalThis.history.replaceState({...state, sfRegion: true, scroll: state.scroll ?? globalThis.scrollY}, '');
  return true;
}

export function disable() {
  if (!config) return;
  globalThis.document.removeEventListener('click', onClick);
  globalThis.removeEventListener('popstate', onPopState);
  controller?.abort();
  config = null;
}

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.RegionNavigation = Object.freeze({
    enable,
    disable,
    navigate,
    get enabled() {
      return Boolean(config);
    },
  });
}
