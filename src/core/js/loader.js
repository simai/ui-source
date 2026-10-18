import { decodeCacheValue, encodeCacheValue } from './cacheCodec';
import stableHash from './stableHash';
import pageStorage from './page-storage.js';
import { convertTailwindClasses } from './tailwind-map';
import utilityModuleAliases from '../contracts/utility-module-aliases.v1.json';
import templateUtilities from './template-utilities.generated.json';
import { resolveUtilityModule } from './utilityModuleAliases';
import {
  initIconSubsetState,
  installIconSubsetRuntime,
} from './iconSubsetRuntime';
import {
  createPreloaderContent,
  DEFAULT_PRELOADER,
  getPreloaderBackground,
  getPreloaderColor,
  startPreloaderMotion,
  stopPreloaderMotion,
} from './preloader';
import {html as staticHtml, unsafeStatic} from 'lit/static-html.js';

/* global __SF_CACHE_VERSION__, __SF_PLUGIN_LIST_VERSION__ */

(() => {
  const pending = (window.SF_PENDING_COMPONENTS =
      window.SF_PENDING_COMPONENTS || []);
  window.registerSfComponent = function registerSfComponent(name, cls) {
    if (!name || !cls) return;
    if (window.SF?.ComponentRegistry?.[name]) return;
    if (window.SF?.Loader?.registerComponent) {
      try {
        window.SF.Loader.registerComponent(name, cls);
      } catch (e) {
        console.warn('component:ready dispatch failed', e);
      }
    } else {
      pending.push([name, cls]);
    }
  };
  window.addEventListener('sf-loader-ready', () => {
    if (!window.SF?.Loader?.registerComponent) return;
    while (pending.length) {
      const [n, c] = pending.shift() || [];
      if (!n || !c) continue;
      if (window.SF?.ComponentRegistry?.[n]) continue;
      try {
        window.SF.Loader.registerComponent(n, c);
      } catch (e) {
        console.warn(e);
      }
    }
  });
})();

// Made when it is sent: made once when this file ran, its timestamp was the
// moment the Loader was evaluated, not the moment the page was ready.
const createReadyEvent = () => new CustomEvent('sf-loader-ready', {
  detail: {
    message: 'All components loaded.',
    timestamp: Date.now(),
  },
});

function firstFilledValue(...values) {
  for (const value of values) {
    if (value === null || typeof value === 'undefined') {
      continue;
    }

    const normalized = String(value).trim();
    if (normalized !== '') {
      return normalized;
    }
  }

  return '';
}

// Where Smart is served from. From release ui-6b4a0c3887d6 the `ui`
// distribution carries Smart in `distr/smart`, beside `distr/core`, so a page
// that names only `sfPath` gets `<sfPath>/smart` -- that is the layout, not a
// fallback. `sfSmartPath` stays for the pages that still serve the separate
// ui-smart repository from its own root. An empty value counts as not set: a
// lab writes `sfSmartPath = ''` and means the default, and an empty root would
// otherwise resolve every Smart file against the page's own directory.
function resolveSmartRoot(url, smartUrl) {
  const own = typeof smartUrl === 'string' ? smartUrl.trim() : '';
  return own || url;
}

// Component packages: bundles of Smart components served from their own base
// and carrying their own rules (Larena's components are the first; standard
// simai.component-package). A page declares
// them in `SF_BOOT_CONFIG.packages`; docs/developer/component-packages.md has
// the contract. The name is also the prefix of the package's entries in the
// missing-file cache, so it is kept to characters that cannot collide with a
// rule name's own.
const PACKAGE_NAME = /^[a-z][a-z0-9-]*$/;
const PACKAGE_MISS_SEPARATOR = '::';

function normalisePackageUrl(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '');
}

function SFLoaderPlugin(params) {
  if (params.url && params.url.endsWith('/')) {
    params.url = params.url.slice(0, params.url.length - 1);
  }
  if (params.smartUrl && params.smartUrl.endsWith('/')) {
    params.smartUrl = params.smartUrl.slice(0, params.smartUrl.length - 1);
  }
  this.loadPage = false;
  this.turboEnabled = false;
  this.ComponentRegistry = {};
  this.shortCodes = {
    copy: 'clipboard',
  };
  this.componentTemplates = {};
  this.prepareInit = false;
  initIconSubsetState(this);
  this.eventSend = false;
  this.uniqueIcons = new Map();
  this.pendingRegex = true;
  this.url = params.url ?? '/simai/asset/simai.framework/sf5.master';
  this.smartUrl = resolveSmartRoot(this.url, params.smartUrl);
  this.observeElements = [];
  this.module = {};
  this.phpScriptsLoaded = [];
  this.pluginListRelation = [];
  this.lastLoadHash = null;
  this.theme = 'light';
  this.themeEnabled = params.theme !== false;
  this.preloaderWrap = window.SF_BOOT_CONFIG.preloader?.wrap || null;
  // Simai Framework 5 resolves versioned static assets in the browser.
  // Keep the public flag for compatibility, but do not enable the retired
  // server-side PHP bundler when callers pass `standAlone: false`.
  this.standAlone = true;
  this.disableSmart = !!params.disableSmart;
  this.smart = {
    ...(window.SF_BOOT_CONFIG?.smart || {}),
    ...(params.smart || {}),
  };
  this.smartBaseReady = null;
  this.smartBaseLoadPromise = null;
  this.sfDir = '/simai/';
  this.utilyPath = `${this.url}/utility`;
  this.smartPath = `${this.smartUrl}/smart`;
  this.componentPath = `${this.url}/component`;
  this.smartCache = null;
  this.resolverAll = {};
  this.mutationObserver = null;
  this.prepareObserver = null;
  this.stopObserver = false;
  this.dragObserverLockCount = 0;
  this.eventsPlugins = [];
  this.urlHash = '';
  this.preloaderRun = window.SF_BOOT_CONFIG.preloader?.preloaderActive || false;
  this.pendingLoadPlugins = new Set();
  this.pendingShortcodeLoads = new Set();
  this.relationPlugins = {};
  this.totalRelationsPlugins = {};
  this.shortcodeReadyCache = new Map();
  this.heavyModules = params.heavyModules || [];
  this.priorityModules = params.priorityModules || [
    'container',
    'display',
    'flex',
    'grid',
    'gap',
    'column',
    'width',
    'height',
    'aspect-ratio',
    'element-position',
    'element-position-ext',
    'headers',
    'theme',
    'skeleton',
  ];
  this.preloader = {
    color: getPreloaderColor(),
    width: DEFAULT_PRELOADER.width,
    height: DEFAULT_PRELOADER.height,
  };
  this.timingStart =
      typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
  this.turboEventsBound = false;
  this.smartChildScanEventsBound = false;
  this.totalLoadPlugin = 0;
  this.notFoundFiles = {};
  this.lazyRelations = new Set();
  this.cachedPlugins = [];
  this.loadedPlugins = {};
  this.attrMatchCache = new Map();
  this.regexMatchCache = new Map();
  this.cacheVersion = firstFilledValue(
      params.cacheVersion,
      typeof __SF_CACHE_VERSION__ !== 'undefined'
          ? __SF_CACHE_VERSION__
          : null,
      window.SF_BOOT_CONFIG?.cacheVersion,
      window.SF_CACHE_VERSION,
  );
  this.pluginListVersion = firstFilledValue(
      params.pluginListVersion,
      typeof __SF_PLUGIN_LIST_VERSION__ !== 'undefined'
          ? __SF_PLUGIN_LIST_VERSION__
          : null,
      window.SF_BOOT_CONFIG?.pluginListVersion,
      window.SF_PLUGIN_LIST_VERSION,
  );
  this.params = params;
  this.firstLoad = true;
  this.attr = params.attr ? params.attr : 'sf-asset';
  this.turboEventsBound = false;
  this.turboRenderHandled = false;
  this.delimiterURL = params.delimiterURL ? params.delimiterURL : '/';
  this.frameworkPath = params.frameworkPath
      ? params.frameworkPath
      : '/simai/asset/simai.framework/sf5.master/utility/';
  this.findPlugins = params.findPlugins ? params.findPlugins : {};
  this.requiredPlugins = params.requiredPlugins ? params.requiredPlugins : [];
  this.isLoadPluginCookie = params.isLoadPluginCookie
      ? params.isLoadPluginCookie
      : false;
  this.contentPreloaderText = params.contentPreloaderText
      ? params.contentPreloaderText
      : 'LOADING';
  this.arrowInterval = null;
  this.contentPreloader = '';
  this.backgroundPreloader = params.backgroundPreloader
      ? params.backgroundPreloader
      : getPreloaderBackground();
  this.tempLoaderStyles =
      'inset: 0;position: fixed;width: 100%;height: 100vh;opacity: 1;z-index: 1000;background-color: var(--sf-color--surface-highest, var(--sf-surface-0, #fff));text-align: center;';
  this.modifierPreloader = params.modifierPreloader
      ? params.modifierPreloader
      : 'loader-default';
  this.isDebug = false;
  // Minified bundles unless someone is debugging: every bundle ships
  // <name>.min.js and <name>.min.css beside the readable files, at about 40 %
  // of the size, and the Loader used to fetch the readable ones on every page
  // (measured on the admin: 7 MB of script where 3 would do). A page asks for
  // the readable files with SF_BOOT_CONFIG.minified = false, ?sf-debug in its
  // address, or data-sf-debug on <html>.
  this.minified = resolveMinified(params);
  this.profileLoader =
      params.profileLoader ?? window.SF_BOOT_CONFIG?.profileLoader ?? this.isDebug;
  this.profileThreshold =
      params.profileThreshold ?? window.SF_BOOT_CONFIG?.profileThreshold ?? 2;
  this.usePreloader = true;
  this.debugStr = {
    initLoader: 'SFLoaderPlugin: script is run',
    requiredPluginsNotEmpty:
        'SFLoaderPlugin: the required plugins parameter is not empty',
    regexpPlugins: 'SFLoaderPlugin: findPlugins list ',
    isExistFileOnreadystatechange:
        'SFLoaderPlugin: checking that the plugin files exist',
    isExistFilestatus200: 'SFLoaderPlugin: status 200',
    isExistFilestatusNo200: 'SFLoaderPlugin: status is not 200',
    isExistFileReadyStateNo4: 'SFLoaderPlugin: Ready State no 4',
    searchRegexpRun: 'SFLoaderPlugin: searchRegexp is run',
  };
  this.plugin = {};
  this.searchEnd = false;
  this.packages = Object.create(null);
  this.packageWarnings = new Set();
  this.installPackageApi();
  this.declarePackages({
    ...(window.SF_BOOT_CONFIG?.packages || {}),
    ...(params.packages || {}),
  });

  // A declared package's rules are fetched before the first scan, so its tags
  // are known when the page is first read and a cached plugin list never names
  // a rule that has not arrived yet. A page without packages starts exactly as
  // before, synchronously.
  const packageRulesReady = this.loadDeclaredPackageRules();
  const start = () => (packageRulesReady
    ? packageRulesReady.then(() => this.init())
    : this.init());

  if (this.smart.base === true) {
    this.smartBaseReady = this.loadSmartBase().finally(start);
  } else {
    // Settles when the base arrives, however it arrives: SF.loadSmartBase() or
    // the first Smart bundle. It used to resolve at once with null, so
    // `await SF.smartBaseReady` waited for nothing (documentation trial).
    this.smartBaseReady = window.SF?.smart?.SfBaseElement
      ? Promise.resolve(window.SF.smart)
      : new Promise((resolve) => {
        window.addEventListener('sf-smart-base-ready', () => resolve(window.SF?.smart || null), {once: true});
      });
    start();
  }
}

SFLoaderPlugin.prototype.installPackageApi = function () {
  const rules = this.findPlugins;
  if (!rules || typeof rules !== 'object') return;
  // Not enumerable: everything that reads the rule map walks its entries, and
  // a function among them would be read as a rule.
  Object.defineProperty(rules, 'registerPackage', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: (name, options) => this.registerPackage(name, options),
  });
};

SFLoaderPlugin.prototype.warnPackage = function (key, message) {
  if (this.packageWarnings.has(key)) return;
  this.packageWarnings.add(key);
  console.warn(`SFLoader: ${message}`);
};

SFLoaderPlugin.prototype.declarePackages = function (declared) {
  Object.entries(declared || {}).forEach(([name, config]) => {
    if (!PACKAGE_NAME.test(name)) {
      this.warnPackage(`name:${name}`,
          `"${name}" in SF_BOOT_CONFIG.packages is not a package name `
          + '(lower-case letters, digits and hyphens); it is ignored');
      return;
    }
    const base = normalisePackageUrl(config?.base);
    if (!base) {
      this.warnPackage(`base:${name}`,
          `package "${name}" is declared without a base, so none of its `
          + 'components can load; set SF_BOOT_CONFIG.packages.'
          + `${name}.base to the directory holding its component folders`);
    }
    this.packages[name] = {
      name,
      base,
      rule: normalisePackageUrl(config?.rule) || (base ? `${base}/rule.js` : ''),
      declared: true,
      registered: false,
    };
  });
};

SFLoaderPlugin.prototype.loadDeclaredPackageRules = function () {
  const loads = Object.values(this.packages)
      .filter((pkg) => pkg.declared && pkg.rule)
      .map((pkg) => this.addScript(pkg.rule)
          .then(() => {
            if (!pkg.registered) {
              this.warnPackage(`empty:${pkg.name}`,
                  `${pkg.rule} loaded but registered nothing for package `
                  + `"${pkg.name}"; it must call SF.RuleLoader.registerPackage(`
                  + `"${pkg.name}", {rules})`);
            }
          })
          .catch(() => {
            this.warnPackage(`rule:${pkg.name}`,
                `the rules of package "${pkg.name}" could not be loaded from `
                + `${pkg.rule}; its components stay undefined`);
          }));
  return loads.length ? Promise.all(loads) : null;
};

// The one way a package adds rules. It may run before the first scan (the
// rule file the Loader fetched for a declared package) or long after it (a
// page registering a package of its own), so it rebuilds what the Loader
// derived from the rule map and reads the page again.
//
// A package rule may replace a Core rule of the same name: while a component
// moves into a package, Core still ships its old rule, and a page that
// declared the package chose the package's bytes. A rule that has already
// been loaded is not replaced -- a custom element cannot be defined twice.
SFLoaderPlugin.prototype.registerPackage = function (name, options = {}) {
  const packageName = String(name ?? '').trim();
  if (!PACKAGE_NAME.test(packageName)) {
    this.warnPackage(`name:${packageName}`,
        `"${packageName}" is not a package name (lower-case letters, digits `
        + 'and hyphens); its rules are not registered');
    return [];
  }
  const rules = options?.rules;
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    this.warnPackage(`rules:${packageName}`,
        `package "${packageName}" was registered without a rules object`);
    return [];
  }
  if (!this.packages[packageName]) {
    this.packages[packageName] = {
      name: packageName, base: '', rule: '', declared: false, registered: false,
    };
  }
  const pkg = this.packages[packageName];
  // Where the bytes are served is the page's decision, so a base the page
  // declared wins over the one a bundle suggests.
  if (!pkg.base) pkg.base = normalisePackageUrl(options.base);
  pkg.registered = true;

  const added = [];
  Object.entries(rules).forEach(([key, rule]) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      this.warnPackage(`rule:${packageName}:${key}`,
          `package "${packageName}" rule "${key}" is not an object; skipped`);
      return;
    }
    const current = this.findPlugins[key];
    if (current?.package && current.package !== packageName) {
      this.warnPackage(`owner:${packageName}:${key}`,
          `rule "${key}" already belongs to package "${current.package}"; `
          + `package "${packageName}" cannot take it`);
      return;
    }
    if (current && (this.module[key] || this.loadedPlugins[key])) {
      this.warnPackage(`loaded:${packageName}:${key}`,
          `rule "${key}" is already loaded from `
          + `${current.package ? `package "${current.package}"` : 'the Smart base'}; `
          + `the copy in package "${packageName}" is not used on this page`);
      return;
    }
    this.findPlugins[key] = { ...rule, package: packageName };
    added.push(key);
  });

  if (added.length) this.rulesChanged();
  return added;
};

// Everything the Loader derived from the rule map, dropped so the next read
// sees the new rules, and the page read again so elements that were on it
// before their rule arrived are loaded now. Before the first scan there is
// nothing to read again: that scan reads the new rules itself.
SFLoaderPlugin.prototype.rulesChanged = function () {
  this.clearAttributeRuleIndex();
  this.clearRegexpScanRules();
  this.attrMatchCache.clear();
  this.regexMatchCache.clear();
  if (!this.prepareInit || typeof document === 'undefined' || !document.body) {
    return;
  }
  this.mutate(() => {
    this.scanCustomElements(document.body);
    this.scanAttributes(document.body);
    if (!this.pendingRegex) this.searchRegexp('');
  });
};

// The base a Smart rule's files are fetched from: its package's, or the Smart
// base when it has none. A package rule whose package is unknown or has no
// base resolves to nothing, said once per rule, and is never quietly fetched
// from the Smart base -- that would load whatever an older Core shipped under
// the same name, or 404 and be cached as missing there.
SFLoaderPlugin.prototype.resolveSmartBase = function (name) {
  const rule = this.findPlugins?.[name];
  const packageName = rule && typeof rule === 'object' ? rule.package : '';
  if (!packageName) return this.smartPath;
  const pkg = this.packages[packageName];
  if (pkg?.base) return pkg.base;
  const tags = Array.isArray(rule.tags) && rule.tags.length
    ? rule.tags.map((tag) => `<${tag}>`).join(', ')
    : name;
  this.warnPackage(`resolve:${packageName}:${name}`, pkg
    ? `${tags} belongs to package "${packageName}", which has no base; `
      + `set SF_BOOT_CONFIG.packages.${packageName}.base. It is not loaded `
      + 'from the Smart base.'
    : `${tags} belongs to package "${packageName}", which this page has not `
      + `declared; add SF_BOOT_CONFIG.packages.${packageName} = {base: ...}. `
      + 'It is not loaded from the Smart base.');
  return null;
};

SFLoaderPlugin.prototype.isPluginResolvable = function (name) {
  const rule = this.findPlugins?.[name];
  if (!rule || typeof rule !== 'object' || !rule.package) return true;
  return this.resolveSmartBase(name) !== null;
};

