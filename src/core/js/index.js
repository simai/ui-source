import './public-path';
import './internal.js';
import './rule';
import './mask';
import './composition/index.mjs';
import './position.js';
import './preferences.js';
import './region-navigation.js';
import './effects.js';
import './notify.js';
import {
  createPreloaderContent,
  DEFAULT_PRELOADER,
  getPreloaderBackground,
  getPreloaderColor,
  startPreloaderMotion,
  stopPreloaderMotion,
} from './preloader';
// The shared Smart runtime: core/js/smart-base.js, a script of its own beside
// core.js, holding the modules the Smart bundles are built against (they carry
// no lit or smart-base of their own). Asked for by the bundles and by the
// Loader as soon as it queues a Smart element. A page that included the script
// by hand already has it.
if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  const SF = window.SF;
  if (!SF.loadRuntime) {
    let loading = null;
    const coreScript = () => [...document.scripts]
      .find((script) => /\/core\/js\/core(?:\.min)?\.js(?:[?#]|$)/u.test(script.src));
    SF.loadRuntime = () => {
      if (loading) return loading;
      if (SF.__internal.runtimeModules) {
        SF.__internal.runtimeSettled = true;
        loading = Promise.resolve(SF.__internal.runtimeModules);
      } else {
        loading = new Promise((resolve, reject) => {
          SF.__internal.runtimeArrived = (modules) => {
            SF.__internal.runtimeSettled = true;
            resolve(modules);
          };
          const core = coreScript();
          if (!core) return; // included by hand: it calls runtimeArrived when it runs
          const script = document.createElement('script');
          // The same form as Core's own file, beside it.
          script.src = core.src.replace(/core(\.min)?\.js(?=[?#]|$)/u, (match, min) => `smart-base${min || ''}.js`);
          script.async = true;
          script.addEventListener('error', () => reject(new Error(`SF runtime: ${script.src} did not load`)));
          document.head.append(script);
        });
      }
      SF.__internal.runtimeLoading = loading;
      return loading;
    };
    SF.runtimeModule = (id) => SF.loadRuntime().then((modules) => {
      if (!modules[id]) throw new Error(`SF runtime: no shared module "${id}"`);
      return modules[id];
    });
  }
}

// Icons wait for the subset font. The icons stylesheet declares the full
// Material Symbols font so a page without the runtime still draws its icons,
// and a browser fetches a declared font for any text set in it -- an icon at
// font-size 0, waiting for its glyph, included. So every first visit paid for
// the full font (409 KB) that the subset replaces a moment later, and the
// subset's own wait for document.fonts.ready waited on it too. While the
// attribute stands, icons are set in the subset family instead; the loader
// lifts it once the subset font or the full-font fallback is in place, and a
// timer lifts it on a page where neither ever comes.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const configValue = window.SF_BOOT_CONFIG?.icons?.enabled;
  const globalValue = window.SF_ICON_SUBSET_ENABLED;
  const subsetEnabled = typeof configValue === 'boolean'
    ? configValue
    : typeof globalValue === 'boolean' ? globalValue : true;
  const root = document.documentElement;
  if (subsetEnabled && root && !root.hasAttribute('data-sf-icons')) {
    root.setAttribute('data-sf-icons', 'subset-pending');
    setTimeout(() => {
      if (root.getAttribute('data-sf-icons') === 'subset-pending') {
        root.removeAttribute('data-sf-icons');
      }
    }, 6000);
  }
  // The subset is asked for once the page is ready; opening the connection
  // now takes its DNS, TCP and TLS (some 350 ms to icons.simai.io) off that
  // request. The fetch and the font are both anonymous CORS requests, which
  // is the connection a crossorigin preconnect opens.
  if (subsetEnabled && document.head) {
    try {
      const host = new URL(
        window.SF_BOOT_CONFIG?.icons?.subsetHost
          || window.SF_ICON_SUBSET_HOST
          || 'https://icons.simai.io',
        document.baseURI,
      ).origin;
      if (host !== window.location.origin
        && !document.head.querySelector(`link[rel="preconnect"][href="${host}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = host;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    } catch {
      /* A host that is not a URL is the request's problem, not the hint's. */
    }
  }
}

(() => {
  const PLACEHOLDER_MARK = 'sf-shortcode ';
  const CDN_FALLBACK = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/';

  if (!window.SF_BOOT_CONFIG) {
    window.SF_BOOT_CONFIG = {};
  }
  if (typeof window.SF_BOOT_CONFIG.preloader === 'undefined') {
    window.SF_BOOT_CONFIG.preloader = {
      wrap: null,
      preloaderActive: false,
    };
  }

  const applyInitialTheme = () => {
    if (window.SF_BOOT_CONFIG?.theme === false) return;
    const classes = ['theme-dark', 'theme-light'];
    const doc = document.documentElement;
    if (!doc) return;

    let themeCookie;
    try {
      themeCookie = document.cookie
        .split('; ')
        .find((c) => c.startsWith('sf-theme='));
    } catch {
      themeCookie = undefined;
    }
    let savedTheme = '';
    if (themeCookie) {
      try {
        savedTheme = decodeURIComponent(themeCookie.split('=')[1]);
      } catch {
        savedTheme = '';
      }
    }
    const preference = ['light', 'dark'].includes(savedTheme)
      ? savedTheme
      : 'system';
    const isDark =
      preference === 'dark' ||
      (preference === 'system' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches);

    const targetClass = isDark ? classes[0] : classes[1];
    doc.classList.remove(...classes);
    doc.classList.add(targetClass);
  };

  applyInitialTheme();

  if (!window.sfPath) {
    window.sfPath = CDN_FALLBACK;
  }

  const ensureDirAttribute = () => {
    const root = document.documentElement;
    if (!root || root.getAttribute('dir')) return;
    const computedDir =
      window.getComputedStyle && root
        ? window.getComputedStyle(root).direction
        : '';
    root.setAttribute('dir', computedDir === 'rtl' ? 'rtl' : 'ltr');
  };

  ensureDirAttribute();

  const hideBodyUntilReady = () => {
    if (
      window.SF_PRELOADED &&
      Object.keys(window.SF_PRELOADED.modules || {}).length
    ) {
      return;
    }
    const setHidden = () => {
      if (!document.body) return false;
      document.body.style.opacity = '0';
      return true;
    };

    if (!setHidden()) {
      const mo = new MutationObserver((muts, obs) => {
        if (setHidden()) obs.disconnect();
      });
      mo.observe(document.documentElement, { childList: true });
    }
    window.addEventListener(
      'sf-loader-ready',
      () => {
        if (document.body) document.body.style.opacity = '1';
      },
      { once: true },
    );
  };
  hideBodyUntilReady();

  const mountPreloader = () => {
    const cfg = {
      enabled: true,
      background: getPreloaderBackground(),
      modifier: 'loader-default',
      tempStyles:
        'inset: 0;position: fixed;width: 100%;height: 100vh;opacity: 1;z-index: 1000;background-color: var(--sf-color--surface-highest, var(--sf-surface-0, #fff));text-align: center;',
      color: getPreloaderColor(),
      width: DEFAULT_PRELOADER.width,
      height: DEFAULT_PRELOADER.height,
      content: '',
      delay: 300,
      ...(window.SF_BOOT_CONFIG?.preloader || {}),
    };

    if (cfg.enabled === false || document.querySelector('.sf-loader')) return;

    const svgContent = cfg.content || createPreloaderContent(cfg);
    let wrap = null;
    let preloaderWrap = null;
    let preloaderRun = false;
    let delayTimer = null;

    const hide = () => {
      if (wrap) {
        wrap.classList.add('hidden');
      }
    };
    const stopAnimation = () => {
      if (preloaderWrap) {
        stopPreloaderMotion(preloaderWrap);
      }
    };

    const buildPreloader = () => {
      if (preloaderRun || document.querySelector('.sf-loader')) return;

      wrap = document.createElement('div');
      const inner = document.createElement('div');
      wrap.classList.add('sf-loader', cfg.modifier);
      wrap.setAttribute('data-sf-observer', 'ignore');
      wrap.setAttribute('style', cfg.tempStyles);
      if (cfg.background) {
        wrap.style.background = cfg.background;
      }
      inner.classList.add('sf-loader-block', 'sf-loader-boot');
      inner.setAttribute(
        'style',
        'display:flex; width: 100%;height: 100%;align-items: center;justify-content: center; transition: .2s all ease-in-out;',
      );
      inner.innerHTML = svgContent;

      wrap.append(inner);
      document.documentElement.append(wrap);
      preloaderWrap = inner;
      preloaderRun = true;

      window.SF_BOOT_CONFIG.preloader = {
        wrap: wrap,
        preloaderActive: true,
      };

      startPreloaderMotion(preloaderWrap, () => preloaderRun, cfg);
    };

    const cancelBuild = () => {
      if (delayTimer) {
        clearTimeout(delayTimer);
        delayTimer = null;
        preloaderWrap && preloaderWrap.classList.add('hidden');
      }
    };

    window.addEventListener(
      'sf-loader-init',
      () => {
        if (!preloaderWrap?.classList?.contains('sf-loader-boot')) return;
        preloaderRun = false;
        stopAnimation();
      },
      { once: true },
    );

    window.addEventListener(
      'sf-loader-ready',
      () => {
        cancelBuild();
        preloaderRun = false;
        stopAnimation();
        hide();
      },
      { once: true },
    );

    if (cfg.delay > 0) {
      delayTimer = setTimeout(buildPreloader, cfg.delay);
    } else {
      buildPreloader();
    }
  };

  mountPreloader();

  const hideShortCodes = (root) => {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const toReplace = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue || !node.nodeValue.includes('[!')) continue;
      toReplace.push(node);
    }
    toReplace.forEach((textNode) => {
      const text = textNode.nodeValue;
      const regex =
        /\[!([a-zA-Z0-9_-]+)(?:\s+[^\](]+?)?](?:\([^)]*\))?(?:#[a-zA-Z0-9_-]+)?/g;
      let lastIndex = 0;
      const frag = document.createDocumentFragment();

      for (const match of text.matchAll(regex)) {
        const start = match.index ?? text.indexOf(match[0], lastIndex);
        const end = start + match[0].length;
        if (start > lastIndex) {
          frag.appendChild(
            document.createTextNode(text.slice(lastIndex, start)),
          );
        }
        const comment = document.createComment(PLACEHOLDER_MARK + match[0]);
        (window.SF_BOOT_SHORTCODES = window.SF_BOOT_SHORTCODES || []).push(
          comment,
        );
        frag.appendChild(comment);
        lastIndex = end;
      }
      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      textNode.replaceWith(frag);
    });
  };

  const isObserverIgnored = (node) => {
    const host =
      node instanceof Element ? node : node?.parentElement || null;

    return Boolean(host?.closest?.('[data-sf-observer="ignore"]'));
  };

  const mo = new MutationObserver((muts) => {
    muts.forEach(
      (m) =>
        m.addedNodes &&
        m.addedNodes.forEach((n) => {
          if (isObserverIgnored(n)) return;
          if (n.nodeType === Node.TEXT_NODE || n instanceof Text) {
            if (n.nodeValue?.includes('[!')) hideShortCodes(n.parentNode);
          } else if (n instanceof HTMLElement) {
            hideShortCodes(n);
          }
        }),
    );
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('sf-loader-init', () => mo.disconnect(), {
    once: true,
  });
})();

// Core's own chunks are evaluated in order -- the rules, then the system
// events, then the Loader, which reads the rules as it starts -- but nothing
// makes them wait for each other on the wire. They were fetched one after
// another, each after the previous had run: on a 10 Mbit/s line the Loader
// started 160 ms after Core's rules had arrived (2026-10-13). The browser is
// told about all three at once; each import then finds its file fetched.
const preloadCoreChunks = () => {
  const core = [...document.scripts]
    .find((script) => /\/core\/js\/core(?:\.min)?\.js(?:[?#]|$)/u.test(script.src));
  if (!core || typeof document.createElement !== 'function') return;
  for (const name of ['core-rules', 'core-system', 'core-loader']) {
    const href = core.src.replace(/core(\.min)?\.js(?=[?#]|$)/u, (match, min) => `${name}${min || ''}.js`);
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = href;
    document.head.append(link);
  }
};

(async () => {
  preloadCoreChunks();
  await import(/* webpackChunkName: "core-rules" */ './rule.src');
  await import(
    /* webpackChunkName: "core-system" */ '../../component/sf-system/js/ready/_ready'
  );
  await import(
    /* webpackChunkName: "core-system" */ '../../component/sf-system/js/event/event'
  );
  await import(/* webpackChunkName: "core-loader" */ './loader');
})();