SFLoaderPlugin.prototype.debug = function (str) {
  if (this.isDebug) {
    console.log(str);
  }
};

SFLoaderPlugin.prototype.logTiming = function (label) {
  if (!this.isDebug) return;
  const now =
      typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
  console.log(
      `SFLoader timing ${label}: ${(now - this.timingStart).toFixed(1)}ms`,
  );
};

SFLoaderPlugin.prototype.now = function () {
  return typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
};

SFLoaderPlugin.prototype.profileStart = function (label) {
  if (!this.profileLoader) return null;
  return {
    label,
    start: this.now(),
  };
};

SFLoaderPlugin.prototype.profileEnd = function (profile, detail = {}) {
  if (!profile || !this.profileLoader) return;

  const duration = this.now() - profile.start;
  if (duration < this.profileThreshold) return;

  const roundedDuration = Number(duration.toFixed(2));
  console.log(`SFLoader profile ${profile.label}: ${roundedDuration}ms`, {
    duration: roundedDuration,
    ...detail,
  });
};

SFLoaderPlugin.prototype.loadSmartBase = function () {
  if (window.SF?.smart?.SfBaseElement) {
    return Promise.resolve(window.SF.smart);
  }

  if (this.smartBaseLoadPromise) {
    return this.smartBaseLoadPromise;
  }

  // The base arrives with the shared runtime, in one chunk with the modules the
  // Smart bundles are built against.
  this.smartBaseLoadPromise = window.SF.loadRuntime()
      .then(() => {
        // The base announces itself (sf-smart-base-ready) when it publishes
        // SF.smart, once per page, so it is not announced again here.

        return window.SF?.smart || null;
      })
      .catch((error) => {
        console.warn('smart base load failed', error);
        return null;
      });

  this.smartBaseReady = this.smartBaseLoadPromise;
  return this.smartBaseLoadPromise;
};

/**
 * Получает значение GET-параметра
 * @param {*} param GET-параметр
 * @returns string
 */
SFLoaderPlugin.prototype.getUrlParam = function (param = false) {
  if (param) {
    const getParam = new URL(window.location.href);
    return getParam.searchParams.get(param);
  } else {
    return '';
  }
};

function parseParams(str) {
  const result = {};
  const re =
      /([a-zA-Z0-9_]+)\s*=\s*(?:(?:'([^']*)')|(?:"([^"]*)")|(?:\[([^\]]*)\])|(\S+))/g;
  let match;
  while ((match = re.exec(str)) !== null) {
    const key = match[1];
    let val;
    if (match[2] !== undefined) {
      val = match[2];
    } else if (match[3] !== undefined) {
      val = match[3];
    } else if (match[4] !== undefined) {
      val = match[4].split(',').map((s) => s.trim());
    } else if (match[5] !== undefined) {
      val = match[5];
    }
    result[key] = val;
  }
  return result;
}

SFLoaderPlugin.prototype.findShortCodes = function (node) {
  const regex =
      /\[!([a-zA-Z0-9_-]+)(?:\s+([^\](]+?))?](?:\(([^)]*)\))?(?:#([a-zA-Z0-9_-]+))?/g;
  const host =
      node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement || null;

  if (this.shouldSkipNode(host)) {
    return;
  }
  // Разбираем и TEXT, и COMMENT плейсхолдеры, чтобы поддержать boot-скрытие.
  if (node.nodeType === Node.ELEMENT_NODE) {
    node.childNodes.forEach((child) => {
      if (
          child.nodeType === Node.TEXT_NODE ||
          child.nodeType === Node.COMMENT_NODE
      ) {
        this.findShortCodes(child);
      } else if (
          child.nodeType === Node.ELEMENT_NODE &&
          !this.shouldSkipNode(child)
      ) {
        this.findShortCodes(child);
      }
    });
    return;
  }
  const isComment =
      node.nodeType === Node.COMMENT_NODE &&
      node.nodeValue?.startsWith('sf-shortcode ');

  const isText = node.nodeType === Node.TEXT_NODE;
  if (!isText && !isComment) return;

  const textContent = isComment
      ? node.nodeValue.slice('sf-shortcode '.length)
      : node.textContent;
  if (!textContent) return;

  const matches = [...textContent.matchAll(regex)];
  if (matches.length === 0) return;
  const profile = this.profileStart('findShortCodes');
  const segments = [];
  let lastIndex = 0;
  matches.forEach((match) => {
    const raw = match[0];
    const start =
        match.index !== undefined
            ? match.index
            : textContent.indexOf(raw, lastIndex);
    const end = start + raw.length;
    if (start > lastIndex) {
      segments.push({
        type: 'text',
        text: textContent.slice(lastIndex, start),
      });
    }
    const [, name, attrs, param, id] = match;
    segments.push({
      type: 'shortcode',
      data: {
        name,
        attrs: generateTemplateParamsFromString(attrs),
        param: parseParams(param),
        id,
        raw,
      },
    });
    lastIndex = end;
  });

  if (lastIndex < node.textContent.length) {
    segments.push({ type: 'text', text: textContent.slice(lastIndex) });
  }
  // Hide raw shortcode text immediately to avoid flicker before processing
  if (isComment) {
    node.nodeValue = '';
  } else {
    node.textContent = '';
  }

  const shortcodeSegments = segments.filter((seg) => seg.type === 'shortcode');
  // requestIdleCallback is throttled in a hidden tab and rAF is paused there, so
  // the fallback goes through the loader's own scheduler.
  const schedule =
      (typeof document !== 'undefined' && document.hidden
        ? null
        : window.requestIdleCallback) ||
      function (cb) {
        return scheduleLoaderWork(() => cb());
      };

  const processShortcodes = () => {
    const newlyAddedModules = new Set();

    const interimNodes = segments.map((seg) => {
      if (seg.type === 'text') {
        return document.createTextNode(seg.text);
      }
      const placeholder = document.createComment('sf-shortcode');
      seg.placeholder = placeholder;
      return placeholder;
    });

    const replacePlaceholders = () => node.replaceWith(...interimNodes);
    const canReplaceSync = shortcodeSegments.length <= 10;
    if (canReplaceSync) {
      replacePlaceholders();
    } else {
      this.mutate(() => replacePlaceholders());
    }

    const promises = shortcodeSegments.map((seg) => {
      const entry = seg.data;
      const originItem =
          this.shortCodes[entry.name.toLowerCase()] || entry.name.toLowerCase();
      const rule = SF.RuleLoader[originItem];
      if (rule && !this.module[originItem]) {
        this.setExistCookie(originItem);
        newlyAddedModules.add(originItem);
      } else if (!rule) {
        return Promise.resolve(null);
      }
      const targetName = originItem || entry.name;
      const cacheKey = originItem || entry.name || targetName;
      const names = Array.from(
          new Set([targetName, originItem, entry.name].filter(Boolean)),
      );

      // Fast path: если класс уже зарегистрирован — рендерим сразу
      const LoadedClass =
          names.map((n) => this.ComponentRegistry?.[n]).find((cls) => cls) ||
          null;
      if (LoadedClass) {
        try {
          const comp = new LoadedClass({
            id: entry.id,
            param: entry.param,
            attrs: entry.attrs,
          });
          return Promise.resolve(comp.render());
        } catch (e) {
          console.warn('shortcode render failed', originItem, e);
          return Promise.resolve(null);
        }
      }

      if (!this.shortcodeReadyCache.has(cacheKey)) {
        const readyPromise = new Promise((resolve) => {
          try {
            let resolved = false;
            const resolveOnce = (ResolvedClass) => {
              if (resolved || !ResolvedClass) return;
              resolved = true;
              resolve(ResolvedClass);
            };
            if (newlyAddedModules.size && !this.pendingRegex) {
              this.getLoader(this.module, true);
            }
            names.forEach((name) => this.ready(name, resolveOnce));
            setTimeout(() => {
              if (!resolved) {
                if (this.isDebug) {
                  console.warn('SFLoader shortcode resolution timeout', {
                    targetName,
                    names,
                    entry,
                  });
                }
                resolve(null);
              }
            }, 8000);
          } catch (e) {
            console.warn(e);
            resolve(null);
          }
        });
        this.shortcodeReadyCache.set(cacheKey, readyPromise);
      }

      return this.shortcodeReadyCache.get(cacheKey).then((ResolvedClass) => {
        if (!ResolvedClass) return null;
        const comp = new ResolvedClass({
          id: entry.id,
          param: entry.param,
          attrs: entry.attrs,
        });
        return comp.render();
      });
    });

    // Запускаем загрузку новых модулей один раз на батч, если не в pending.
    const toLoad = Array.from(newlyAddedModules).filter(
        (name) => !this.pendingLoadPlugins.has(name),
    );
    if (toLoad.length && !this.pendingRegex) {
      toLoad.forEach((name) => this.pendingShortcodeLoads.add(name));
      this.getLoader(this.module, true);
    }

    Promise.allSettled(promises).then((results) => {
      if (this.isDebug) {
        console.log('SFLoader.shortcodes results', results);
      }
      if (toLoad.length) {
        toLoad.forEach((name) => this.pendingShortcodeLoads.delete(name));
      }
      let idx = 0;
      results.forEach((res) => {
        if (res.status === 'fulfilled') {
          shortcodeSegments[idx].nodes = normalizeToNodes(res.value);
        } else {
          shortcodeSegments[idx].nodes = [];
        }
        idx++;
      });

      this.mutate(() => {
        shortcodeSegments.forEach((seg) => {
          const target = seg.placeholder;
          if (!target || !target.parentNode) return;
          if (seg.nodes && seg.nodes.length) {
            target.replaceWith(...seg.nodes);
          } else {
            target.remove();
          }
        });
      });
    });
  };

  if (shortcodeSegments.length <= 10) {
    processShortcodes();
  } else {
    schedule(processShortcodes);
  }
  this.profileEnd(profile, {
    shortcodes: shortcodeSegments.length,
    textLength: textContent.length,
    nodeType: isComment ? 'comment' : 'text',
  });
};

function generateTemplateParamsFromString(string) {
  if (!string || !string.length) return null;
  const splitString = string.split(' ');
  const paramObj = {};
  splitString.forEach((el) => {
    if (el.match('=')) {
      const [name, value] = el.split('=');
      paramObj[name] = value;
    } else {
      paramObj[el] = true;
    }
  });
  return paramObj;
}

function normalizeToNodes(value) {
  if (value == null) return [];
  if (value instanceof Node) return [value];
  if (value instanceof DocumentFragment) return Array.from(value.childNodes);
  if (Array.isArray(value)) {
    return value.reduce((acc, item) => acc.concat(normalizeToNodes(item)), []);
  }
  if (typeof value === 'string') {
    const template = document.createElement('template');
    template.innerHTML = value;
    return Array.from(template.content.childNodes);
  }
  return [];
}

function safeSetItem(key, value) {
  try {
    pageStorage().setItem(key, value);
  } catch (e) {
    console.warn('localStorage setItem failed', key, e);
  }
}

function safeRemoveItem(key) {
  try {
    pageStorage().removeItem(key);
  } catch (e) {
    console.warn('localStorage removeItem failed', key, e);
  }
}

installIconSubsetRuntime(SFLoaderPlugin, { safeSetItem, safeRemoveItem });

SFLoaderPlugin.prototype.setModule = function (module = false) {
  if (module) {
    this.module[module] = module;
  }
};

/**
 * Преобразовать список модулей из объекта в массив
 * @returns array
 */

SFLoaderPlugin.prototype.getModuleArray = function () {
  const module = [];

  if (this.module) {
    for (const mod in this.module) {
      module.push(mod);
    }
  }

  return module;
};

SFLoaderPlugin.prototype.getObjectArray = function (obj) {
  const module = [];

  if (obj) {
    for (const mod in obj) {
      module.push(mod);
    }
  }

  return module;
};

SFLoaderPlugin.prototype.runPreloader = function () {
  if (!this.usePreloader) {
    return false;
  }

  const existingWrap = document.querySelector('.sf-loader');
  const existingInner =
      existingWrap &&
      existingWrap.querySelector('.sf-loader-block') &&
      existingWrap.querySelector('.sf-loader-block');

  if (existingWrap && existingInner) {
    this.debug('SFLoaderPlugin: reuse boot preloader');
    this.preloaderWrap = existingInner;
    this.preloaderRun = true;

    existingWrap.setAttribute('data-sf-observer', 'ignore');
    existingWrap.classList.remove('hidden');
    existingWrap.style.opacity = '1';
    if (!existingInner.classList.contains('sf-loader-boot')) {
      this.rotatePreloader();
    }
    return true;
  }

  this.debug('SFLoaderPlugin: preloader is run');
  const contentPreloader = this.contentPreloader;

  this.debug('SFLoaderPlugin: sf-loader is null');

  const sfLoaderDiv = document.createElement('div');
  const sfLoaderInnerDiv = document.createElement('div');

  sfLoaderDiv.classList.add('sf-loader', this.modifierPreloader);
  sfLoaderDiv.setAttribute('data-sf-observer', 'ignore');
  sfLoaderDiv.setAttribute('style', this.tempLoaderStyles);

  if (this.backgroundPreloader !== '') {
    sfLoaderDiv.style.background = this.backgroundPreloader;
  }

  sfLoaderInnerDiv.classList.add('sf-loader-block');
  document.documentElement.style.setProperty('--rotation-angle', '0deg');
  sfLoaderInnerDiv.setAttribute(
      'style',
      'display:flex; width: 100%;height: 100%;align-items: center;justify-content: center; transition: .2s all ease-in-out;',
  );
  sfLoaderInnerDiv.innerHTML = contentPreloader;

  sfLoaderDiv.append(sfLoaderInnerDiv);
  document.body.append(sfLoaderDiv);
  this.preloaderWrap = sfLoaderInnerDiv;
  this.rotatePreloader();
  this.preloaderRun = true;
};

SFLoaderPlugin.prototype.rotatePreloader = function () {
  startPreloaderMotion(
      this.preloaderWrap,
      () => this.preloaderRun,
      this.preloader,
  );
};

SFLoaderPlugin.prototype.stopAnimation = function () {
  clearInterval(this.arrowInterval);
  if (!this.preloaderWrap) return;
  stopPreloaderMotion(this.preloaderWrap);
};

SFLoaderPlugin.prototype.stopPreloader = function () {
  const hasPreloader = !!document.querySelector('.sf-loader');
  if (!hasPreloader && !this.preloaderRun)
    return;
  document.body.style.opacity = '1';
  this.preloaderRun = false;
  if (window.SF_BOOT_CONFIG?.preloader) {
    window.SF_BOOT_CONFIG.preloader.preloaderActive = false;
  }
  this.debug('SFLoaderPlugin: Stop preloader');

  this.stopAnimation();
  const sfLoader = document.querySelectorAll('.sf-loader');
  sfLoader.forEach((item) => {
    item.classList.add('hidden');
  });
};

SFLoaderPlugin.prototype.dispatchReadyOnce = function () {
  if (this.eventSend) {
    return false;
  }
  // The Smart bundles define their elements once the shared runtime has
  // arrived; the page is ready when they have, not when their scripts have.
  const runtime = window.SF?.__internal?.runtimeLoading;
  if (runtime && !window.SF.__internal.runtimeSettled) {
    if (!this.readyWaitsForRuntime) {
      this.readyWaitsForRuntime = true;
      runtime
        .catch(() => null)
        .then(() => new Promise((settle) => setTimeout(settle, 0)))
        .then(() => {
          this.readyWaitsForRuntime = false;
          this.dispatchReadyOnce();
        });
    }
    return false;
  }

  try {
    window.dispatchEvent(createReadyEvent());
    this.eventSend = true;
    this.prefetchLazyRelations();
    return true;
  } catch (e) {
    console.warn('sf-loader-ready dispatch failed', e);
    return false;
  }
};

SFLoaderPlugin.prototype.getAssets = function (existLoadPlugins) {
  this.plugins = document.querySelectorAll('[sf-asset]');
  const PluginList = [];

  if (this.plugins.length > 0) {
    this.plugins.forEach((plugin) => {
      const pluginURL = plugin.getAttribute('sf-asset');

      if (existLoadPlugins) {
        this.debug('SFLoaderPlugin: searchAttr is run!');
        // this.load(pluginURL, pluginName);
      }

      // this.setCookie('SF_LOADER', pluginURL, 10)
      this.setModule(pluginURL);
      PluginList.push(pluginURL);
    });
    return PluginList;
  }
};

SFLoaderPlugin.prototype.searchAttr = function () {
  this.plugins = document.querySelectorAll('[sf-asset]');
  this.debug(`this.plugins.length: ${this.plugins.length}`);
  if (this.plugins.length > 0) {
    this.plugins.forEach((plugin) => {
      const pluginURL = plugin.getAttribute('sf-asset');
      this.setModule(pluginURL);
    });
  }
};

SFLoaderPlugin.prototype.getPluginName = function (pluginURL) {
  if (typeof pluginURL === 'string') {
    if (pluginURL.split(this.delimiterURL).pop() !== '') {
      return pluginURL.split(this.delimiterURL).pop();
    } else {
      const arrPluginLink = pluginURL.split(this.delimiterURL);
      return arrPluginLink[arrPluginLink.length - 2];
    }
  } else {
    return false;
  }
};

SFLoaderPlugin.prototype.setCookie = function (name, value, expiredays = 30) {
  const exdate = new Date();
  exdate.setTime(exdate.getTime() + expiredays * 86400 * 1000);

  try {
    document.cookie =
        name +
        '=' +
        encodeURIComponent(value) +
        (expiredays == null ? '' : '; expires=' + exdate.toUTCString()) +
        '; path=/';
    return true;
  } catch {
    return false;
  }
};

SFLoaderPlugin.prototype.getCookie = function (name) {
  let cookies = '';
  try {
    cookies = document.cookie;
  } catch {
    return '';
  }
  if (cookies.length > 0) {
    let start = cookies.indexOf(name + '=');

    if (start !== -1) {
      start = start + name.length + 1;

      let end = cookies.indexOf(';', start);

      if (end === -1) {
        end = cookies.length;
      }

      return encodeURI(cookies.substring(start, end));
    }
  }

  return '';
};

// TODO Удалить если не используется

SFLoaderPlugin.prototype.checkCookie = function (name) {
  // name = this.getCookie(name)
  name = this.module[name];

  if (name != null && name !== '') {
    return true;
  } else {
    return false;
  }
};

SFLoaderPlugin.prototype.getApartCookie = function (name) {
  // A sandboxed document throws on reading its cookies, as getCookie knows.
  let cookies = '';
  try {
    cookies = document.cookie;
  } catch {
    cookies = '';
  }
  if (cookies.length > 0) {
    let start = cookies.indexOf(name + '=');

    if (start !== -1) {
      start = start + name.length + 1;
      let end = cookies.indexOf(';', start);
      if (end === -1) end = cookies.length;
      return encodeURI(cookies.substring(start, end)).split(',');
    }
  }

  return [];
};

SFLoaderPlugin.prototype.isExistPluginCookie = function (plugin) {
  const arrPluginsCookie = this.getApartCookie('SF_LOADER');

  if (arrPluginsCookie.length > 0) {
    for (let i = 0; i < arrPluginsCookie.length; i++) {
      if (arrPluginsCookie[i] === plugin) {
        return true;
      }
    }
  }

  return false;
};

SFLoaderPlugin.prototype.getFakeTemplates = async function () {
  return null;
};

SFLoaderPlugin.prototype.checkEventsPlugins = function (name) {
  if (this.eventsPlugins.indexOf(name) === -1) {
    this.eventsPlugins.push(name);
  }
};

SFLoaderPlugin.prototype.checkFake = async function () {
  return null;
};

SFLoaderPlugin.prototype.setLocalStorage = function (templates, fake) {
  const data = JSON.stringify({
    templates,
    cache: fake,
  });
  safeSetItem(`SF_SMART_LIST-${this.urlHash}`, encodeCacheValue(data));
};

SFLoaderPlugin.prototype.setCacheContent = async function (templates, fake) {
  this.setLocalStorage(templates, fake);
  return true;
};

function resolveMinified(params = {}) {
  if (typeof params.minified === 'boolean') return params.minified;
  const configured = globalThis.window?.SF_BOOT_CONFIG?.minified;
  if (typeof configured === 'boolean') return configured;
  try {
    if (new URLSearchParams(globalThis.location?.search || '').has('sf-debug')) return false;
  } catch {}
  return !globalThis.document?.documentElement?.hasAttribute?.('data-sf-debug');
}

// x.min.js <-> x.js, x.min.css <-> x.css; null for anything else.
function otherForm(url) {
  const value = String(url || '');
  if (/\.min\.(js|css)(?=$|[?#])/.test(value)) return value.replace(/\.min\.(js|css)(?=$|[?#])/, '.$1');
  if (/\.(js|css)(?=$|[?#])/.test(value)) return value.replace(/\.(js|css)(?=$|[?#])/, '.min.$1');
  return null;
}

function minifiedToReadable(url) {
  const value = String(url || '');
  return /\.min\.(js|css)(?=$|[?#])/.test(value) ? value.replace(/\.min\.(js|css)(?=$|[?#])/, '.$1') : null;
}

SFLoaderPlugin.prototype.isLoaded = function (pluginURL, type) {
  // Either form of a file counts: a page that included the readable file by
  // hand has it, and the Loader must not fetch the minified one beside it.
  for (const url of [pluginURL, otherForm(pluginURL)]) {
    if (!url) continue;
    const selector = type === 'style' ? `link[href*="${url}"]` : `script[src*="${url}"]`;
    if (document.querySelector(selector) !== null) return true;
  }
  return false;
};

/**
 * Проверка и подключение CSS-стилей
 * @param {String} css - путь до подлючаемого файла
 * @param {String} min - путь до подключаемого файла (минимизированный)
 */
// SFLoaderPlugin.prototype.checkLoadStyle = function (css, min) {
//     if (!this.isLoaded(min, 'style') && !this.isLoaded(css, 'style')) {
//         this.addStyle(min)
//     } else if (!this.isLoaded(css, 'style') && !this.isLoaded(min, 'style')) {
//         this.addStyle(css)
//     }
// }

/**
 * Проверка и подключение JS-скриптов
 * @param {String} js - путь до подключаемого файла
 * @param {String} min - путь до подключаемого файла (минимизированный)
 */
// SFLoaderPlugin.prototype.checkLoadJS = function (js, min) {
//     if (!this.isLoaded(min, 'script') && !this.isLoaded(js, 'script')) {
//         this.addScript(min)
//     } else if (!this.isLoaded(min, 'script') && !this.isLoaded(js, 'script')) {
//         this.addScript(js)
//     }
// }

/**
 * Подключение скриптов и стилей
 * @param {String} pluginURL - относительный путь до файла
 * @param {String} pluginName - наименование файла
 * @param {Object} param - параметры
 * @param {String} mode - наименование подключаемого ресурса
 * @returns
 */
// SFLoaderPlugin.prototype.load = function (pluginURL, pluginName, param = false, mode = 'utility') {
//     const urlCss = `${this.frameworkPath}${mode}/${pluginURL}/css/${pluginName}.css`
//     const urlMinCss = `${this.frameworkPath}${mode}/${pluginURL}/css/${pluginName}.min.css`
//     const urlJs = `${this.frameworkPath}${mode}/${pluginURL}/js/${pluginName}.js`
//     const urlMinJs = `${this.frameworkPath}${mode}/${pluginURL}/js/${pluginName}.min.js`

//     if (param.css || param.js) {
//         if (param.css) {
//             this.checkLoadStyle(urlCss, urlMinCss)
//         }

//         if (param.js) {
//             this.checkLoadJS(urlJs, urlMinJs)
//         }
//     } else {
//         this.checkLoadStyle(urlCss, urlMinCss)
//     }

//     return false
// }

/**
 * Поиск
 */

SFLoaderPlugin.prototype.excludedTags = function (tag) {
  return (
      [
        'script',
        'style',
        'yamap',
        'svg',
        'path',
        'g',
        'head',
        'meta',
        'link',
      ].indexOf(tag) === -1
  );
};

const OBSERVER_IGNORE_SELECTOR = '[data-sf-observer="ignore"]';

// The host is checked by the caller, and a rejected node takes its subtree
// with it -- so a node the walker reaches has no ignored ancestor inside the
// host, and needs only its own test, not a `closest()` up to the document for
// every one of a table's two thousand nodes.
SFLoaderPlugin.prototype.createFilteredElementWalker = function (host) {
  return document.createTreeWalker(host, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
        this.shouldSkipOwnNode(node)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
  });
};

SFLoaderPlugin.prototype.shouldSkipOwnNode = function (node) {
  if (!node?.tagName) return true;
  if (node.matches?.(OBSERVER_IGNORE_SELECTOR)) return true;
  return !this.excludedTags(node.tagName.toLowerCase());
};

SFLoaderPlugin.prototype.shouldSkipNode = function (node) {
  if (!node) return true;
  const host =
      node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement || null;
  if (!host || !host.tagName) return true;
  if (
      node.nodeType === Node.COMMENT_NODE &&
      node.nodeValue?.startsWith('sf-shortcode ')
  ) {
    return false;
  }
  if (host.closest?.(OBSERVER_IGNORE_SELECTOR)) return true;
  const tag = host.tagName.toLowerCase();
  if (!this.excludedTags(tag)) return true;
  return false;
};

SFLoaderPlugin.prototype.getRuleRegexSource = function (rule) {
  if (!rule) return '';

  const regex = rule.regex ? rule.regex : rule;
  if (regex instanceof RegExp) return regex.source;
  if (typeof regex === 'string') return regex;

  return '';
};

SFLoaderPlugin.prototype.extractRuleAttributeTargets = function (rule) {
  const source = this.getRuleRegexSource(rule);
  const attrs = new Set();
  const prefixes = new Set();

  if (!source) {
    return { attrs, prefixes };
  }

  if (
      rule instanceof RegExp ||
      typeof rule === 'string' ||
      /class|\\b|\\s|\(\?:\^\|\\s\)|sf-|[a-z0-9_-]+:/i.test(source)
  ) {
    attrs.add('class');
  }

  const dataMatches = source.match(/data-[a-z0-9_]+(?:-[a-z0-9_]+)*/gi) || [];
  dataMatches.forEach((attr) => {
    const normalized = attr.toLowerCase();
    attrs.add(normalized);
    if (source.includes(`${attr}-`)) {
      prefixes.add(`${normalized}-`);
    }
  });

  ['id', 'href', 'src', 'type', 'name', 'role', 'for'].forEach((attr) => {
    if (new RegExp(`(^|[^a-z0-9_-])${attr}([^a-z0-9_-]|$)`, 'i').test(source)) {
      attrs.add(attr);
    }
  });

  return { attrs, prefixes };
};

SFLoaderPlugin.prototype.extractRuleClassHints = function (rule) {
  const source = this.getRuleRegexSource(rule)
      .replace(/\\b/g, ' ')
      .replace(/\\:/g, ':')
      .replace(/\\-/g, '-');

  if (!source) {
    return [];
  }

  const hints = new Set();
  const alternationPrefixMatches = source.matchAll(
      /([a-z0-9]+:)?\(\?:([a-z0-9_|:-]+)\)-/gi,
  );

  for (const match of alternationPrefixMatches) {
    const variantPrefix = (match[1] || '').toLowerCase();
    const variants = String(match[2] || '')
        .split('|')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

    variants.forEach((variant) => {
      hints.add(`${variantPrefix}${variant}-`);
    });
  }

  const literalMatches = source.match(/[a-z][a-z0-9_:-]{2,}/gi) || [];
  literalMatches.forEach((match) => {
    const hint = match.toLowerCase();
    if (
        [
          'class',
          'data',
          'regex',
          'true',
          'false',
          'component',
          'default',
        ].includes(hint)
    ) {
      return;
    }
    hints.add(hint);
  });

  const prefixMatches = source.match(/[a-z0-9]+(?::)?-/gi) || [];
  prefixMatches.forEach((match) => hints.add(match.toLowerCase()));

  return [...hints].filter((hint) => hint.length > 1);
};

SFLoaderPlugin.prototype.doesClassRuleMatchHints = function (
    indexedRule,
    className = '',
) {
  const hints = indexedRule.classHints || [];
  if (!hints.length) return true;

  const normalizedClassName = ` ${String(className).toLowerCase()} `;
  const tokens = String(className)
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

  return hints.some((hint) => {
    if (hint.endsWith('-') || hint.endsWith(':')) {
      return tokens.some((token) => token.startsWith(hint));
    }

    return (
        normalizedClassName.includes(` ${hint} `) ||
        tokens.some((token) => token.startsWith(`${hint}-`))
    );
  });
};

SFLoaderPlugin.prototype.shouldUseClassFallbackRule = function (rule) {
  const source = this.getRuleRegexSource(rule);
  if (!source) return false;

  return /\\b|\\s|\(\?:|\||\[[^\]]|\^|\$|\(\?=|\(\?!/.test(source);
};

SFLoaderPlugin.prototype.getAttributeRuleIndex = function () {
  if (this.attributeRuleIndex) {
    return this.attributeRuleIndex;
  }

  const byAttr = new Map();
  const byClassHint = new Map();
  const classPrefixRules = [];
  const classFallback = [];
  const prefixRules = [];
  const fallback = [];

  Object.entries(this.findPlugins || {}).forEach(([key, rule]) => {
    const hasRegex =
        rule instanceof RegExp ||
        typeof rule === 'string' ||
        (rule && typeof rule === 'object' && rule.regex);
    if (!hasRegex || this.module[key]) return;

    const indexedRule = {
      key,
      rule,
      classHints: this.extractRuleClassHints(rule),
    };
    const { attrs, prefixes } = this.extractRuleAttributeTargets(rule);
    const useClassFallback =
        attrs.has('class') && this.shouldUseClassFallbackRule(rule);

    if (!attrs.size && !prefixes.size) {
      fallback.push(indexedRule);
      return;
    }

    attrs.forEach((attr) => {
      if (!byAttr.has(attr)) {
        byAttr.set(attr, []);
      }
      byAttr.get(attr).push(indexedRule);

      if (attr === 'class') {
        if (useClassFallback) {
          classFallback.push(indexedRule);
          return;
        }

        indexedRule.classHints.forEach((hint) => {
          if (hint.endsWith('-') || hint.endsWith(':')) {
            classPrefixRules.push({ prefix: hint, indexedRule });
            return;
          }

          if (!byClassHint.has(hint)) {
            byClassHint.set(hint, []);
          }
          byClassHint.get(hint).push(indexedRule);
        });
      }
    });

    prefixes.forEach((prefix) => {
      prefixRules.push({ prefix, indexedRule });
    });
  });

  this.attributeRuleIndex = {
    byAttr,
    byClassHint,
    classPrefixRules,
    classFallback,
    prefixRules,
    fallback,
  };
  return this.attributeRuleIndex;
};

SFLoaderPlugin.prototype.clearAttributeRuleIndex = function () {
  this.attributeRuleIndex = null;
};

SFLoaderPlugin.prototype.shouldRuleUseRegexpScan = function (rule) {
  if (!rule) return false;
  if (rule.tags) return false;

  const source = this.getRuleRegexSource(rule);
  if (!source) return false;

  if (/data-[a-z0-9_]+(?:-[a-z0-9_]+)*/i.test(source)) {
    return true;
  }

  if (/</.test(source)) {
    return true;
  }

  return false;
};

SFLoaderPlugin.prototype.getRegexpScanRules = function () {
  if (!this.regexpScanRules) {
    this.regexpScanRules = Object.entries(SF.RuleLoader || {}).filter(
        ([, rule]) => this.shouldRuleUseRegexpScan(rule),
    );
  }

  return this.regexpScanRules.filter(([key]) => !this.module[key]);
};

SFLoaderPlugin.prototype.clearRegexpScanRules = function () {
  this.regexpScanRules = null;
};

SFLoaderPlugin.prototype.doesRuleMatchAttributes = function (
    rule,
    attributeString,
    className = '',
) {
  const regex = rule?.regex ? rule.regex : rule;
  const re =
      regex instanceof RegExp ? regex : new RegExp(regex, regex?.flags || '');
  const test = (value) => {
    if (re.global || re.sticky) re.lastIndex = 0;
    return re.test(value);
  };

  if (test(attributeString)) return true;

  return String(className)
      .split(/\s+/)
      .filter(Boolean)
      .some((token) => test(token));
};

SFLoaderPlugin.prototype.hasRelevantRuleAttributes = function (el) {
  if (!el || !el.getAttributeNames) return false;

  const attributeRuleIndex = this.getAttributeRuleIndex();
  const attrs = el.getAttributeNames();

  for (let index = 0; index < attrs.length; index++) {
    const attrName = attrs[index].toLowerCase();

    if (
        attrName === 'class' &&
        el.getAttribute('class') &&
        (attributeRuleIndex.byClassHint.size ||
            attributeRuleIndex.classPrefixRules.length ||
            attributeRuleIndex.classFallback.length)
    ) {
      return true;
    }

    if (attributeRuleIndex.byAttr.has(attrName)) {
      return true;
    }

    if (
        attributeRuleIndex.prefixRules.some(({ prefix }) =>
            attrName.startsWith(prefix),
        )
    ) {
      return true;
    }

    if (attributeRuleIndex.fallback.length) {
      return true;
    }
  }

  return false;
};

SFLoaderPlugin.prototype.getAttributes = function (HtmlElement) {
  const profile = this.profileStart('getAttributes');
  const arr = [];
  const keys = [];
  let totalItemCount = 0;
  const isIcon = HtmlElement.classList?.contains('sf-icon');
  if (isIcon && !HtmlElement.closest?.('sf-icon')) {
    this.trackIconComponent(HtmlElement);
  }
  const attributes = HtmlElement.getAttributeNames();
  if (attributes.length) {
    for (const key in attributes) {
      const attrName = attributes[key];
      const value = HtmlElement.getAttribute(attrName);
      let nextValue = value;
      if (attrName === 'class' && value) {
        const converted = convertTailwindClasses(value);
        if (converted !== value) {
          HtmlElement.setAttribute('class', converted);
          nextValue = converted;
        }
      }
      arr.push(`${attrName}="${nextValue}"`);
    }
  }
  const stringRaw = arr.join(' ');
  const string = stringRaw.length > 2048 ? stringRaw.slice(0, 2048) : stringRaw;
  const result = {
    keys,
    count: totalItemCount,
  };

  if (!string) {
    this.attrMatchCache.set(string, result);
    this.profileEnd(profile, {
      cacheHit: false,
      attributeCount: attributes.length,
      candidates: 0,
      found: totalItemCount,
      tagName: HtmlElement.tagName?.toLowerCase?.(),
    });
    return result;
  }

  // cache hit
  if (this.attrMatchCache.has(string)) {
    const cached = this.attrMatchCache.get(string);
    cached.keys.forEach((k) => this.setExistCookie(k));
    this.profileEnd(profile, {
      cacheHit: true,
      attributeCount: attributes.length,
      found: cached.count,
      tagName: HtmlElement.tagName?.toLowerCase?.(),
    });
    return cached;
  }

  const attributeRuleIndex = this.getAttributeRuleIndex();
  const candidates = new Map();
  const className = HtmlElement.getAttribute('class') || '';
  attributes.forEach((attrName) => {
    const normalizedAttrName = attrName.toLowerCase();
    if (normalizedAttrName === 'class') {
      const classTokens = className
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);

      classTokens.forEach((token) => {
        const exactRules = attributeRuleIndex.byClassHint.get(token) || [];
        exactRules.forEach((item) => candidates.set(item.key, item.rule));

        attributeRuleIndex.classPrefixRules.forEach(
            ({ prefix, indexedRule }) => {
              if (token.startsWith(prefix)) {
                candidates.set(indexedRule.key, indexedRule.rule);
              }
            },
        );
      });
      attributeRuleIndex.classFallback.forEach((item) => {
        candidates.set(item.key, item.rule);
      });
    } else {
      const attrRules = attributeRuleIndex.byAttr.get(normalizedAttrName) || [];
      attrRules.forEach((item) => candidates.set(item.key, item.rule));
    }

    attributeRuleIndex.prefixRules.forEach(({ prefix, indexedRule }) => {
      if (normalizedAttrName.startsWith(prefix)) {
        candidates.set(indexedRule.key, indexedRule.rule);
      }
    });
  });

  attributeRuleIndex.fallback.forEach((item) => {
    candidates.set(item.key, item.rule);
  });

  for (const [key, rule] of candidates) {
    if (this.module[key]) continue;
    const hasRegex =
        rule instanceof RegExp ||
        typeof rule === 'string' ||
        (rule && typeof rule === 'object' && rule.regex);
    if (!hasRegex) continue;

    const match = this.doesRuleMatchAttributes(rule, string, className);
    if (match && !this.module[key]) {
      keys.push(key);
      totalItemCount++;
      this.setExistCookie(key);
    }
  }
  result.count = totalItemCount;
  this.attrMatchCache.set(string, result);
  this.profileEnd(profile, {
    cacheHit: false,
    attributeCount: attributes.length,
    candidates: candidates.size,
    found: totalItemCount,
    tagName: HtmlElement.tagName?.toLowerCase?.(),
  });
  return result;
};

// A Smart tag is one a rule claims. The Framework's own are sf- names; a
// component package may name its elements with its owner's prefix (standard
// simai.component-package, own-element-prefix), and the rule it registers is
// where it says so -- every rule lists its tags. Only a package rule may claim a
// tag outside sf-, so the Framework's names stay its own (owner, 2026-10-12;
// before that the Loader skipped every other tag and a package element with its
// own prefix never loaded).
const CUSTOM_ELEMENT_NAME = /^[a-z][a-z0-9]*-[a-z0-9-]*$/;

function isClaimableTag(tagName, rule) {
  if (tagName.startsWith('sf-')) return true;
  return Boolean(rule?.package) && CUSTOM_ELEMENT_NAME.test(tagName);
}

SFLoaderPlugin.prototype.getCustomElementRules = function () {
  const tagRules = {};

  Object.entries(this.findPlugins || {}).forEach(([componentName, rule]) => {
    if (!rule || typeof rule !== 'object' || !Array.isArray(rule.tags)) return;

    rule.tags.forEach((tagName) => {
      const normalizedTag = String(tagName || '')
          .trim()
          .toLowerCase();

      if (!isClaimableTag(normalizedTag, rule)) return;
      tagRules[normalizedTag] = componentName;
    });
  });

  return tagRules;
};

SFLoaderPlugin.prototype.getSmartElementRuleName = function (el) {
  const tagName = el?.tagName?.toLowerCase?.() || '';
  if (!tagName.includes('-')) {
    return '';
  }

  return this.getCustomElementRules()[tagName] || '';
};

SFLoaderPlugin.prototype.findNearestSmartParent = function (el) {
  let parent = el?.parentElement || null;

  while (parent) {
    if (this.getSmartElementRuleName(parent)) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return null;
};

SFLoaderPlugin.prototype.shouldDeferNestedSmartElement = function (el) {
  if (!this.getSmartElementRuleName(el)) {
    return false;
  }

  const parentSmart = this.findNearestSmartParent(el);
  if (!parentSmart) {
    return false;
  }

  return parentSmart.__sfSourceCaptured !== true;
};

SFLoaderPlugin.prototype.prepareSmartChildScanEvents = function () {
  if (this.smartChildScanEventsBound) {
    return;
  }

  this.smartChildScanEventsBound = true;

  document.addEventListener('sf-after-render', (event) => {
    const target = event.target;

    if (!(target instanceof Element) || !this.getSmartElementRuleName(target)) {
      return;
    }

    this.scanCustomElements(target, true);
  });
};

SFLoaderPlugin.prototype.scanCustomElements = function (
    root = null,
    autoLoad = true,
    {subtree = true} = {},
) {
  const profile = this.profileStart('scanCustomElements');
  const host = root || document.body;
  if (!host) {
    this.profileEnd(profile, { skipped: true, reason: 'empty-host' });
    return { keys: [], count: 0 };
  }
  if (host.nodeType === Node.ELEMENT_NODE && this.shouldSkipNode(host)) {
    this.profileEnd(profile, { skipped: true, reason: 'ignored-host' });
    return { keys: [], count: 0 };
  }

  const tagRules = this.getCustomElementRules();
  const knownTags = Object.keys(tagRules);
  if (!knownTags.length) {
    this.profileEnd(profile, { skipped: true, reason: 'empty-tag-rules' });
    return { keys: [], count: 0 };
  }

  const keys = [];
  let totalItemCount = 0;
  let iconItemCount = 0;
  let scannedNodes = 0;

  const processNode = (el, filtered = false) => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE || (!filtered && this.shouldSkipNode(el))) {
      return;
    }
    scannedNodes++;

    const tagName = el.tagName?.toLowerCase?.();
    if (!tagName || !tagName.includes('-')) {
      return;
    }

    const componentName = tagRules[tagName];
    if (componentName === 'cl-icons') {
      iconItemCount += this.trackIconElement(el);
    }
    if (
        !componentName ||
        this.module[componentName] ||
        this.shouldDeferNestedSmartElement(el)
    ) {
      return;
    }

    keys.push(componentName);
    totalItemCount++;
    this.setExistCookie(componentName);
  };

  if (host.nodeType === Node.ELEMENT_NODE) {
    processNode(host);
  }

  if (subtree) {
    const walker = this.createFilteredElementWalker(host);
    while (walker.nextNode()) {
      processNode(walker.currentNode, true);
    }
  }

  const result = this.handleCustomElementScanResult(
      { keys, count: totalItemCount, iconCount: iconItemCount },
      autoLoad,
  );
  this.profileEnd(profile, {
    scannedNodes,
    found: totalItemCount,
    icons: iconItemCount,
    autoLoad,
    root: host === document.body ? 'body' : host.tagName?.toLowerCase?.(),
  });
  return result;
};

SFLoaderPlugin.prototype.scanAttributes = function (root = null) {
  const profile = this.profileStart('scanAttributes');
  const host = root || document.body;
  if (!host) {
    this.profileEnd(profile, { skipped: true, reason: 'empty-host' });
    return { keys: [], count: 0 };
  }
  if (host.nodeType === Node.ELEMENT_NODE && this.shouldSkipNode(host)) {
    this.profileEnd(profile, { skipped: true, reason: 'ignored-host' });
    return { keys: [], count: 0 };
  }
  const keys = [];
  let totalItemCount = 0;
  let scannedNodes = 0;
  let skippedNodes = 0;
  const processNode = (el) => {
    if (this.shouldSkipNode(el)) return;
    if (!this.hasRelevantRuleAttributes(el)) {
      skippedNodes++;
      return;
    }
    scannedNodes++;
    const result = this.getAttributes(el);
    totalItemCount += result.count;
    keys.push(...result.keys);
  };

  if (host.nodeType === Node.ELEMENT_NODE) {
    processNode(host);
  }

  const walker = this.createFilteredElementWalker(host);
  while (walker.nextNode()) {
    processNode(walker.currentNode);
  }

  if (totalItemCount > 0) {
    this.mutate(() => this.getLoader(this.module, true));
  }
  this.profileEnd(profile, {
    scannedNodes,
    skippedNodes,
    found: totalItemCount,
    root: host === document.body ? 'body' : host.tagName?.toLowerCase?.(),
  });
  return { keys, count: totalItemCount };
};

SFLoaderPlugin.prototype.scanDom = function (root = null, autoLoad = true) {
  const profile = this.profileStart('scanDom');
  const host = root || document.body;
  if (!host) {
    this.profileEnd(profile, { skipped: true, reason: 'empty-host' });
    return {
      custom: { keys: [], count: 0, iconCount: 0 },
      attributes: { keys: [], count: 0 },
      icons: { iconCount: 0 },
    };
  }
  if (host.nodeType === Node.ELEMENT_NODE && this.shouldSkipNode(host)) {
    this.profileEnd(profile, { skipped: true, reason: 'ignored-host' });
    return {
      custom: { keys: [], count: 0, iconCount: 0 },
      attributes: { keys: [], count: 0 },
      icons: { iconCount: 0 },
    };
  }

  const tagRules = this.getCustomElementRules();
  const customKeys = [];
  const attributeKeys = [];
  let customCount = 0;
  let attributeCount = 0;
  let customIconCount = 0;
  let staticIconCount = 0;
  let scannedNodes = 0;
  let attributeScannedNodes = 0;
  let attributeSkippedNodes = 0;

  const processNode = (el) => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE || this.shouldSkipNode(el)) {
      return;
    }
    scannedNodes++;

    const tagName = el.tagName?.toLowerCase?.();
    if (tagName?.includes('-')) {
      const componentName = tagRules[tagName];
      if (componentName === 'cl-icons') {
        customIconCount += this.trackIconElement(el);
      }
      if (
          componentName &&
          !this.module[componentName] &&
          !this.shouldDeferNestedSmartElement(el)
      ) {
        customKeys.push(componentName);
        customCount++;
        this.setExistCookie(componentName);
      }
    }

    if (el.classList?.contains('sf-icon') && !el.closest?.('sf-icon')) {
      staticIconCount += this.trackIconComponent(el);
    }

    if (this.hasRelevantRuleAttributes(el)) {
      attributeScannedNodes++;
      const attrResult = this.getAttributes(el);
      attributeCount += attrResult.count;
      attributeKeys.push(...attrResult.keys);
    } else {
      attributeSkippedNodes++;
    }
  };

  if (host.nodeType === Node.ELEMENT_NODE) {
    processNode(host);
  }

  const walker = this.createFilteredElementWalker(host);
  while (walker.nextNode()) {
    processNode(walker.currentNode);
  }

  const customResult = this.handleCustomElementScanResult(
      { keys: customKeys, count: customCount, iconCount: customIconCount },
      autoLoad,
  );

  if (attributeCount > 0 && autoLoad) {
    this.mutate(() => this.getLoader(this.module, true));
  }

  if (autoLoad && staticIconCount > 0) {
    this.mutate(() => this.loadFonts());
  }

  const result = {
    custom: customResult,
    attributes: {
      keys: attributeKeys,
      count: attributeCount,
    },
    icons: {
      iconCount: staticIconCount,
    },
  };

  this.profileEnd(profile, {
    scannedNodes,
    customFound: customCount,
    attributeFound: attributeCount,
    customIcons: customIconCount,
    staticIcons: staticIconCount,
    attributeScannedNodes,
    attributeSkippedNodes,
    root: host === document.body ? 'body' : host.tagName?.toLowerCase?.(),
  });

  return result;
};

SFLoaderPlugin.prototype.getMutationNodeHost = function (node) {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE
      ? node
      : node.parentElement || null;
};

SFLoaderPlugin.prototype.doesMutationRootCoverNode = function (root, node) {
  if (!root || !node) return false;
  if (root === node) return true;

  const rootHost = this.getMutationNodeHost(root);
  const nodeHost = this.getMutationNodeHost(node);

  if (!rootHost || !nodeHost) return false;
  if (root.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  return rootHost.contains(nodeHost);
};

// Whether a node is one of the roots or inside one: up the parents, a few
// steps, instead of asking every root -- a list re-rendered adds hundreds of
// roots, and asking each of them about each of the others was a hundred
// thousand `contains` calls for one search (rules of the road, 2026-10-15).
SFLoaderPlugin.prototype.isCoveredByMutationRoots = function (node, rootSet, {self = true} = {}) {
  if (!node || !rootSet.size) return false;
  if (self && rootSet.has(node)) return true;
  let parent = node.parentNode;
  while (parent) {
    if (rootSet.has(parent)) return true;
    parent = parent.parentNode;
  }
  return false;
};

SFLoaderPlugin.prototype.collectUniqueAddedMutationRoots = function (
    changeList = [],
) {
  const candidates = new Set();

  for (let index = 0; index < changeList.length; index++) {
    const change = changeList[index];
    if (!change || change.type !== 'childList' || !change.addedNodes?.length) {
      continue;
    }

    for (let nodeIndex = 0; nodeIndex < change.addedNodes.length; nodeIndex++) {
      const node = change.addedNodes[nodeIndex];
      if (!node || this.shouldSkipNode(node)) continue;
      candidates.add(node);
    }
  }

  // A root inside another root is scanned with it.
  return [...candidates].filter((node) => !this.isCoveredByMutationRoots(node, candidates, {self: false}));
};

SFLoaderPlugin.prototype.search = function () {
  const output2 = [];
  let totalItemCount = 0;
  const newPlugins = [];
  const _this = this;
  const output = {
    utility: {},
    component: {},
    smart: {},
    relation: {},
  };

  let mutationBuffer = [];
  let debounceTimer = null;
  const DEBOUNCE_MS = 100;
  const processChanges = (changeList) => {
    if (this.stopObserver) {
      return false;
    }
    const profile = this.profileStart('MutationObserver.processChanges');
    const addedRoots = this.collectUniqueAddedMutationRoots(changeList);
    const addedRootSet = new Set(addedRoots);
    let processedAddedRoots = 0;
    let processedAttributeTargetsCount = 0;
    const processAddedNode = (objHTML) => {
      if (this.shouldSkipNode(objHTML)) return;
      processedAddedRoots++;
      this.findShortCodes(objHTML);
      const customScan = this.scanCustomElements(objHTML, false);
      if (customScan.count > 0) {
        totalItemCount += customScan.count;
        newPlugins.push(...customScan.keys);
      }
      this.trackPendingIconScan(customScan);
      this.trackPendingIconScan(this.scanStaticIcons(objHTML, false));

      if (!objHTML || objHTML.nodeType === 3 || !objHTML.tagName) {
        return;
      }

      const nodes = [objHTML, ...objHTML.querySelectorAll('*')];
      nodes.forEach((el) => {
        if (this.shouldSkipNode(el)) return;
        if (!el.tagName || !this.excludedTags(el.tagName.toLowerCase())) {
          return;
        }
        const { count, keys } = this.getAttributes(el, output, output2);
        totalItemCount += count;
        newPlugins.push(...keys);
      });
    };

    addedRoots.forEach(processAddedNode);

    const processedAttributeTargets = new Set();

    for (let o = 0; o < changeList.length; o++) {
      const change = changeList[o];

      if (
          this.isSyncingStaticIconState &&
          change.type === 'attributes' &&
          change.attributeName === 'class'
      ) {
        continue;
      }
      if (this.shouldSkipNode(change.target)) continue;
      switch (change.type) {
        case 'childList': {
          const staticIconMutation = this.processStaticIconMutation(
            change.target,
            false,
          );
          if (staticIconMutation.handled) {
            this.trackPendingIconScan(staticIconMutation);
            break;
          }

          break;
        }
        case 'characterData': {
          const staticIconMutation = this.processStaticIconMutation(
            change.target,
            false,
          );
          if (staticIconMutation.handled) {
            this.trackPendingIconScan(staticIconMutation);
          }
          break;
        }
        case 'attributes': {
          if (
              processedAttributeTargets.has(change.target) ||
              this.isCoveredByMutationRoots(change.target, addedRootSet)
          ) {
            continue;
          }
          processedAttributeTargets.add(change.target);
          processedAttributeTargetsCount++;

          const staticIconMutation = this.processStaticIconMutation(
            change.target,
            false,
          );
          if (staticIconMutation.handled) {
            this.trackPendingIconScan(staticIconMutation);
            continue;
          }

          // An attribute changes the element, not what is inside it: its
          // children were scanned when they were added, and stay as they were.
          // Only the ignore marker opens a subtree that was not scanned. Scanning
          // everything below for any attribute made a table's «loading» mark a
          // walk over its two thousand nodes, several times a search.
          const opensSubtree = change.attributeName === 'data-sf-observer';
          const customScan = this.scanCustomElements(change.target, false, {subtree: opensSubtree});
          this.trackPendingIconScan(customScan);
          if (opensSubtree) this.trackPendingIconScan(this.scanStaticIcons(change.target, false));

          const { count, keys } = this.getAttributes(
              change.target,
              output,
              output2,
          );
          totalItemCount += count;
          newPlugins.push(...keys);
          break;
        }
        default:
          console.warn(`action - ${change.type}`);
          break;
      }
    }
    const hasModuleLoads = totalItemCount > 0;
    if (totalItemCount > 0) {
      this.mutate(() => this.getLoader(this.module, true));
      totalItemCount = 0;
    }
    this.flushPendingIconScan({ defer: hasModuleLoads });
    this.profileEnd(profile, {
      mutations: changeList.length,
      addedRoots: addedRoots.length,
      processedAddedRoots,
      processedAttributeTargets: processedAttributeTargetsCount,
      newPlugins: newPlugins.length,
      hasModuleLoads,
    });
  };

  const callback = (changes) => {
    if (this.stopObserver) {
      mutationBuffer = [];
      clearTimeout(debounceTimer);
      return;
    }

    const relevantChanges = changes.filter((change) => {
      if (change.type !== 'characterData') {
        return true;
      }

      return Boolean(this.getStaticIconElement(change.target));
    });

    if (!relevantChanges.length) {
      return;
    }

    if (_this.searchEnd) {
      mutationBuffer.push(...relevantChanges);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const bufferedChanges = [...mutationBuffer];
        mutationBuffer = [];
        processChanges(bufferedChanges);
      }, DEBOUNCE_MS);
    } else {
      _this.observeElements.push(...relevantChanges);
    }
  };

  // Changes met while the search was still running wait in observeElements;
  // they are processed when it ends, not dropped.
  this.flushObservedChanges = () => {
    if (!_this.observeElements.length) return;
    processChanges(_this.observeElements.splice(0));
  };
  this.mutationObserver = new MutationObserver(callback);
  const options = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  };
  this.mutationObserver.observe(document.documentElement, options);

  if (output2.length) {
    this.getLoader(output2);
  }
};

SFLoaderPlugin.prototype.setExistCookie = function (
    name,
    output = null,
    output2 = null,
) {
  name = resolveUtilityModule(
      name,
      utilityModuleAliases.aliases,
      this.findPlugins,
      this.productionPlanActive,
  );
  // A package rule without a usable base is not marked for loading at all; the
  // warning names it, and nothing is fetched from the Smart base in its place.
  if (!this.isPluginResolvable(name)) {
    return;
  }
  let mode;
  const param =
      this.findPlugins[name] && typeof this.findPlugins[name] === 'object'
          ? this.findPlugins[name]
          : false;
  const pluginName = this.getPluginName(name + '/');

  if (this.findPlugins[name].type === 'attribute') {
    mode = 'component';
  } else if (this.findPlugins[name].type === 'component') {
    mode = 'component';
  } else if (this.findPlugins[name].type === 'smart') {
    mode = 'smart';
  } else {
    mode = 'utility';
  }
  if (output) {
    output[mode][name] = {};
  }
  // A Smart component's templates draw with utility classes; they are its
  // relations too, so they are asked for in the wave that asks for the
  // component instead of after it has rendered (scripts/
  // generate-template-utilities.mjs; simai.interaction-rules,
  // assets-asked-together).
  const drawnWith = mode === 'smart'
      ? (templateUtilities[name] || []).map((key) => ({name: key}))
      : [];
  const relations = [...(param && Array.isArray(param.relation) ? param.relation : []), ...drawnWith];
  if (relations.length) {
    this.setRelation(relations, name, output);
  }
  if (output) {
    if (param) {
      for (const key in param) {
        if (key !== 'regex') {
          output[mode][name][key] = param[key];
        }
      }
    }

    output[mode][name].url = name;
    output[mode][name].name = pluginName;
  }
  if (output2) {
    output2.push(name);
  }
  this.setModule(name);
};
SFLoaderPlugin.prototype.setRelation = function (
    relation,
    name,
    output,
    visited = new Set(),
) {
  if (!Array.isArray(relation) || visited.has(name)) {
    return;
  }
  visited.add(name);

  relation.forEach((rel) => {
    if (!rel?.name || !this.isPluginResolvable(rel.name)) {
      return;
    }
    // A lazy relation is something a component may render later -- a filter
    // editor, a date picker, a cell renderer for a type the page may not hold.
    // It does not hold up the page: it is fetched once the page is ready, in
    // the browser's idle time, or at once when it is asked for (2026-10-12;
    // the table's editors were a third of the admin's script at boot).
    if (rel.lazy === true) {
      this.lazyRelations.add(rel.name);
      return;
    }

    const relationRule = this.findPlugins?.[rel.name] || {};
    const relationModule =
        rel.mode ||
        (relationRule.type === 'smart'
            ? 'smart'
            : relationRule.type === 'component' || relationRule.type === 'attribute'
                ? 'component'
                : 'utility');

    if (!this.relationPlugins[name]) {
      this.relationPlugins[name] = [rel.name];
    } else if (!this.relationPlugins[name].includes(rel.name)) {
      this.relationPlugins[name].push(rel.name);
    }
    if (!this.pluginListRelation.includes(rel.name)) {
      this.pluginListRelation.push(rel.name);
    }
    if (!this.module[rel.name]) {
      if (output) {
        const targetOutput = output[relationModule] || output.relation;
        targetOutput[rel.name] = {};
        targetOutput[rel.name].url = rel.name;
        targetOutput[rel.name].name = rel.name;
      }
      this.setModule(rel.name);
    }
    if (Array.isArray(relationRule.relation)) {
      this.setRelation(relationRule.relation, rel.name, output, visited);
    }
  });
};

SFLoaderPlugin.prototype.sortPlugins = function (
    module,
    arPathCss,
    arPathJs,
    plugin,
) {
  const breakpoints = [
    'default',
    'sm',
    'md',
    'lg',
    'xl',
    'xxl',
    'hover',
    'focus',
    'focus-visible',
    'active',
  ];

  for (const point of breakpoints) {
    this.sortPlugin(plugin[point] || [], point, module, arPathCss, arPathJs);
  }
};

SFLoaderPlugin.prototype.pathPluginJs = function (name, smart, point, type) {
  let pathPlugin;

  if (smart) {
    const base = this.resolveSmartBase(name);
    if (base === null) return null;
    // A Smart bundle is built against the shared runtime; it is asked for now,
    // so it arrives with the first bundle rather than after it.
    globalThis.SF?.loadRuntime?.();
    name = name.substring(3);
    pathPlugin = `${base}/${name}`;
  } else {
    pathPlugin = `${type === 'component' ? this.componentPath : this.utilyPath}/${name}`;
  }

  // A component's or Smart element's script has a minified twin; a utility's
  // script does not, and keeps its readable name.
  const file = type === 'component' || smart ? name : point;
  return `${pathPlugin}/js/${file}${this.minified && (type === 'component' || smart) ? '.min' : ''}.js`;
};

SFLoaderPlugin.prototype.pathPluginCss = function (name, type, point) {
  let url = '';
  switch (type) {
    case 'component':
      url += this.componentPath;
      break;
    case 'smart': {
      const base = this.resolveSmartBase(name);
      if (base === null) return null;
      url += base;
      name = name.substring(3);
      break;
    }
    default:
      url += this.utilyPath;
      break;
  }


  return `${url}/${name}/css/${['component','smart'].includes(type) ? name : point}${this.minified ? '.min' : ''}.css`;
};

SFLoaderPlugin.prototype.shouldSkipPluginCss = function (
    pluginName,
    module = {},
) {
  const ruleMeta = SF.RuleLoader?.[pluginName] || {};
  const moduleConfig =
      module && typeof module === 'object' ? module : { type: module };
  const moduleType = moduleConfig.type || module;
  const ruleType = ruleMeta.type || '';
  const moduleMode = moduleConfig.mode || '';
  const ruleMode = ruleMeta.mode || '';
  const isSmart =
      moduleType === 'smart' ||
      ruleType === 'smart' ||
      moduleMode === 'smart' ||
      ruleMode === 'smart';

  if (moduleConfig.css === false || ruleMeta.css === false) {
    return true;
  }

  if (isSmart) {
    return moduleConfig.css !== true && ruleMeta.css !== true;
  }

  return false;
};

SFLoaderPlugin.prototype.loadPlugin = function (
    pluginName,
    smart,
    point,
    module,
    plugins,
) {
  if (this.disableSmart && (module === 'smart' || smart)) {
    return;
  }
  // A cached plugin list reaches here without passing setExistCookie, so the
  // package check is repeated rather than trusted.
  if (!this.isPluginResolvable(pluginName)) {
    return;
  }
  const missKey = this.getMissingFileKey(pluginName);
  const ruleMeta = SF.RuleLoader?.[pluginName];
  const skipJs =
      typeof ruleMeta?.js === 'undefined' ||
      (module && module.js === false) ||
      ruleMeta?.js === false;
  const skipCss = this.shouldSkipPluginCss(pluginName, module);
  const jsFile = skipJs
      ? null
      : this.pathPluginJs(pluginName, smart, point, module);
  if (
      (!skipJs && !this.notFoundFiles[missKey]) ||
      (this.notFoundFiles[missKey] && !this.notFoundFiles[missKey].js)
  ) {
    if (!this.pendingLoadPlugins.has(pluginName)) {
      this.pendingLoadPlugins.add(pluginName);
    }
    if (this.relationPlugins[pluginName]) {
      this.loadRelationPlugins(
          pluginName,
          plugins,
          module,
          point,
          jsFile,
          skipJs,
      );
    } else {
      this.isRelationPlugin(pluginName, jsFile, smart, point, module, skipJs);
    }
  } else if (skipJs) {
    if (this.relationPlugins[pluginName]) {
      this.loadRelationPlugins(
          pluginName,
          plugins,
          module,
          point,
          jsFile,
          true,
      );
    } else {
      this.isRelationPlugin(pluginName, null, smart, point, module, true);
    }
  }
  if (!skipCss) {
    if (
        !this.notFoundFiles[missKey] ||
        (this.notFoundFiles[missKey] &&
            (!this.notFoundFiles[missKey].css ||
                !this.notFoundFiles[missKey].missingMin))
    ) {

      const cssFile = this.pathPluginCss(pluginName, module, point);
      if (module === 'component' || module === 'smart') {
        this.checkEventsPlugins(pluginName);
      }
      if (!this.resolverAll[cssFile]) {
        this.resolverAll[cssFile] = this.addStyle(`${cssFile}`)
            .then(() => {
              this.loadedPlugins[pluginName].css = true;
            })
            .catch(() => {
              this.addToMissingFiles(pluginName, 'css', false);
              // The other form of the file: the readable one when the minified
              // was asked for and is missing, the minified one otherwise.
              const min = otherForm(cssFile);
              this.resolverAll[min] = this.addStyle(`${min}`)
                  .then(() => {
                    this.loadedPlugins[pluginName].minCss = true;
                  })
                  .catch((e) => {
                    console.warn(e);
                    this.addToMissingFiles(pluginName, 'css', true);
                  });
            });
      }
    }
  }
};
SFLoaderPlugin.prototype.loadRelationPlugins = function (
    name,
    plugins,
    module,
    point,
    jsFile,
    skipJs = false,
) {
  if (!this.totalRelationsPlugins[name]) {
    this.totalRelationsPlugins[name] = {
      load: 0,
      total: this.relationPlugins[name].length,
      canLoad: false,
      jsFile,
      skipJs,
      completed: {},
    };
    // An element waits for its relations before its script runs, and it used
    // to wait for them before its script was even asked for: the admin's
    // table was fetched after its relations had run, and the data view after
    // the table (2026-10-13). The browser is told about the script now; it
    // still runs after the relations, from the cache.
    if (!skipJs && jsFile) this.preloadScript(jsFile);
  }
  if (this.totalRelationsPlugins[name].canLoad) {
    if (this.totalRelationsPlugins[name].skipJs || !jsFile) {
      if (!this.loadedPlugins[name]) {
        this.loadedPlugins[name] = {};
      }
      this.loadedPlugins[name].js = false;
      this.loadedPlugins[name].ready = true;
      return;
    }
    if (module === 'component' || module === 'smart') {
      this.checkEventsPlugins(name);
    }
    this.resolverAll[jsFile] = this.addScript(`${jsFile}`)
        .then(() => {
          this.loadedPlugins[name].js = true;
          return this.awaitPluginAssetsReady(
              name,
              module === 'smart',
              point,
              module,
          );
        })
        .catch((e) => {
          console.warn(e);
          this.addToMissingFiles(name, 'js');
        });
  } else {
    this.relationPlugins[name].forEach((relationPlugin) => {
      if (!this.loadedPlugins[relationPlugin]) {
        this.loadedPlugins[relationPlugin] = {};
      }

      const relationState = this.loadedPlugins[relationPlugin];
      const alreadyTracked =
          this.pendingLoadPlugins.has(relationPlugin) ||
          relationState.ready ||
          relationState.js ||
          relationState.css ||
          relationState.minCss;
      if (alreadyTracked) {
        const relationRule = this.findPlugins?.[relationPlugin] || {};
        const relationModule =
            relationRule.type === 'smart'
                ? 'smart'
                : relationRule.type === 'component' ||
                relationRule.type === 'attribute'
                    ? 'component'
                    : 'utility';
        const relationSmart = relationModule === 'smart';
        const relationWaitKey = `${name}:relation:${relationPlugin}`;
        if (!this.resolverAll[relationWaitKey]) {
          this.resolverAll[relationWaitKey] = this.awaitPluginAssetsReady(
              relationPlugin,
              relationSmart,
              point,
              relationModule,
          ).then(() => {
            this.checkToFullRelationLoad(relationPlugin, name);
          });
        }
        return;
      }

      if (!this.pendingLoadPlugins.has(relationPlugin)) {
        this.pendingLoadPlugins.add(relationPlugin);
        const relationRule = this.findPlugins?.[relationPlugin] || {};
        const relationModule =
            relationRule.type === 'smart'
                ? 'smart'
                : relationRule.type === 'component' ||
                relationRule.type === 'attribute'
                    ? 'component'
                    : 'utility';
        const relationSmart = relationModule === 'smart';
        const relationExists =
            plugins[relationModule]?.[relationPlugin] || relationRule;

        if (relationExists) {
          if (!plugins[relationModule]) {
            plugins[relationModule] = {};
          }
          if (!plugins[relationModule][relationPlugin]) {
            plugins[relationModule][relationPlugin] = {
              name: relationPlugin,
              url: relationPlugin,
            };
          }
          this.loadPlugin(
              relationPlugin,
              relationSmart,
              point,
              relationModule,
              plugins,
          );
          const relationWaitKey = `${name}:relation:${relationPlugin}`;
          if (!this.resolverAll[relationWaitKey]) {
            this.resolverAll[relationWaitKey] = this.awaitPluginAssetsReady(
                relationPlugin,
                relationSmart,
                point,
                relationModule,
            ).then(() => {
              this.checkToFullRelationLoad(relationPlugin, name);
            });
          }
        } else {
          console.warn(
              `The dependent plugin is in a different category than ${module}, or missing: ${relationPlugin}`,
          );
        }
      }
    });
  }
};

SFLoaderPlugin.prototype.awaitPluginAssetsReady = function (
    pluginName,
    smart,
    point,
    module,
    skipJs = false,
    skipCss = false,
) {
  if (!this.loadedPlugins[pluginName]) {
    this.loadedPlugins[pluginName] = {};
  }

  const waits = [];
  const rule = this.findPlugins?.[pluginName] || {};
  const needsJs =
      !skipJs && typeof rule?.js !== 'undefined' && rule.js !== false;
  const needsCss =
      !smart &&
      !skipCss &&
      typeof rule?.css !== 'undefined' &&
      rule.css !== false;
  const hasLoadedAssets = () => {
    const state = this.loadedPlugins[pluginName] || {};
    const jsReady = !needsJs || state.js === true || state.ready === true;
    const cssReady =
        !needsCss ||
        state.css === true ||
        state.minCss === true ||
        state.ready === true;

    return jsReady && cssReady;
  };

  if (hasLoadedAssets()) {
    this.loadedPlugins[pluginName].ready = true;
    return Promise.resolve();
  }

  if (needsJs) {
    const state = this.loadedPlugins[pluginName] || {};
    const jsFile = this.pathPluginJs(pluginName, smart, point, module);
    if (state.js !== true && state.ready !== true && jsFile && this.resolverAll[jsFile]) {
      waits.push(this.resolverAll[jsFile]);
    }
  }

  if (needsCss) {
    const state = this.loadedPlugins[pluginName] || {};
    const cssFile = this.pathPluginCss(pluginName, module, point);
    const minCssFile = cssFile.replace('.css', '.min.css');

    if (
        state.css !== true &&
        state.minCss !== true &&
        state.ready !== true &&
        this.resolverAll[cssFile]
    ) {
      waits.push(this.resolverAll[cssFile]);
    } else if (
        state.css !== true &&
        state.minCss !== true &&
        state.ready !== true &&
        this.resolverAll[minCssFile]
    ) {
      waits.push(this.resolverAll[minCssFile]);
    }
  }

  if (
      !waits.length &&
      !hasLoadedAssets() &&
      this.relationPlugins[pluginName]
  ) {
    waits.push(
        new Promise((resolve) => {
          let attempts = 0;
          const checkReady = () => {
            if (hasLoadedAssets()) {
              resolve();
              return;
            }

            attempts += 1;
            if (attempts < 200) {
              setTimeout(checkReady, 25);
            } else {
              resolve();
            }
          };

          checkReady();
        }),
    );
  }

  return Promise.all(waits)
      .catch(() => [])
      .then(() => {
        this.loadedPlugins[pluginName].ready = true;
      });
};

SFLoaderPlugin.prototype.waitForResolverIdle = async function () {
  const maxPasses = 25;

  for (let pass = 0; pass < maxPasses; pass++) {
    const entries = Object.entries(this.resolverAll || {});

    if (!entries.length) {
      return [];
    }

    const keysBefore = entries
        .map(([key]) => key)
        .sort()
        .join('|');

    const result = await Promise.allSettled(
        entries.map(([, promise]) => promise),
    );

    await Promise.resolve();
    await Promise.resolve();

    const keysAfter = Object.keys(this.resolverAll || {})
        .sort()
        .join('|');

    if (keysAfter === keysBefore) {
      return result;
    }
  }

  console.warn('SFLoader waitForResolverIdle reached pass limit', {
    resolverAll: this.resolverAll,
    totalRelationsPlugins: this.totalRelationsPlugins,
  });

  return Promise.allSettled(Object.values(this.resolverAll || {}));
};

SFLoaderPlugin.prototype.checkToFullRelationLoad = function (
    relationName,
    pluginName,
) {
  if (!this.totalRelationsPlugins[pluginName]) {
    return;
  }

  if (!this.totalRelationsPlugins[pluginName].completed) {
    this.totalRelationsPlugins[pluginName].completed = {};
  }

  if (this.totalRelationsPlugins[pluginName].completed[relationName]) {
    return;
  }

  if (this.totalRelationsPlugins[pluginName]?.canLoad) {
    if (this.isDebug) {
      console.warn('Duplicate relation completion', {
        relationName,
        pluginName,
        state: this.totalRelationsPlugins[pluginName],
      });
    }
    return;
  }

  this.totalRelationsPlugins[pluginName].completed[relationName] = true;
  this.totalRelationsPlugins[pluginName].load++;
  if (
      this.totalRelationsPlugins[pluginName].load ===
      this.totalRelationsPlugins[pluginName].total
  ) {
    this.totalRelationsPlugins[pluginName].canLoad = true;
    if (this.pendingLoadPlugins.has(pluginName)) {
      if (
          this.totalRelationsPlugins[pluginName].skipJs ||
          !this.totalRelationsPlugins[pluginName].jsFile
      ) {
        if (!this.loadedPlugins[pluginName]) {
          this.loadedPlugins[pluginName] = {};
        }
        this.loadedPlugins[pluginName].js = false;
        this.loadedPlugins[pluginName].ready = true;
        return;
      }
      this.resolverAll[this.totalRelationsPlugins[pluginName].jsFile] =
          this.addScript(`${this.totalRelationsPlugins[pluginName].jsFile}`)
              .then(() => {
                if (!this.loadedPlugins[pluginName]) {
                  this.loadedPlugins[pluginName] = {};
                }
                this.loadedPlugins[pluginName].js = true;
              })
              .catch((e) => {
                console.warn(e);
                this.addToMissingFiles(pluginName, 'js');
              });
    }
  }
};

SFLoaderPlugin.prototype.isRelationPlugin = function (
    pluginName,
    jsFile,
    smart,
    point,
    module,
    skipJs = false,
) {
  const relationsMain = Object.keys(this.relationPlugins).filter(
      (key) => this.relationPlugins[key].indexOf(pluginName) !== -1,
  );
  if (!relationsMain.length) {
    if (skipJs || !jsFile) {
      if (!this.loadedPlugins[pluginName]) {
        this.loadedPlugins[pluginName] = {};
      }
      this.loadedPlugins[pluginName].js = false;
      this.loadedPlugins[pluginName].ready = true;
      return;
    }
    if (module === 'component' || module === 'smart') {
      this.checkEventsPlugins(pluginName);
    }
    this.resolverAll[jsFile] = this.addScript(`${jsFile}`)
        .then(() => {
          if (!this.loadedPlugins[pluginName]) {
            this.loadedPlugins[pluginName] = {};
          }
          this.loadedPlugins[pluginName].js = true;
        })
        .catch((e) => {
          console.warn(e);
          this.addToMissingFiles(pluginName, 'js');
        });
  } else {
    relationsMain.forEach((relationMainPlugin) => {
      if (!this.totalRelationsPlugins[relationMainPlugin]) {
        const relationMainRule = this.findPlugins?.[relationMainPlugin] || {};
        const relationMainModule =
            relationMainRule.type === 'smart'
                ? 'smart'
                : relationMainRule.type === 'component' ||
                relationMainRule.type === 'attribute'
                    ? 'component'
                    : 'utility';
        const relationMainSmart = relationMainModule === 'smart';
        this.totalRelationsPlugins[relationMainPlugin] = {
          load: 0,
          total: this.relationPlugins[relationMainPlugin]?.length || 0,
          canLoad: false,
          jsFile: this.pathPluginJs(
              relationMainPlugin,
              relationMainSmart,
              point,
              relationMainModule,
          ),
          skipJs:
              typeof relationMainRule?.js === 'undefined' ||
              relationMainRule?.js === false,
        };
        // The element that waits on this relation is fetched now too (the
        // same reason as in loadRelationPlugins: a data view waiting on its
        // table was asked for only once the table had run).
        const waiting = this.totalRelationsPlugins[relationMainPlugin];
        if (!waiting.skipJs && waiting.jsFile) this.preloadScript(waiting.jsFile);
      }
      if (skipJs || !jsFile) {
        if (!this.loadedPlugins[pluginName]) {
          this.loadedPlugins[pluginName] = {};
        }
        this.loadedPlugins[pluginName].js = false;
        const relationWaitKey = `${relationMainPlugin}:relation:${pluginName}`;
        this.resolverAll[relationWaitKey] = Promise.resolve()
            .then(() => {
              return this.awaitPluginAssetsReady(
                  pluginName,
                  smart,
                  point,
                  module,
                  true,
              );
            })
            .then(() => {
              this.checkToFullRelationLoad(pluginName, relationMainPlugin);
            });
        return;
      }
      this.resolverAll[jsFile] = this.addScript(`${jsFile}`)
          .then(() => {
            if (!this.loadedPlugins[pluginName]) {
              this.loadedPlugins[pluginName] = {};
            }
            this.loadedPlugins[pluginName].js = true;
            return this.awaitPluginAssetsReady(
                pluginName,
                smart,
                point,
                module,
            ).then(() => {
              this.checkToFullRelationLoad(pluginName, relationMainPlugin);
            });
          })
          .catch((e) => {
            console.warn(e);
            this.checkToFullRelationLoad(pluginName, relationMainPlugin);
            this.addToMissingFiles(pluginName, 'js');
          });
    });
  }
};

SFLoaderPlugin.prototype.sortPlugin = function (plugins, point, module) {
  const modPlugins = plugins?.[module];
  if (!modPlugins) return;
  for (const i in modPlugins) {
    const smart = module === 'smart';
    let pluginName = '';
    if(i.includes('/') || module === 'component' || smart) {
      pluginName = i;
    } else {
      pluginName = `${i}/${point}`;
    }
    // Skip if already marked as loaded (from SF_PRELOADED or previous pass).
    if (this.loadedPlugins && this.loadedPlugins[pluginName]) {
      continue;
    }
    if (this.pendingLoadPlugins.has(pluginName)) continue;

    this.pendingLoadPlugins.add(pluginName);
    if (!this.loadedPlugins[pluginName]) {
      this.loadedPlugins[pluginName] = {};
    }
    this.loadPlugin(pluginName, smart, point, module, plugins);
  }
};

SFLoaderPlugin.prototype.vUseMergeConfigGenerate = function (plugins) {
  const profile = this.profileStart('vUseMergeConfigGenerate');
  const inputCount = Array.isArray(plugins) ? plugins.length : 0;
  // const checkToFake = request.getQuery('checkFake')
  // let smartFakeContent = { status: false }

  // if (checkToFake === 'true') {
  //     const url = request.getQuery('url') || ''
  //     const hash = stableHash(url).substring(0, 16)
  //     smartFakeContent = templateLoader.buildObject(hash)
  // }

  // const pluginNameOld = getModule()
  // const pluginDiff = plugins.filter(plugin => !pluginNameOld.includes(plugin)).filter(Boolean)
  // const firstLoad = request.getQuery('load') === 'true'

  // const arResult = { smartFakeContent }

  plugins = Array.from(new Set([...plugins]));

  const noMinifierJs = [];
  const noMinifierCss = [];

  plugins = this.splitPluginPoint(plugins);
  let types = ['base', 'component', 'smart', 'utility'];
  if (this.disableSmart) {
    types = types.filter((t) => t !== 'smart');
  }

  for (const type of types) {
    this.sortPlugins(type, noMinifierCss, noMinifierJs, plugins);
  }
  this.profileEnd(profile, {
    inputCount,
    types: types.join(','),
    resolverCount: Object.keys(this.resolverAll || {}).length,
    pendingLoadPlugins: this.pendingLoadPlugins?.size || 0,
  });
};

SFLoaderPlugin.prototype.splitPluginPoint = (plugins) => {
  const sortLayerPlugin = {};
  plugins.forEach((idPlugin) => {
    if (/cl-\S+/.test(idPlugin)) {
      // Смарт-компоненты
      if (!sortLayerPlugin.default) sortLayerPlugin.default = {};
      if (!sortLayerPlugin.default.smart) sortLayerPlugin.default.smart = {};
      sortLayerPlugin.default.smart[idPlugin] = idPlugin;
    } else if (idPlugin.includes('/') && !idPlugin.includes('component')) {
      // Утилиты
      const step = idPlugin.split('/');

      if (step[0] === 'headers' || step[0] === 'container') {
        if (!sortLayerPlugin[step[1]]) sortLayerPlugin[step[1]] = {};
        if (!sortLayerPlugin[step[1]].base) sortLayerPlugin[step[1]].base = {};
        sortLayerPlugin[step[1]].base[step[0]] = step[0];
      } else {
        if (!sortLayerPlugin[step[1]]) sortLayerPlugin[step[1]] = {};
        if (!sortLayerPlugin[step[1]].utility)
          sortLayerPlugin[step[1]].utility = {};
        sortLayerPlugin[step[1]].utility[step[0]] = step[0];
      }
    } else {
      // Компоненты
      if (!sortLayerPlugin.default) sortLayerPlugin.default = {};
      if (!sortLayerPlugin.default.component)
        sortLayerPlugin.default.component = {};
      sortLayerPlugin.default.component[idPlugin] = idPlugin;
    }
  });

  return sortLayerPlugin;
};
SFLoaderPlugin.prototype.checkSmartCache = function () {
  const smartCache = pageStorage().getItem(`SF_SMART_LIST-${this.urlHash}`);
  if (smartCache) {
    try {
      this.smartCache = JSON.parse(decodeCacheValue(smartCache));
    } catch (e) {
      console.warn(e);
      return false;
    }
  }
};

SFLoaderPlugin.prototype.disconnectObservers = function () {
  this.mutationObserver?.disconnect?.();
  clearInterval(this.arrowInterval);
  this.arrowInterval = null;
};

SFLoaderPlugin.prototype.checkTurbo = function () {
  if (typeof Turbo !== 'undefined') {
    this.turboEnabled = true;
    document.addEventListener('turbo:before-render', () => {
      this.stopPreloader();
      this.disconnectObservers?.();
      this.searchEnd = false;
      this.prepareInit = false;
      this.loadPage = false;
      this.cachedPlugins = [];
      this.module = {};
    });
    document.addEventListener('turbo:load', () => {
      this.urlHash = this.generatePageHash();
      this.prepareInit = false;
      this.firstLoad = true;
      this.prepare();
    });
  }
};

SFLoaderPlugin.prototype.checkToCacheClean = function () {
  const params = new URLSearchParams(window.location.search);
  const clear = params.get('loader_clear');
  if (clear && clear === 'Y') {
    this.clearCache();
  }
};
SFLoaderPlugin.prototype.sendThemeToPlayground = function (
    iframe = null,
    theme = null,
) {
  if (!iframe) {
    iframe = document.querySelector('iframe[src*="play.simai.io/embed.html"]');
  }
  if (!iframe) return false;
  theme = theme ?? this.theme;
  iframe?.contentWindow?.postMessage({ type: 'sf-theme', theme }, '*');
};

SFLoaderPlugin.prototype.ensureThemePreferenceListener = function () {
  if (!this.themeEnabled || this.themeMediaQuery) {
    return this.themeMediaQuery || null;
  }
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!media) return null;

  this.themeMediaQuery = media;
  this.themeMediaListener = () => {
    if (this.themePreference === 'system') this.checkTheme();
  };
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', this.themeMediaListener);
  } else {
    media.addListener?.(this.themeMediaListener);
  }
  return media;
};

SFLoaderPlugin.prototype.setTheme = function (preference) {
  if (!this.themeEnabled) return false;
  const supported = ['system', 'light', 'dark'];
  if (!supported.includes(preference)) return false;

  if (preference === 'system') {
    try {
      document.cookie =
        'sf-theme=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
    } catch {
      // Sandboxed documents retain the session theme without persistence.
    }
    this.themeSessionPreference = this.getCookie('sf-theme') ? 'system' : null;
  } else {
    const persisted =
      this.setCookie('sf-theme', preference) &&
      this.getCookie('sf-theme') === preference;
    this.themeSessionPreference = persisted ? null : preference;
  }
  this.checkTheme();
  return true;
};

SFLoaderPlugin.prototype.changeTheme = function () {
  if (!this.themeEnabled) return false;
  return this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
};

SFLoaderPlugin.prototype.turboFontCheck = function (body) {
  if (this.iconFontReady) {
    body.classList.add('sf-icons-loaded');
  }
};

SFLoaderPlugin.prototype.checkTheme = function (body = null) {
  if (!this.themeEnabled) return false;
  const classes = ['theme-dark', 'theme-light'];
  const savedTheme = this.getCookie('sf-theme');
  const sessionPreference = this.themeSessionPreference;
  const preference = ['system', 'light', 'dark'].includes(sessionPreference)
    ? sessionPreference
    : ['light', 'dark'].includes(savedTheme)
      ? savedTheme
      : 'system';
  const media = this.ensureThemePreferenceListener();
  const isDark =
    preference === 'dark' || (preference === 'system' && media?.matches);
  const theme = isDark ? 'dark' : 'light';
  const previousTheme = this.theme;
  const previousPreference = this.themePreference;
  this.theme = theme;
  this.themePreference = preference;
  body = body || document.documentElement;
  body.classList.remove(...classes);
  body.classList.add(isDark ? classes[0] : classes[1]);
  this.sendThemeToPlayground();

  if (
    body === document.documentElement &&
    (theme !== previousTheme || preference !== previousPreference)
  ) {
    window.dispatchEvent(
      new CustomEvent('sf-theme-change', {
        detail: { theme, preference },
      }),
    );
  }
  return theme;
};

SFLoaderPlugin.prototype.checkForCache = function () {
  for (let i = 0; i < pageStorage().length; i++) {
    const key = pageStorage().key(i);
    if (key.startsWith('SF_PLUGIN_LIST-')) {
      return false;
    }
  }
  return true;
};

SFLoaderPlugin.prototype.randomId = function (length = 8) {
  return Math.random().toString(36).substr(2, length);
};

SFLoaderPlugin.prototype.clearCache = function () {
  for (let i = pageStorage().length - 1; i >= 0; i--) {
    const key = pageStorage().key(i);
    if (key.startsWith('SF_PLUGIN_LIST-') || key.startsWith('SF_SMART_LIST-')) {
      safeRemoveItem(key);
    }
  }
  safeRemoveItem('SF_MISSING_PLUGINS');
};

SFLoaderPlugin.prototype.clearAllSfCache = function () {
  for (let i = pageStorage().length - 1; i >= 0; i--) {
    const key = pageStorage().key(i);
    if (key && key.startsWith('SF_')) {
      safeRemoveItem(key);
    }
  }
};

SFLoaderPlugin.prototype.ensureCacheVersion = function () {
  const versionKey = 'SF_CACHE_VERSION';
  const storedVersion = pageStorage().getItem(versionKey);
  const currentVersion = this.cacheVersion;
  if (!currentVersion) {
    this.clearAllSfCache();
    safeRemoveItem(versionKey);
    return;
  }

  if (storedVersion !== currentVersion) {
    this.clearAllSfCache();
    safeSetItem(versionKey, currentVersion);
  }
};

SFLoaderPlugin.prototype.ensurePluginListVersion = function () {
  const versionKey = 'SF_PLUGIN_LIST_VERSION';
  const storedVersion = pageStorage().getItem(versionKey);
  const currentVersion = this.pluginListVersion;
  if (!currentVersion) {
    this.clearCache();
    safeRemoveItem(versionKey);
    return;
  }

  if (storedVersion !== currentVersion) {
    this.clearCache();
    safeSetItem(versionKey, currentVersion);
  }
};

SFLoaderPlugin.prototype.revalidateMissingPlugins = function () {
  try {
    const stored = pageStorage().getItem('SF_MISSING_PLUGINS');
    if (!stored) return;
    const parsed = JSON.parse(decodeCacheValue(stored));
    if (!parsed || typeof parsed !== 'object') return;
    const remaining = {};
    Object.keys(parsed).forEach((key) => {
      if (!key) return;
      // An entry is dropped once its rule is known again in the same place:
      // a package entry only by a rule of that package.
      const at = key.indexOf(PACKAGE_MISS_SEPARATOR);
      const packageName = at > 0 ? key.slice(0, at) : '';
      const name = at > 0 ? key.slice(at + PACKAGE_MISS_SEPARATOR.length) : key;
      const rule = SF.RuleLoader?.[name];
      if ((rule && (rule.package || '') === packageName)
          || (!packageName && this.loadedPlugins[name])) {
        return;
      }
      remaining[key] = parsed[key];
    });
    if (Object.keys(remaining).length) {
      pageStorage().setItem(
          'SF_MISSING_PLUGINS',
          encodeCacheValue(JSON.stringify(remaining)),
      );
    } else {
      pageStorage().removeItem('SF_MISSING_PLUGINS');
    }
  } catch (e) {
    console.warn('revalidateMissingPlugins failed', e);
  }
};
SFLoaderPlugin.prototype.registerComponent = function (name, className) {
  if (this.ComponentRegistry[name]) return;
  if (className.prototype) {
    className.prototype.componentName = name;
  }
  this.ComponentRegistry[name] = className;
  const lower = name && name.toLowerCase ? name.toLowerCase() : name;
  if (lower && !this.ComponentRegistry[lower]) {
    this.ComponentRegistry[lower] = className;
  }
  // Announced after the module that registered finishes its own synchronous
  // work: every class component registers first and publishes SF.<Name> (its
  // state API) on the next lines, so a listener told at once found no API --
  // all 17 of them (documentation trial, 2026-10-12). The registry is filled
  // now, so ready() resolves synchronously as before.
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent(name + ':ready', { detail: className }));
    try {
      document.dispatchEvent(
          new CustomEvent('component:ready', { detail: { name } }),
      );
    } catch (e) {
      console.warn('component:ready dispatch failed', e);
    }
  });
};

SFLoaderPlugin.prototype.ready = function (className, callback) {
  const variants = Array.from(
      new Set(
          [
            className,
            className && className[0]
                ? className[0].toUpperCase() + className.slice(1)
                : className,
            className && className.toLowerCase
                ? className.toLowerCase()
                : className,
          ].filter(Boolean),
      ),
  );

  const tryResolve = () => {
    for (const name of variants) {
      const cls = this.ComponentRegistry[name];
      if (typeof cls === 'function') {
        callback(cls);
        return true;
      }
    }
    return false;
  };

  if (tryResolve()) return;

  variants.forEach((name) => {
    const eventName = `${name}:ready`;
    window.addEventListener(
        eventName,
        () => {
          tryResolve();
        },
        { once: true },
    );
  });
};

SFLoaderPlugin.prototype.searchRegexp = function (event, html = null) {
  const profile = this.profileStart('searchRegexp');
  const filteredRules = this.getRegexpScanRules();

  if (!filteredRules.length) {
    this.pendingRegex = false;
    this.getLoader([]);
    this.profileEnd(profile, {
      skipped: true,
      reason: 'no-regexp-rules',
    });
    return;
  }

  let htmlString = '';
  if (html) {
    if (typeof html === 'string') {
      htmlString = html;
    } else if (html.nodeType) {
      htmlString = this.getObserverFilteredHTML(html);
    } else if (html.textContent !== undefined) {
      htmlString = html.textContent;
    }
  } else {
    htmlString = document.body
        ? this.getObserverFilteredHTML(document.body)
        : '';
  }

  const bodyRaw = this.stripIgnoredBlocks(htmlString);
  if (!bodyRaw) {
    this.pendingRegex = false;
    this.getLoader([]);
    this.profileEnd(profile, { skipped: true, reason: 'empty-body' });
    return;
  }
  const body = bodyRaw.length > 4096 ? bodyRaw.slice(0, 4096) : bodyRaw;

  if (this.regexMatchCache.has(body)) {
    const cached = this.regexMatchCache.get(body);
    cached.forEach((key) => this.setExistCookie(key));
    this.pendingRegex = false;
    this.getLoader([]);
    this.profileEnd(profile, {
      cacheHit: true,
      bodyLength: body.length,
      matched: cached.length,
    });
    return;
  }

  const matched = [];
  for (const [key] of filteredRules) {
    const item = SF.RuleLoader[key];
    const regex = item.regex || item;
    const re =
        regex instanceof RegExp ? regex : new RegExp(regex, regex.flags || '');
    if (re.global || re.sticky) re.lastIndex = 0;
    if (re.test(body)) {
      matched.push(key);
      this.setExistCookie(key);
    }
  }
  this.regexMatchCache.set(body, matched);
  this.pendingRegex = false;
  this.getLoader([]);
  this.profileEnd(profile, {
    cacheHit: false,
    bodyLength: body.length,
    rules: filteredRules.length,
    matched: matched.length,
  });
};

SFLoaderPlugin.prototype.getObserverFilteredHTML = function (node) {
  if (!node) return '';
  if (this.shouldSkipNode(node)) return '';

  const clone = node.cloneNode(true);
  const ignoredNodes = clone.querySelectorAll?.(OBSERVER_IGNORE_SELECTOR) || [];

  ignoredNodes.forEach((ignoredNode) => ignoredNode.remove());

  if (clone.innerHTML !== undefined) return clone.innerHTML;
  if (clone.outerHTML !== undefined) return clone.outerHTML;
  if (clone.textContent !== undefined) return clone.textContent;
  return '';
};

SFLoaderPlugin.prototype.stripIgnoredBlocks = function (html) {
  if (!html) return '';
  const patterns = [
    /<code\b[^>]*>.*?<\/code>/gims,
    /<pre\b[^>]*>.*?<\/pre>/gims,
    /<([a-z][\w:-]*)\b[^>]*data-sf-observer=["']ignore["'][^>]*>.*?<\/\1>/gims,
  ];
  return patterns.reduce((acc, pattern) => acc.replace(pattern, ''), html);
};

SFLoaderPlugin.prototype.getLoader = async function (
    PluginList,
    temp = false,
    skipDefer = false,
) {
  this.logTiming('getLoader start');
  let clearCache = this.getUrlParam('loader_clear');

  if (clearCache) {
    clearCache = `&clear_cache=${clearCache}`;
  }

  if (!Array.isArray(PluginList)) {
    PluginList = this.getObjectArray(PluginList || {});
  }
  PluginList = [...new Set(PluginList.map(name => resolveUtilityModule(
      name,
      utilityModuleAliases.aliases,
      this.findPlugins,
      this.productionPlanActive,
  )))];
  if (!this.productionPlanActive) {
    PluginList.forEach(name => this.setModule(name));
  }
  const profile = this.profileStart('getLoader');
  const requestedPluginCount = PluginList.length;

  const prioritySet = new Set(this.priorityModules || []);
  if (PluginList.length) {
    const priorityFirst = [];
    const rest = [];
    PluginList.forEach((mod) => {
      if (prioritySet.has(mod)) {
        priorityFirst.push(mod);
      } else {
        rest.push(mod);
      }
    });
    PluginList = [...priorityFirst, ...rest];
  }

  const deferredModules = [];
  const heavyModules = this.heavyModules || [];
  const allowDefer = !skipDefer && !this.loadPage;

  if (!skipDefer && PluginList.length < 10 && !this.productionPlanActive) {
    this.debug('PluginList is empty, use Cookie');

    PluginList = this.getModuleArray();

  }
  if (allowDefer && Array.isArray(PluginList)) {
    PluginList = PluginList.filter((mod) => {
      if (heavyModules.includes(mod)) {
        deferredModules.push(mod);
        return false;
      }
      return true;
    });
  }

  if (!PluginList.length && deferredModules.length) {
    this.profileEnd(profile, {
      redirectedToDeferred: true,
      requestedPluginCount,
      deferredCount: deferredModules.length,
    });
    return this.getLoader(deferredModules, temp, true);
  }
  if (this.loadedPlugins && Array.isArray(PluginList)) {
    PluginList = PluginList.filter((m) => {
      return !this.loadedPlugins[m];
    });
  }

  if (skipDefer && PluginList.length && this.loadedPlugins) {
    PluginList = PluginList.filter((m) => !this.loadedPlugins[m]);
  }

  const lastLoadCur = this.hashCode(PluginList + '/' + this.pluginListRelation);

  if (!skipDefer && lastLoadCur === this.lastLoadHash && this.loadPage) {
    if (deferredModules.length) {
      return this.getLoader(deferredModules, temp, true);
    }
    this.stopPreloader();
    this.logTiming('getLoader skipped: same hash');
    this.profileEnd(profile, {
      skipped: true,
      reason: 'same-hash',
      requestedPluginCount,
      pluginCount: PluginList.length,
      deferredCount: deferredModules.length,
    });
    return false;
  }

  safeSetItem(
      `SF_PLUGIN_LIST-${this.urlHash}`,
      encodeCacheValue(JSON.stringify(this.module)),
  );

  if (this.lastLoadHash && !skipDefer && this.cachedPlugins.length) {
    PluginList = PluginList.filter((x) => !this.cachedPlugins.includes(x));
  }

  if (!skipDefer) {
    this.lastLoadHash = lastLoadCur;
  } else if (PluginList.length) {
    this.cachedPlugins = Array.from(
        new Set([...(this.cachedPlugins || []), ...PluginList]),
    );
  }

  if (this.standAlone) {
    this.logTiming('standalone load start');
    this.logTiming(`PluginList - ${PluginList.length} modules`);
    this.vUseMergeConfigGenerate(PluginList);
    const promises = Object.values(this.resolverAll);

    if (promises.length === 0) {
      if (!this.pendingRegex) {
        this.dispatchReadyOnce();
      }
      this.stopPreloader();
      this.logTiming('standalone: nothing to load');
      this.profileEnd(profile, {
        mode: 'standalone',
        skipped: true,
        reason: 'nothing-to-load',
        requestedPluginCount,
        pluginCount: PluginList.length,
      });
      return;
    }
    this.waitForResolverIdle().then(() => {


      if ((!this.eventSend && !this.pendingRegex) || skipDefer) {
        this.pendingRegex = false;
        this.dispatchReadyOnce();
      }
      this.eventsPlugins = [];
      this.resolverAll = {};
      this.stopPreloader();
      this.loadPage = true;
      const totalLoaded = Object.keys(this.loadedPlugins || {}).length;
      this.logTiming(`standalone load complete: ${totalLoaded} modules`);
      this.profileEnd(profile, {
        mode: 'standalone',
        requestedPluginCount,
        pluginCount: PluginList.length,
        resolverCount: Object.keys(this.resolverAll || {}).length,
        totalLoaded,
        deferredCount: deferredModules.length,
      });
      if (this.isDebug) {
        console.log('SFLoader loaded modules (standalone)', this.loadedPlugins);
      }
      if (deferredModules.length) {
        this.getLoader(deferredModules, temp, true);
      }
    });
  }

  return true;
};

SFLoaderPlugin.prototype.hashCode = function (s) {
  if (s === '') return 0;
  return s.split('').reduce(function (a, b) {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
};

SFLoaderPlugin.prototype.isEmptyObject = function (obj) {
  for (const i in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, i)) {
      return false;
    }
  }
  return true;
};

// A failed stylesheet may be a temporary network error. Keep CSS failures in
// this document so repeated scans do not loop, but retry them after reload.
// JavaScript failures remain persistent because evaluating a partial script
// twice can leave an inconsistent runtime.
SFLoaderPlugin.prototype.getPersistentMissingFiles = function (
    files = this.notFoundFiles,
) {
  const result = Object.create(null);
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    return result;
  }
  for (const [name, state] of Object.entries(files)) {
    if (state && typeof state === 'object' && state.js === true) {
      result[name] = {js: true};
    }
  }
  return result;
};

// A file is missing from one base, not everywhere. A package rule's entry is
// kept under `<package>::<rule>`, so a 404 from a package base never marks the
// same name missing in the Smart base -- or the other way round, which matters
// while a component moves from Core into a package under the same rule name.
// Smart-base entries keep their bare name, the format browsers already hold.
SFLoaderPlugin.prototype.getMissingFileKey = function (name) {
  const packageName = this.findPlugins?.[name]?.package;
  return packageName ? `${packageName}${PACKAGE_MISS_SEPARATOR}${name}` : name;
};

SFLoaderPlugin.prototype.addToMissingFiles = function (
    pluginName,
    type,
    missingMin = true,
) {
  const name = this.getMissingFileKey(pluginName);
  if (this.notFoundFiles[name]) {
    this.notFoundFiles[name][type] = true;
  } else {
    this.notFoundFiles[name] = {
      [type]: true,
    };
  }
  if (type === 'css') {
    this.notFoundFiles[name].missingMin = missingMin;
  }
  safeSetItem(
      'SF_MISSING_PLUGINS',
      encodeCacheValue(JSON.stringify(this.getPersistentMissingFiles())),
  );
};

SFLoaderPlugin.prototype.getAssetVersion = function () {
  return this.cacheVersion || this.pluginListVersion || '';
};

SFLoaderPlugin.prototype.versionAssetUrl = function (pluginURL) {
  const version = this.getAssetVersion();
  if (!version || typeof pluginURL !== 'string') {
    return pluginURL;
  }

  if (/^(data:|blob:|javascript:)/i.test(pluginURL)) {
    return pluginURL;
  }

  const hashIndex = pluginURL.indexOf('#');
  const hash = hashIndex >= 0 ? pluginURL.slice(hashIndex) : '';
  const base = hashIndex >= 0 ? pluginURL.slice(0, hashIndex) : pluginURL;
  const encodedVersion = encodeURIComponent(version);

  if (/[?&]sf_v=/.test(base)) {
    return `${base.replace(/([?&])sf_v=[^&#]*/g, `$1sf_v=${encodedVersion}`)}${hash}`;
  }

  return `${base}${base.includes('?') ? '&' : '?'}sf_v=${encodedVersion}${hash}`;
};

SFLoaderPlugin.prototype.addStyle = async function (pluginURL) {
  return new Promise((resolve, reject) => {
    const head = document.getElementsByTagName('head')[0];
    const style = document.createElement('link');
    const src = this.versionAssetUrl(pluginURL);

    style.href = src;
    style.type = 'text/css';
    style.rel = 'stylesheet';

    style.addEventListener('load', () => {
      resolve();
    }, {once: true});
    style.addEventListener('error', () => {
      style.remove();
      reject(new Error(`Failed to load styles: ${pluginURL}`));
    }, {once: true});

    head.append(style);
  });
};

SFLoaderPlugin.prototype.preloadScript = function (pluginURL) {
  if (typeof document === 'undefined' || !pluginURL) return;
  const href = this.versionAssetUrl(pluginURL);
  this.preloadedScripts = this.preloadedScripts || new Set();
  if (this.preloadedScripts.has(href)) return;
  this.preloadedScripts.add(href);
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'script';
  link.href = href;
  document.head.append(link);
};

SFLoaderPlugin.prototype.addScript = function (pluginURL, param = {}) {
  return new Promise((resolve, reject) => {
    const head = document.getElementsByTagName('head')[0];
    const script = document.createElement('script');
    const src = this.versionAssetUrl(pluginURL);

    script.src = src;
    script.async = true;

    script.addEventListener('load', () => {
      resolve();
    });
    script.addEventListener('error', () => {
      const readable = minifiedToReadable(pluginURL);
      if (readable) {
        script.remove();
        this.addScript(readable, param).then(resolve, reject);
        return;
      }
      reject(new Error(`Failed to load script: ${pluginURL}`));
    });

    if (param && param.attributes) {
      for (const k in param.attributes) {
        script.setAttribute(k, param.attributes[k]);
      }
    }

    head.append(script);
  });
};

SFLoaderPlugin.prototype.setPreloaderParams = function () {
  if (this.params.preloader) {
    for (const key in this.params.preloader) {
      this.preloader[key] = this.params.preloader[key];
    }
  }
  this.contentPreloader = this.params.contentPreloader
      ? this.params.contentPreloader
      : createPreloaderContent(this.preloader);
};

SFLoaderPlugin.prototype.getCurrentUrl = function () {
  const protocol = window.location.protocol;
  const host = window.location.host;
  const path = window.location.pathname;
  const url = `${protocol}//${host}${path}`.replace(/\/+$/, '');
  return url.split('?')[0];
};

SFLoaderPlugin.prototype.isDynamicPage = function (url) {
  return /\/\d+|\/[a-zA-Z_-]+\/[a-zA-Z0-9_-]+/.test(url);
};

SFLoaderPlugin.prototype.removeLastSegment = function (url) {
  return url.replace(/\/[^/]+$/, '');
};

SFLoaderPlugin.prototype.generatePageHash = function () {
  let pageUrl = this.getCurrentUrl();

  if (this.isDynamicPage(pageUrl)) {
    pageUrl = this.removeLastSegment(pageUrl);
  }

  return stableHash(pageUrl).substring(0, 16);
};

SFLoaderPlugin.prototype.onWindowLoad = function (fn) {
  if (document.readyState === 'complete') {
    fn();
  } else {
    window.addEventListener('load', fn, { once: true });
  }
};

SFLoaderPlugin.prototype.endSearch = function () {
  this.searchEnd = true;
  this.flushObservedChanges?.();
};

// The search ends at the window's load. The Loader is a chunk of its own and
// can prepare after load has fired -- and a Turbo visit prepares with no load
// to come -- and listening for it then waited forever: searchEnd stayed false
// and every element added to the page from then on was queued where nothing
// read it. A component inserted later never loaded, one page in two
// (loader-packages.browser.mjs saw it as a flaky case). A load already past
// ends the search on the next task.
SFLoaderPlugin.prototype.scheduleSearchEnd = function () {
  if (document.readyState === 'complete') {
    setTimeout(() => this.endSearch(), 0);
  } else if (!this.searchEndListening) {
    this.searchEndListening = true;
    window.addEventListener('load', () => {
      this.searchEndListening = false;
      this.endSearch();
    }, { once: true });
  }
};

SFLoaderPlugin.prototype.prepare = function (observer = null) {
  let PluginList = [];
  this.logTiming('prepare start');
  this.searchEnd = false;
  this.scheduleSearchEnd();
  this.checkTheme();
  if (this.standAlone) {
    const localMissingPlugins = pageStorage().getItem('SF_MISSING_PLUGINS');
    try {
      this.notFoundFiles = localMissingPlugins
          ? this.getPersistentMissingFiles(
              JSON.parse(decodeCacheValue(localMissingPlugins)),
          )
          : {};
    } catch (e) {
      console.warn(e);
    }
  }
  let plugins = this.productionPlanActive
      ? null
      : pageStorage().getItem(`SF_PLUGIN_LIST-${this.urlHash}`);

  // fallback: если есть bundle-id, пробуем его ключ даже в standAlone
  if (!this.productionPlanActive && !plugins && window.BUNDLE_ID) {
    plugins = pageStorage().getItem(`SF_PLUGIN_LIST-${window.BUNDLE_ID}`);
  }
  if (!this.standAlone) {
    this.firstLoad = !window.BUNDLE_LOADED;
  } else {
    this.firstLoad = typeof plugins !== 'string';
  }

  this.findShortCodes(document.body);

  if (plugins) {
    try {
      PluginList = JSON.parse(decodeCacheValue(plugins));
      this.cachedPlugins = this.getObjectArray(PluginList);
    } catch {
      PluginList = [];
    }
    if (!PluginList || !Object.keys(PluginList).length) {
      plugins = null;
    } else {
      this.module = PluginList;
      Object.keys(PluginList).forEach((key) => {
        const plugin = this.findPlugins[key];
        if (plugin && plugin.relation) {
          this.setRelation(plugin.relation, key, false);
        }
      });
      // Кэшированные плагины загружаем сразу, без отложенного defer
      this.getLoader(PluginList, false, true);
      this.logTiming(
          'prepare: initial getLoader requested (cached, skipDefer)',
      );
    }
  } else {
    this.logTiming('prepare: preloader run');
  }
  this.onWindowLoad(() => {
    if (observer) {
      observer.disconnect();
    }
    this.logTiming('onWindowLoad search start');
    this.findShortCodes(document.body);
    try {
      document.dispatchEvent(
          new CustomEvent('sf-shortcodes-ready', {
            detail: { loader: this, timestamp: Date.now() },
          }),
      );
    } catch (e) {
      console.warn('sf-shortcodes-ready dispatch failed', e);
    }
    this.scanCustomElements(document.body);
    this.scanStaticIcons(document.body);
    this.scanAttributes(document.body);
    this.searchAttr(false);
    this.searchRegexp('');
    this.search();
    if (Object.keys(this.module || {}).length) {
      this.getLoader(this.module, true);
    }
    this.revalidateMissingPlugins();
    this.logTiming('onWindowLoad search done');
  });
};

SFLoaderPlugin.prototype.prepareTurboEvents = function () {
  if (this.turboEventsBound) return;
  this.turboEventsBound = true;
  document.addEventListener('turbo:before-render', (e) => {
    let { newBody, isPreview } = e.detail;
    if (!newBody) return;
    const root = document.documentElement;
    if (!root || root.getAttribute('dir')) return;
    const computedDir =
        root.getAttribute('dir') ||
        document?.dir ||
        (document.documentElement &&
            document.documentElement.getAttribute('dir')) ||
        '';
    root.setAttribute('dir', computedDir === 'rtl' ? 'rtl' : 'ltr');
    if (isPreview || newBody.hasAttribute('data-turbo-preview')) return;
    if (this.turboRenderHandled) return;
    this.turboRenderHandled = true;
    this.findShortCodes(newBody);
    this.scanCustomElements(newBody);
    this.scanStaticIcons(newBody);
    this.scanAttributes(newBody);
    this.searchRegexp('', newBody);
    this.turboFontCheck(newBody);
    this.checkTheme(newBody);

    e.detail.render = (currentBody) => currentBody.replaceWith(newBody);
  });
  document.addEventListener('turbo:load', () => {
    this.turboRenderHandled = false;
  });
};

SFLoaderPlugin.prototype.getTextNodes = function (node) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
    acceptNode: (textNode) =>
        this.shouldSkipNode(textNode)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
  });
  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }
  return textNodes;
};
// A hidden tab pauses requestAnimationFrame, and a tab can be hidden for its
// whole load: opened in the background, restored with a session, or behind
// another window. Scheduling the loader's work through rAF alone meant such a
// tab waited to be shown before anything was mutated -- the bootstrap included
// -- so it showed un-upgraded markup indefinitely. A consumer found it as a
// filter window whose rows had no radio and no label: their automation tab is
// hidden, and the module arrived about five seconds after the window opened.
// A timer runs in a hidden tab, so that is what a hidden tab gets. No caller
// uses the handle either of them returns.
//
// A frame is not promised either: an iframe out of view (a documentation
// example below the fold) gets none while its document is still «visible», and
// the work waited for a frame that never came -- tags created there stayed
// undefined until someone scrolled (DEV, 2026-10-15). So the work runs on the
// frame or on a short timer, whichever comes first, and once.
const LOADER_FRAME_FALLBACK_MS = 100;

function scheduleLoaderWork(fn) {
  if (typeof document !== 'undefined' && document.hidden) {
    return setTimeout(fn, 0);
  }

  let done = false;
  let timer = null;
  const run = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    fn();
  };
  const frame = requestAnimationFrame(run);
  timer = setTimeout(run, LOADER_FRAME_FALLBACK_MS);
  return frame;
}

SFLoaderPlugin.prototype.mutate = function (fn) {
  return scheduleLoaderWork(fn);
};

SFLoaderPlugin.prototype.ensureLoadedModules = function () {
  if (window.SF_PRELOADED) {
    this.productionPlanActive = true;
    this.pendingRegex = false;
    this.firstLoad = false;
    const { modules, loadedPlugins } = window.SF_PRELOADED;
    if (Array.isArray(modules)) {
      modules.forEach((m) => {
        if (m) {
          this.module[m] = m;
          if (!this.loadedPlugins[m]) {
            this.loadedPlugins[m] = {};
          }
        }
      });
    } else if (modules && typeof modules === 'object') {
      Object.keys(modules).forEach((m) => {
        this.module[m] = m;
        if (!this.loadedPlugins[m]) {
          this.loadedPlugins[m] = {};
        }
      });
    }
    if (loadedPlugins && typeof loadedPlugins === 'object') {
      this.loadedPlugins = { ...this.loadedPlugins, ...loadedPlugins };
    }

    // If modules already present, immediately signal ready
    if (!this.eventSend && Object.keys(this.loadedPlugins || {}).length) {
      if (this.dispatchReadyOnce()) {
        this.endSearch();
      }
    }
  }
};

SFLoaderPlugin.prototype.ensureDirAttribute = function () {
  const root = document.documentElement;
  if (!root || root.getAttribute('dir')) {
    return;
  }
  const computedDir =
      window.getComputedStyle && root
          ? window.getComputedStyle(root).direction
          : '';
  root.setAttribute('dir', computedDir === 'rtl' ? 'rtl' : 'ltr');
};
SFLoaderPlugin.prototype.init = function () {
  this.logTiming('init start');
  this.ensureLoadedModules();
  this.ensureDirAttribute();
  this.checkTurbo();
  this.checkToCacheClean();
  this.ensureCacheVersion();
  this.ensurePluginListVersion();
  this.restoreIconManifestFromCache();
  this.bootstrapConfiguredIconSubset();
  this.prepareSmartChildScanEvents();
  this.usePreloader = this.checkForCache();
  this.urlHash = this.generatePageHash();
  this.setPreloaderParams();
  this.checkSmartCache();

  const stopPrepareObserver = () => {
    if (!this.prepareObserver) {
      return;
    }

    this.prepareObserver.disconnect();
    this.prepareObserver = null;
  };

  const bootstrapPrepare = () => {
    if (!this.prepareInit) {
      this.prepareInit = true;
      this.prepare();
    }

    stopPrepareObserver();
  };

  if (
      document.readyState === 'complete' ||
      document.readyState === 'interactive'
  ) {
    scheduleLoaderWork(bootstrapPrepare);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      scheduleLoaderWork(bootstrapPrepare);
    });
  }

  // Fallback: следим за появлением body и динамическими узлами
  this.prepareObserver = new MutationObserver((mutations) => {
    if (this.prepareInit) {
      stopPrepareObserver();
      return;
    }

    if (document.body && !this.prepareInit) {
      this.prepareInit = true;
      this.prepare();
      stopPrepareObserver();
      return;
    }

    for (let o = 0; o < mutations.length; o++) {
      const change = mutations[o];
      if (change.target?.classList?.contains('skip')) continue;
      if (this.shouldSkipNode(change.target)) continue;
      switch (change.type) {
        case 'childList':
          for (let t = 0; t < change.addedNodes.length; t++) {
            const node = change.addedNodes[t];
            if (this.shouldSkipNode(node)) continue;
            this.findShortCodes(node);
          }
          break;
        default:
          break;
      }
    }
  });

  this.prepareObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: false,
    attributes: false,
  });

  this.scheduleSearchEnd();
  if (this.turboEnabled) {
    this.prepareTurboEvents();
  }
  this.logTiming('init observers attached');
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'sf-embed-ready') {
      this.sendThemeToPlayground();
    }
  });
};

const props = {
  attr: 'sf-asset',
  delimiterURL: '/',
  standAlone: true,
  frameworkPath: '/simai/asset/simai.framework/sf5.master/',
  pathComponent: '/simai/asset/simai.framework/sf5.master/component/',
  isLoadPluginCookie: false,
  preloader: {
    width: 66,
    height: 100,
  },
  requiredPlugins: ['modal'],
  disableSmart: false,
  cacheVersion:
      window.SF_BOOT_CONFIG?.cacheVersion ??
      (typeof __SF_CACHE_VERSION__ !== 'undefined' ? __SF_CACHE_VERSION__ : '') ??
      '',
  pluginListVersion:
      window.SF_BOOT_CONFIG?.pluginListVersion ??
      (typeof __SF_PLUGIN_LIST_VERSION__ !== 'undefined'
          ? __SF_PLUGIN_LIST_VERSION__
          : '') ??
      '',
  theme: window.SF_BOOT_CONFIG?.theme ?? true,
  smart: window.SF_BOOT_CONFIG?.smart || {},

  findPlugins: SF.RuleLoader,
  backgroundPreloader:
      'var(--sf-color--surface-highest, var(--sf-surface-0, #fff))',
  modifierPreloader: 'loader-default',
  contentPreloaderText: 'LOADING',
};

if (window.sfPath) {
  props.url = window.sfPath;
}
if (window.sfSmartPath) {
  props.smartUrl = window.sfSmartPath;
}

function normalizeSmartTagName(name) {
  const normalized = String(name || '')
      .trim()
      .toLowerCase();
  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('sf-')) return normalized;
  // A package's own element is named in full; a short name is a Framework one.
  if (globalThis.SF?.Loader?.getCustomElementRules?.()[normalized]) return normalized;
  return `sf-${normalized}`;
}

function normalizeWhenDefinedInput(input = []) {
  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input === 'string') {
    return [input];
  }

  return Array.from(arguments).filter(Boolean);
}

// A short name the rules do not know yet may be a package's own element whose
// rules have not loaded (acme-counter) or a Framework one (data-view ->
// sf-data-view). It used to be read as the Framework's, and
// SF.whenDefined('acme-counter') waited forever for sf-acme-counter. Until the
// rules say, whichever of the two is defined first is the element; a name with
// no hyphen can only be the Framework's.
function definedTag(input) {
  const tag = normalizeSmartTagName(input);
  const short = String(input || '').trim().toLowerCase();
  if (!tag || tag === short || !short.includes('-')) {
    return window.customElements.whenDefined(tag).then(() => tag);
  }
  return Promise.race([
    window.customElements.whenDefined(short).then(() => short),
    window.customElements.whenDefined(tag).then(() => tag),
  ]);
}

function whenSmartDefined() {
  const inputs = normalizeWhenDefinedInput
      .apply(null, arguments)
      .filter((input) => normalizeSmartTagName(input));

  if (!inputs.length) {
    return Promise.resolve([]);
  }

  if (!window.customElements?.whenDefined) {
    return Promise.resolve(inputs.map(normalizeSmartTagName));
  }

  return Promise.all(inputs.map(definedTag));
}

function toAttributeName(key) {
  if (key === 'className') {
    return 'class';
  }

  return String(key || '').replace(
      /[A-Z]/g,
      (letter) => `-${letter.toLowerCase()}`,
  );
}

function toCssPropertyName(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return '';
  if (normalized.startsWith('--')) return normalized;

  return normalized.replace(
      /[A-Z]/g,
      (letter) => `-${letter.toLowerCase()}`,
  );
}

function styleObjectToString(style = {}) {
  return Object.entries(style)
      .filter(
          ([, value]) =>
            value !== false && value !== null && typeof value !== 'undefined',
      )
      .map(([key, value]) => {
        const cssKey = toCssPropertyName(key);
        if (!cssKey) return '';
        return `${cssKey}: ${String(value)}`;
      })
      .filter(Boolean)
      .join('; ');
}

const createEventAliases = {
  onModalReady: 'modal:ready',
  onModalUpdate: 'modal:update',
  onBeforeOpen: 'modal:before-open',
  onAfterOpen: 'modal:after-open',
  onBeforeClose: 'modal:before-close',
  onAfterClose: 'modal:after-close',
  onBeforeHide: 'modal:before-hide',
  onAfterHide: 'modal:after-hide',
  onBeforeShow: 'modal:before-show',
  onAfterShow: 'modal:after-show',
  onOpen: 'modal:after-open',
  onClose: 'modal:after-close',
  onHide: 'modal:after-hide',
  onShow: 'modal:after-show',
};

function toEventName(key) {
  const normalized = String(key || '').trim();
  if (createEventAliases[normalized]) {
    return createEventAliases[normalized];
  }

  if (!/^on[A-Z]/.test(normalized)) {
    return '';
  }

  return normalized
      .slice(2)
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[^a-z0-9:-]/gi, '')
      .toLowerCase();
}

function applyCreateAttribute(element, key, value) {
  if (typeof value === 'function') {
    const eventName = toEventName(key);
    if (eventName) {
      // Modal and drawer lifecycle events bubble; a handler given to create()
      // belongs to this element and must not hear a nested modal or drawer.
      const handler = /^(modal|drawer):/.test(eventName)
        ? (event) => { if (event.target === element) value.call(element, event); }
        : value;
      element.addEventListener(eventName, handler);
      if (!element.__sfCreateEventHandlers) {
        Object.defineProperty(element, '__sfCreateEventHandlers', {
          configurable: true,
          enumerable: false,
          value: [],
        });
      }
      element.__sfCreateEventHandlers.push({ eventName, handler });
      return;
    }
  }

  const attr = toAttributeName(key);
  if (!attr) {
    return;
  }

  if (value === false || value === null || typeof value === 'undefined') {
    element.removeAttribute(attr);
    return;
  }

  if (value === true) {
    element.setAttribute(attr, '');
    return;
  }

  if (
    (attr === 'style' || attr.endsWith('-style')) &&
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    const style = styleObjectToString(value);
    if (style) {
      element.setAttribute(attr, style);
    } else {
      element.removeAttribute(attr);
    }
    return;
  }

  if (Array.isArray(value)) {
    element.setAttribute(
        attr,
        value
            .filter((item) => item !== null && typeof item !== 'undefined')
            .join(' '),
    );
    return;
  }

  element.setAttribute(attr, String(value));
}

function appendCreateChildren(element, children) {
  const normalizedChildren = Array.isArray(children)
      ? children.flat(Infinity)
      : [children];

  normalizedChildren
      .filter(
          (child) =>
              child !== null && typeof child !== 'undefined' && child !== false,
      )
      .forEach((child) => {
        if (child instanceof Node) {
          element.append(child);
          return;
        }

        element.append(document.createTextNode(String(child)));
      });
}

function createSmartElement(name, params = {}) {
  const tagName = normalizeSmartTagName(name);

  if (!tagName) {
    throw new Error('SF.create(name, params): name is required');
  }

  const element = document.createElement(tagName);
  const nextParams = params && typeof params === 'object' ? params : {};
  const { attrs, attributes, dataset, children, html, textContent, ...rest } =
      nextParams;

  [rest, attrs, attributes].forEach((source) => {
    if (!source || typeof source !== 'object') {
      return;
    }

    Object.entries(source).forEach(([key, value]) => {
      applyCreateAttribute(element, key, value);
    });
  });

  if (dataset && typeof dataset === 'object') {
    Object.entries(dataset).forEach(([key, value]) => {
      const dataKey = toAttributeName(key);
      if (!dataKey || value === null || typeof value === 'undefined') {
        return;
      }

      element.setAttribute(`data-${dataKey}`, String(value));
    });
  }

  if (typeof html === 'string') {
    element.innerHTML = html;
  } else if (typeof textContent !== 'undefined' && textContent !== null) {
    element.textContent = String(textContent);
  }

  if (typeof children !== 'undefined') {
    appendCreateChildren(element, children);
  }

  return element;
}

// Loads a rule by its name -- a component, a Smart element, a lazy relation --
// unless it is loaded or on its way.
SFLoaderPlugin.prototype.ensurePlugin = function (name) {
  const key = String(name || '').trim();
  if (!key || !this.findPlugins?.[key]) return false;
  if (this.module[key]) return true;
  this.setExistCookie(key);
  this.mutate(() => this.getLoader(this.module, true));
  return true;
};

// The lazy relations, fetched after the page is ready while the browser is
// idle, a few at a time, so the first interaction finds them loaded.
SFLoaderPlugin.prototype.prefetchLazyRelations = function () {
  const pending = [...this.lazyRelations].filter((name) => !this.module[name]);
  if (!pending.length) return;
  const idle = globalThis.requestIdleCallback
    ? (fn) => globalThis.requestIdleCallback(fn, {timeout: 2000})
    : (fn) => setTimeout(fn, 200);
  const step = () => {
    const batch = pending.splice(0, 4);
    for (const name of batch) this.ensurePlugin(name);
    if (pending.length) idle(step);
  };
  idle(step);
};

SFLoaderPlugin.prototype.ensureSmartElementLoaded = function (tagName) {
  const normalizedTag = String(tagName || '').trim().toLowerCase();
  if (!normalizedTag.includes('-')) {
    return false;
  }

  const tagRules = this.getCustomElementRules();
  const componentName = tagRules[normalizedTag];

  if (!componentName) {
    console.warn(`SFLoader: smart tag rule not found for ${normalizedTag}`);
    return false;
  }

  if (this.module[componentName]) {
    return true;
  }

  this.setExistCookie(componentName);
  this.mutate(() => this.getLoader(this.module, true));

  return true;
};

async function createSmartElementAsync(name, params = {}) {
  const element = createSmartElement(name, params);
  const tagName = element.tagName.toLowerCase();

  if (window.SF?.Loader?.ensureSmartElementLoaded) {
    window.SF.Loader.ensureSmartElementLoaded(tagName);
  }

  if (window.customElements?.whenDefined) {
    await window.customElements.whenDefined(tagName);
  }
  window.customElements?.upgrade?.(element);

  return element;
}

SF.Loader = new SFLoaderPlugin(props);
// Read live: SF.loadSmartBase() replaces the Loader's promise, and a copy taken
// here once would never see it.
Object.defineProperty(SF, 'smartBaseReady', {
  configurable: true,
  enumerable: true,
  get: () => SF.Loader.smartBaseReady || Promise.resolve(SF.smart || null),
});
SF.loadSmartBase = function loadSmartBase() {
  return SF.Loader.loadSmartBase();
};
// The field renderer set is a module, not an element: no tag brings it, so a
// page that renders fields without a composite that carries the set used to
// add the script by hand and poll for SF.fieldRenderers. This asks for it once,
// from the Smart base, and settles with the set when it has published itself
// -- from this script or from any bundle that carries a copy of it.
let fieldRenderersReady = null;
SF.whenFieldRenderers = function whenFieldRenderers() {
  if (SF.fieldRenderers?.renderEditField) return Promise.resolve(SF.fieldRenderers);
  if (fieldRenderersReady) return fieldRenderersReady;
  fieldRenderersReady = new Promise((resolve, reject) => {
    const settle = () => {
      if (!SF.fieldRenderers?.renderEditField) return false;
      document.removeEventListener('sf-field-renderers-ready', settle);
      resolve(SF.fieldRenderers);
      return true;
    };
    document.addEventListener('sf-field-renderers-ready', settle);
    if (settle()) return;
    const asked = [...document.scripts].some((script) => /\/field-renderers\/js\/field-renderers(?:\.min)?\.js(?:[?#]|$)/u.test(script.src));
    if (asked) return;
    SF.loadRuntime?.();
    const loader = SF.Loader;
    loader.addScript(`${loader.smartPath}/field-renderers/js/field-renderers${loader.minified ? '.min' : ''}.js`)
      .then(() => settle())
      .catch((error) => {
        fieldRenderersReady = null;
        document.removeEventListener('sf-field-renderers-ready', settle);
        reject(error);
      });
  });
  return fieldRenderersReady;
};
SF.create = createSmartElement;
SF.createAsync = createSmartElementAsync;
SF.__internal.litHtml = (tagName, props = {}) => {
  if (!/^sf-[a-z0-9-]+$/.test(tagName) && !SF.Loader.getCustomElementRules()[tagName]) {
    tagName = `sf-${tagName}`
    if (!/^sf-[a-z0-9-]+$/.test(tagName)) {
      throw new Error(`Invalid SF tag name: ${tagName}`);
    }
  }

  const tag = unsafeStatic(tagName);
  return staticHtml`<${tag} ...=${props}></${tag}>`;
};
SF.whenDefine = whenSmartDefined;
SF.whenDefined = whenSmartDefined;
try {
  window.dispatchEvent(
      new CustomEvent('sf-loader-init', {
        detail: { loader: SF.Loader, timestamp: Date.now() },
      }),
  );
} catch (e) {
  console.warn('sf-loader-init dispatch failed', e);
}
if (Array.isArray(window.SF_PENDING_COMPONENTS)) {
  while (window.SF_PENDING_COMPONENTS.length) {
    const [n, c] = window.SF_PENDING_COMPONENTS.shift() || [];
    if (!n || !c) continue;
    if (SF.Loader.ComponentRegistry[n]) continue;
    try {
      SF.Loader.registerComponent(n, c);
    } catch (err) {
      console.warn('pending component register failed', n, err);
    }
  }
}
