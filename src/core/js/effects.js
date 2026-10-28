// Background effects (simai.effect 1.1.0; Larena's design of 2026-10-14,
// larena-specs docs/architecture/2026-10-14-background-effects.md). An effect
// is an animated background drawn into one area of a page; its manifest
// (effect.json) says everything a product needs to list and configure it
// without running its code, and its module exports mount(host, settings,
// context) -> {update, pause, resume, destroy}.
//
// Since 1.1 a manifest may declare the schemes it draws (dark, light; none
// means both), the pair of the other scheme, and the windows capability. The
// effect learns the scheme it draws in as context.scheme, and a switch reaches
// it as update(settings, context) without a remount. A placement has a theme
// mode (auto, dark, light): resolveTheme picks the effect, its pair or
// nothing, allowedModes says what an editor may offer, and the area takes the
// drawn theme's class. mountWindows draws one scene behind a group of window
// cards. loadEffect and placeEffect take an effect from the pinned catalogue
// (simai/ui-effects), every file checked against the index's SHA-256, and
// data-sf-effect / data-sf-effect-windows place one from markup.
//
// What lives here is the part every product would otherwise write again:
// checking a manifest, turning stored values into checked settings with the
// defaults filled, and mounting an effect under the rules -- one still frame
// for a person who asked for less motion, nothing drawn while the tab is
// hidden, the host out of the accessibility tree and out of the pointer's
// way, and everything gone after destroy. A foreign effect -- one not in the
// pinned catalogue, or a pair given as an address -- never runs in the page:
// it runs in a sandboxed frame of its own (an opaque origin under a strict
// content security policy, its checked settings sent by message), or, with
// SF_BOOT_CONFIG.effects.foreign = 'refuse', not at all.

import {isSchema, schemaFields} from './composition/schema-name.mjs';
import {noteDeprecated} from './deprecations.js';

// The fields a writer of an effect.json emits: the format named without a
// version, with schema_version beside it (format-names-without-version). A
// reader takes either form: schema-name.mjs.
export const EFFECT_FORMAT = Object.freeze(schemaFields('simai.effect', 1));
// The older label of the same format, which readers still take until the
// journal retires it (global-effect-schema-constant). Its value stays: a
// writer that put it alone in "schema" would otherwise emit a name with no
// schema_version.
export const EFFECT_SCHEMA = 'simai.effect.v1';
const SETTING_TYPES = new Set(['choice', 'integer', 'number', 'boolean', 'string', 'text', 'color', 'file']);
const ID = /^[a-z][a-z0-9-]{1,40}$/u;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/u;
const KEY = /^[a-zA-Z][a-zA-Z0-9]{0,40}$/u;
const FILE = /^[a-z0-9][a-z0-9._-]*$/u;
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const SCHEMES = ['dark', 'light'];
const CAPABILITIES = new Set(['windows']);
const PAIR_URL = /^https:\/\/[^\s?#]+\/effect\.json$/u;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => isObject(value) && Object.keys(value).length > 0
  && Object.entries(value).every(([lang, text]) => /^[a-z]{2}(-[A-Z]{2})?$/u.test(lang) && typeof text === 'string' && text.length > 0);

// The problems of a manifest, empty when it holds.
export function checkEffectManifest(manifest) {
  if (!isObject(manifest)) return ['manifest: not an object'];
  const problems = [];
  const allowed = ['schema', 'schema_version', 'id', 'version', 'label', 'author', 'entry', 'styles', 'preview', 'surfaces', 'schemes', 'pair', 'capabilities', 'settings', 'needs'];
  for (const key of Object.keys(manifest)) if (!allowed.includes(key)) problems.push(`${key}: undeclared`);
  if (!isSchema(manifest, 'simai.effect', 1)) problems.push('schema: not simai.effect, schema_version 1');
  if (typeof manifest.id !== 'string' || !ID.test(manifest.id)) problems.push('id');
  if (typeof manifest.version !== 'string' || !VERSION.test(manifest.version)) problems.push('version');
  if (!isText(manifest.label)) problems.push('label');
  if (typeof manifest.entry !== 'string' || !FILE.test(manifest.entry) || !/\.m?js$/u.test(manifest.entry)) problems.push('entry: one module file');
  if (manifest.styles !== undefined && (!Array.isArray(manifest.styles) || !manifest.styles.every((file) => typeof file === 'string' && FILE.test(file) && file.endsWith('.css')))) problems.push('styles');
  if (!Array.isArray(manifest.surfaces) || !manifest.surfaces.length) problems.push('surfaces');
  // simai.effect 1.1: the schemes it draws, the pair of the other scheme, what it is safe for.
  const schemes = manifest.schemes;
  if (schemes !== undefined && (!Array.isArray(schemes) || !schemes.length || schemes.length > 2
    || !schemes.every((scheme) => SCHEMES.includes(scheme)) || new Set(schemes).size !== schemes.length)) problems.push('schemes: one or both of dark, light');
  if (manifest.pair !== undefined) {
    if (typeof manifest.pair !== 'string' || !(ID.test(manifest.pair) || (PAIR_URL.test(manifest.pair) && manifest.pair.length <= 2048))) problems.push('pair: a catalogue id or the https URL of an effect.json');
    if (!Array.isArray(schemes) || schemes.length !== 1) problems.push('pair: only a single-scheme effect names a pair');
  }
  if (manifest.capabilities !== undefined && (!Array.isArray(manifest.capabilities)
    || !manifest.capabilities.every((name) => CAPABILITIES.has(name)) || new Set(manifest.capabilities).size !== manifest.capabilities.length)) problems.push('capabilities: known names, each once');
  if (!isObject(manifest.needs) || manifest.needs.network !== false || Object.keys(manifest.needs).length !== 1) problems.push('needs: {network: false}');
  if (!Array.isArray(manifest.settings)) {
    problems.push('settings');
    return problems;
  }
  const keys = new Set();
  manifest.settings.forEach((setting, index) => {
    const at = `settings[${index}]`;
    if (!isObject(setting)) { problems.push(`${at}: not an object`); return; }
    if (typeof setting.key !== 'string' || !KEY.test(setting.key)) problems.push(`${at}: key`);
    else if (keys.has(setting.key)) problems.push(`${at}: key ${setting.key} twice`);
    keys.add(setting.key);
    if (!SETTING_TYPES.has(setting.type)) problems.push(`${at}: type`);
    if (!isText(setting.label)) problems.push(`${at}: label`);
    if (!('default' in setting)) problems.push(`${at}: default`);
    if (setting.type === 'choice' && (!Array.isArray(setting.options) || !setting.options.length)) problems.push(`${at}: a choice names its options`);
    if (['integer', 'number'].includes(setting.type) && (typeof setting.min !== 'number' || typeof setting.max !== 'number')) problems.push(`${at}: a number states min and max`);
    if (['string', 'text'].includes(setting.type) && typeof setting.max !== 'number') problems.push(`${at}: a string states its max length`);
    if ('default' in setting && SETTING_TYPES.has(setting.type)) {
      const checked = checkSetting(setting, setting.default);
      if (!checked.ok) problems.push(`${at}: default is not a valid value`);
    }
  });
  return problems;
}

// One value against its setting: {ok, value}. Nothing is coerced beyond what a
// stored value plainly means (a numeric string for a number, «1»/«0» for a
// boolean), and a value out of bounds is not clamped -- it is invalid.
export function checkSetting(setting, raw) {
  const fail = {ok: false, value: undefined};
  switch (setting.type) {
    case 'boolean': {
      if (typeof raw === 'boolean') return {ok: true, value: raw};
      if (raw === '1' || raw === 'true') return {ok: true, value: true};
      if (raw === '0' || raw === 'false') return {ok: true, value: false};
      return fail;
    }
    case 'integer':
    case 'number': {
      const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
      if (typeof value !== 'number' || !Number.isFinite(value)) return fail;
      if (setting.type === 'integer' && !Number.isInteger(value)) return fail;
      if (value < setting.min || value > setting.max) return fail;
      return {ok: true, value};
    }
    case 'choice': {
      const option = (setting.options ?? []).find((entry) => String(entry.value) === String(raw));
      return option ? {ok: true, value: option.value} : fail;
    }
    case 'string':
    case 'text': {
      if (typeof raw !== 'string' || raw.length > setting.max) return fail;
      if (setting.type === 'string' && /[\r\n]/u.test(raw)) return fail;
      return {ok: true, value: raw};
    }
    case 'color':
      return typeof raw === 'string' && COLOR.test(raw) ? {ok: true, value: raw.toLowerCase()} : fail;
    case 'file':
      // A file is the product's: an address or an identity of one of the site's
      // own files, which the product resolved and checked before this point.
      return raw === null || raw === '' || (typeof raw === 'string' && raw.length <= 2048) ? {ok: true, value: raw || null} : fail;
    default:
      return fail;
  }
}

// Stored values -> the settings an effect gets: every key of the manifest, the
// stored value where it is valid, the default where it is absent or not.
// `invalid` names the keys whose stored value was dropped.
export function effectSettings(manifest, stored = {}) {
  const settings = {};
  const invalid = [];
  for (const setting of manifest.settings ?? []) {
    if (Object.hasOwn(stored ?? {}, setting.key)) {
      const checked = checkSetting(setting, stored[setting.key]);
      if (checked.ok) {
        settings[setting.key] = checked.value;
        continue;
      }
      invalid.push(setting.key);
    }
    settings[setting.key] = checkSetting(setting, setting.default).value;
  }
  return {settings: Object.freeze(settings), invalid};
}

// The schemes an effect draws: as declared, or both when it declares none (1.0).
export function effectSchemes(manifest) {
  return Array.isArray(manifest?.schemes) && manifest.schemes.length ? [...manifest.schemes] : [...SCHEMES];
}

// A pair given as a URL is outside the catalogue that holds the effect: it is
// foreign, and runs only in a sandbox (pair-under-the-same-trust).
export const pairIsForeign = (manifest) => typeof manifest?.pair === 'string' && PAIR_URL.test(manifest.pair);

const reducedMotion = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const capabilities = (manifest) => (Array.isArray(manifest?.capabilities) ? manifest.capabilities : []);
const STATE = 'data-sf-effect-state';
const REASON = 'data-sf-effect-reason';
const WINDOW = '[data-sf-effect-window]';

// Foreign effects in a sandbox (foreign-effects-sandboxed) ------------------
//
// An effect from outside the pinned catalogue has no index to check it
// against, so nothing vouches for its code: the trust boundary is the frame
// it runs in. The frame is sandboxed with allow-scripts alone -- no
// allow-same-origin, so its origin is opaque and it reaches neither the
// page, its cookies nor its storage; no allow-top-navigation, allow-popups,
// allow-forms or allow-modals. Its document is written here (srcdoc) under a
// content security policy that lets in one script, the frame's own runner
// (by its SHA-256), and the module it is handed (a Blob URL made inside the
// frame); it may connect nowhere and load no image but data: and blob:. A
// hash, not a nonce: a module imported by a nonced script inherits the nonce
// for its own import(), which would let an effect import from anywhere. The
// module's text was fetched once by the page and is delivered by message,
// with the settings already checked against the manifest; the frame then
// hears of its size, scheme, palette tones, pause, resume, update and
// destroy the same way.

const SANDBOXED = new WeakSet();

function effectsConfig() {
  return globalThis.SF_BOOT_CONFIG?.effects ?? {};
}

// SF_BOOT_CONFIG.effects.foreign: 'sandbox' (the default) or 'refuse'. Any
// other value refuses: a switch mistyped fails closed.
export function foreignMode(value = effectsConfig().foreign) {
  return value === undefined || value === 'sandbox' ? 'sandbox' : 'refuse';
}

const FRAME_POLICY = () => [
  "default-src 'none'",
  `script-src 'sha256-${FRAME_RUNNER_SHA256}' blob:`,
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'media-src data: blob:',
  'font-src data:',
  "connect-src 'none'",
  "worker-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "object-src 'none'",
  "manifest-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

// The runner inside the frame. A plain string, so no build step rewrites it:
// it takes one port from the page and nothing else, imports the module from
// a Blob URL of the text it is sent, and answers only "mounted" and "error".
export const FRAME_RUNNER = String.raw`(() => {
  'use strict';
  const root = document.documentElement;
  const host = document.getElementById('host');
  let port = null;
  let handle = null;
  let queue = Promise.resolve();
  const send = (message) => { try { port.postMessage(message); } catch (error) { /* closed */ } };
  const fail = (phase, error) => send({type: 'error', phase, message: String((error && error.message) || error).slice(0, 500)});
  const call = (name, ...args) => {
    try { if (handle && typeof handle[name] === 'function') handle[name](...args); } catch (error) { fail(name, error); }
  };
  const look = (scheme, tones) => {
    const light = scheme === 'light';
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add(light ? 'theme-light' : 'theme-dark');
    root.style.colorScheme = light ? 'light' : 'dark';
    for (const [name, value] of Object.entries(tones || {})) root.style.setProperty(name, value);
  };
  const size = (box) => {
    if (!box) return;
    host.style.inlineSize = box.width + 'px';
    host.style.blockSize = box.height + 'px';
  };
  const handlers = {
    async mount(data) {
      look(data.context.scheme, data.tones);
      size(data.size);
      for (const css of data.styles) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.append(style);
      }
      const url = URL.createObjectURL(new Blob([data.source], {type: 'text/javascript'}));
      let module;
      try { module = await import(url); } catch (error) { fail('module', error); return; } finally { URL.revokeObjectURL(url); }
      if (!module || typeof module.mount !== 'function') { fail('module', 'no mount export'); return; }
      try { handle = module.mount(host, data.settings, Object.freeze(data.context)) || {}; } catch (error) { fail('mount', error); return; }
      send({type: 'mounted'});
    },
    update(data) {
      look(data.context.scheme, data.tones);
      call('update', data.settings, Object.freeze(data.context));
    },
    pause() { call('pause'); },
    resume() { call('resume'); },
    size(data) { size(data.size); },
    destroy() {
      call('destroy');
      handle = null;
      host.replaceChildren();
      port.close();
    },
  };
  addEventListener('message', function first(event) {
    if (event.source !== parent || event.data !== 'sf-effect-sandbox' || !event.ports[0]) return;
    removeEventListener('message', first);
    port = event.ports[0];
    port.onmessage = ({data}) => {
      const run = data && Object.hasOwn(handlers, data.type) ? handlers[data.type] : null;
      if (run) queue = queue.then(() => run(data)).catch((error) => fail(data.type, error));
    };
  });
})();`;

// The runner's SHA-256 (base64), the one script the frame's policy admits by
// content. The contract test effect-manifest recomputes it from the text.
export const FRAME_RUNNER_SHA256 = 'VOLJzSJh85fxDvhl9WytjdmjtDAUN8JT5veHYwFCVPA=';

function frameDocument() {
  return '<!doctype html><html><head><meta charset="utf-8">'
    + `<meta http-equiv="Content-Security-Policy" content="${FRAME_POLICY()}">`
    + '<style>html,body{margin:0;block-size:100%;overflow:hidden;background:transparent}#host{position:absolute;inset:0;overflow:hidden}</style>'
    + `</head><body><div id="host"></div><script>${FRAME_RUNNER}</script></body></html>`;
}

// The palette tones as the page resolves them at the host (fixed across
// themes, drawn-with-palette-tones), handed to the frame, which has no sheet.
const PALETTES = ['primary', 'secondary', 'tertiary', 'neutral', 'neutral-variant', 'error', 'warning', 'success', 'info'];
function paletteTones(host) {
  const style = globalThis.getComputedStyle(host);
  const tones = {};
  for (const palette of PALETTES) {
    for (let tone = 0; tone <= 100; tone += 1) {
      const name = `--sf-${palette}-${tone}`;
      const value = style.getPropertyValue(name).trim();
      if (value && value.length <= 200) tones[name] = value;
    }
  }
  return tones;
}

// A module whose mount draws the effect in a sandboxed frame filling the
// host. It is mounted like any module, so every rule of mountModule (still
// frame, hidden tab, off screen, aria-hidden, destroy) holds for it too.
function sandboxModule({id, source, styles = []}) {
  const module = Object.freeze({
    mount(host, settings, context) {
      const document = host.ownerDocument;
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.setAttribute('tabindex', '-1');
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('title', '');
      frame.setAttribute('data-sf-effect-sandbox', 'loading');
      frame.style.cssText = 'position:absolute;inset:0;inline-size:100%;block-size:100%;border:0;margin:0;padding:0;display:block;pointer-events:none;background:transparent';
      frame.srcdoc = frameDocument();
      const channel = new globalThis.MessageChannel();
      const port = channel.port1;
      const pending = [];
      let ready = false;
      let loads = 0;
      let destroyed = false;
      const box = () => {
        const rect = host.getBoundingClientRect();
        return {width: rect.width, height: rect.height};
      };
      const post = (message) => {
        if (destroyed) return;
        if (ready) port.postMessage(message);
        else pending.push(message);
      };
      const failed = (phase, message) => host.dispatchEvent(new globalThis.CustomEvent('sf-effect-error', {
        bubbles: true, detail: {effect: id, phase, message, sandboxed: true},
      }));
      const sizes = globalThis.ResizeObserver ? new globalThis.ResizeObserver(() => post({type: 'size', size: box()})) : null;
      const teardown = () => {
        destroyed = true;
        sizes?.disconnect();
        port.close();
        frame.remove();
      };
      // What the frame says is data: two kinds of message, strings cut short.
      port.onmessage = ({data}) => {
        if (destroyed || !isObject(data)) return;
        if (data.type === 'mounted') frame.setAttribute('data-sf-effect-sandbox', 'mounted');
        else if (data.type === 'error') failed(String(data.phase).slice(0, 40), String(data.message).slice(0, 500));
      };
      port.start();
      frame.addEventListener('load', () => {
        if (destroyed) return;
        loads += 1;
        // The frame's document is the one written here, once. A second load
        // means the frame went somewhere else: it is no longer the runner.
        if (loads > 1) {
          failed('sandbox', 'the sandbox frame navigated away and was removed');
          teardown();
          return;
        }
        frame.contentWindow?.postMessage('sf-effect-sandbox', '*', [channel.port2]);
        ready = true;
        for (const message of pending.splice(0)) port.postMessage(message);
      });
      post({type: 'mount', source, styles: [...styles], settings: {...settings}, context: {...context}, tones: paletteTones(host), size: box()});
      host.append(frame);
      sizes?.observe(host);
      return {
        update(next, nextContext) {
          post({type: 'update', settings: {...next}, context: {...nextContext}, tones: paletteTones(host)});
        },
        pause() {
          post({type: 'pause'});
        },
        resume() {
          post({type: 'resume'});
        },
        destroy() {
          if (destroyed) return;
          post({type: 'destroy'});
          teardown();
        },
      };
    },
  });
  SANDBOXED.add(module);
  return module;
}

// Whether a module handed to SF.Effects is one the core made to run in the sandbox.
const isSandboxed = (module) => Boolean(module) && SANDBOXED.has(module);

// One effect's module in one host under the 1.0 rules: one still frame for a
// person who asked for less motion, nothing drawn while the tab is hidden or
// the host is off screen, the host out of the accessibility tree and out of
// the pointer's way, and everything gone after destroy. The handle's methods
// are safe to call in any order and more than once.
function mountModule(host, {manifest, module, stored = {}, locale, scheme} = {}) {
  if (!(host instanceof globalThis.Element)) throw new TypeError('An effect mounts into an element');
  const problems = checkEffectManifest(manifest);
  if (problems.length) throw new TypeError(`Effect manifest is invalid: ${problems.join('; ')}`);
  const mount = typeof module === 'function' ? module : module?.mount;
  if (typeof mount !== 'function') throw new TypeError('An effect module exports mount(host, settings, context)');
  // The host stands under the page: read by nobody, touched by no pointer.
  host.setAttribute('aria-hidden', 'true');
  host.style.pointerEvents = 'none';
  const ownsName = !host.hasAttribute('data-sf-effect');
  if (ownsName) host.setAttribute('data-sf-effect', manifest.id);
  // A mounted host is never taken for a declared placement still to mount.
  const ownsState = !host.hasAttribute(STATE);
  if (ownsState) host.setAttribute(STATE, 'running');
  const document = host.ownerDocument;
  let {settings} = effectSettings(manifest, stored);
  // The scheme it draws in: one it declares, its home scheme otherwise.
  const drawable = effectSchemes(manifest);
  const pick = (wanted) => (drawable.includes(wanted) ? wanted : drawable[0]);
  let drawn = pick(scheme);
  const context = () => Object.freeze({
    reducedMotion: reducedMotion(),
    locale: locale ?? (document.documentElement.getAttribute('lang') || 'en'),
    scheme: drawn,
  });
  let handle = mount(host, settings, context()) ?? {};
  let running = true;
  let held = false;
  let offscreen = false;
  let destroyed = false;
  const call = (name, ...args) => {
    try {
      handle?.[name]?.(...args);
    } catch (error) {
      host.dispatchEvent(new globalThis.CustomEvent('sf-effect-error', {bubbles: true, detail: {effect: manifest.id, phase: name, message: String(error?.message ?? error)}}));
    }
  };
  // It runs while nobody paused it, the tab is shown and the host is on screen.
  const sync = () => {
    if (destroyed) return;
    const wanted = !held && !document.hidden && !offscreen;
    if (wanted === running) return;
    running = wanted;
    call(wanted ? 'resume' : 'pause');
  };
  document.addEventListener('visibilitychange', sync);
  // A person who turns reduced motion on is given a still frame at once: the
  // effect is mounted again with the context that says so.
  const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const onMotion = () => {
    if (destroyed) return;
    call('destroy');
    host.replaceChildren();
    handle = mount(host, settings, context()) ?? {};
    running = true;
    sync();
  };
  motion?.addEventListener?.('change', onMotion);
  // Off screen it asks for no frames either.
  const Sight = globalThis.IntersectionObserver;
  const sight = Sight ? new Sight((entries) => {
    offscreen = !entries[entries.length - 1].isIntersecting;
    sync();
  }) : null;
  sight?.observe(host);
  sync();
  return Object.freeze({
    // New settings, and with {scheme} a switch of the scheme it draws in --
    // both without a remount.
    update(stored, {scheme: next} = {}) {
      if (destroyed) return;
      settings = effectSettings(manifest, stored).settings;
      if (next !== undefined) drawn = pick(next);
      call('update', settings, context());
    },
    get scheme() {
      return drawn;
    },
    // Whether it runs in the sandbox (a foreign effect) rather than in the page.
    get sandboxed() {
      return isSandboxed(module);
    },
    pause() {
      held = true;
      sync();
    },
    resume() {
      held = false;
      sync();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener('visibilitychange', sync);
      motion?.removeEventListener?.('change', onMotion);
      sight?.disconnect();
      call('destroy');
      // Whatever the effect left behind goes with it.
      host.replaceChildren();
      if (ownsName) host.removeAttribute('data-sf-effect');
      if (ownsState) host.removeAttribute(STATE);
    },
  });
}

// Theme policy (simai.effect 1.1, theme-follows-the-placement) ---------------

const THEME_MODES = ['auto', 'dark', 'light'];
const THEME_CLASSES = ['theme-dark', 'theme-light'];

// The page's scheme as the Framework sets it: the theme class on <html> (the
// Loader's checkTheme), the reader's system preference where there is none.
export function pageScheme(document = globalThis.document) {
  const root = document?.documentElement;
  if (root?.classList.contains('theme-dark')) return 'dark';
  if (root?.classList.contains('theme-light')) return 'light';
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// A pair that can be drawn: one by catalogue id, or one by address while
// foreign effects run in the sandbox.
const drawablePair = (manifest, foreign) => typeof manifest?.pair === 'string'
  && (!pairIsForeign(manifest) || foreignMode(foreign) === 'sandbox');

// The theme modes an editor may offer for a placement: auto always, a fixed
// mode only when the effect -- or its pair, a catalogue pair or a foreign one
// run in the sandbox -- draws that scheme. `pair` is the pair's manifest when
// it is known; without it a pair is taken to draw the other scheme, as a pair
// does. `foreign` overrides SF_BOOT_CONFIG.effects.foreign.
export function allowedModes(manifest, {pair, foreign} = {}) {
  const drawn = new Set(effectSchemes(manifest));
  if (drawablePair(manifest, foreign)) for (const scheme of pair ? effectSchemes(pair) : SCHEMES) drawn.add(scheme);
  return ['auto', ...SCHEMES.filter((scheme) => drawn.has(scheme))];
}

// Which effect a placement draws, and in which scheme: {effect: 'self' |
// 'pair', scheme} or {hidden: true, reason}. The order: the effect in the
// target scheme; its pair in the target scheme; in auto, a single-scheme
// effect in its own scheme -- a dark-only effect stays dark on a light page,
// a light-only one light on a dark page; nothing -- a fixed mode the effect
// cannot draw. A pair given as an address is foreign: it is drawn only in the
// sandbox (sandboxed: true), and with foreign effects refused the placement
// is hidden.
export function resolveTheme(manifest, {pageScheme: page, themeMode = 'auto', pair, foreign} = {}) {
  if (!THEME_MODES.includes(themeMode)) return Object.freeze({hidden: true, reason: 'unknown-theme-mode'});
  const target = themeMode === 'auto' ? ((page ?? pageScheme()) === 'dark' ? 'dark' : 'light') : themeMode;
  const own = effectSchemes(manifest);
  if (own.includes(target)) return Object.freeze({effect: 'self', scheme: target});
  if (typeof manifest?.pair === 'string') {
    const outside = pairIsForeign(manifest);
    if (outside && foreignMode(foreign) !== 'sandbox') return Object.freeze({hidden: true, reason: 'foreign-pair-needs-sandbox'});
    if (!pair || effectSchemes(pair).includes(target)) {
      return Object.freeze(outside ? {effect: 'pair', scheme: target, pair: manifest.pair, sandboxed: true} : {effect: 'pair', scheme: target, pair: manifest.pair});
    }
  }
  if (themeMode === 'auto' && own.length) return Object.freeze({effect: 'self', scheme: own[0]});
  return Object.freeze({hidden: true, reason: 'mode-not-drawable'});
}

// The areas a placement draws under take the theme it is drawn in
// (area-takes-the-drawn-theme); what they had before comes back after. A
// theme class changes the tokens but not the ink the area inherited from the
// page, so an area also takes AREA_CLASS, which core's sheet gives the drawn
// theme's text colour (color: var(--sf-on-surface), in sf.base, so an
// author's colour utility on the area still wins).
const AREA_CLASS = 'sf-effect-area';
function themeAreas() {
  const before = new Map();
  const restore = (element, had) => {
    element.classList.remove(...THEME_CLASSES, AREA_CLASS);
    if (had.length) element.classList.add(...had);
  };
  return {
    set(elements, scheme) {
      const wanted = `theme-${scheme}`;
      for (const element of elements) {
        if (!before.has(element)) before.set(element, [...THEME_CLASSES, AREA_CLASS].filter((name) => element.classList.contains(name)));
        if (!element.classList.contains(AREA_CLASS)) element.classList.add(AREA_CLASS);
        // Touched only when it changes, so an observer of the class sees no churn.
        const other = THEME_CLASSES.find((name) => name !== wanted);
        if (element.classList.contains(other)) element.classList.remove(other);
        if (!element.classList.contains(wanted)) element.classList.add(wanted);
      }
      for (const [element, had] of before) {
        if (elements.includes(element)) continue;
        restore(element, had);
        before.delete(element);
      }
    },
    restore() {
      for (const [element, had] of before) restore(element, had);
      before.clear();
    },
  };
}

// The page's theme, followed: the class the Loader sets on <html>, its
// sf-theme-change event, and the system preference a page without a class
// follows. One watch for every placement in auto.
const followers = new Set();
let unwatch = null;
function followPage(listener) {
  followers.add(listener);
  const document = globalThis.document;
  if (!unwatch && document?.documentElement) {
    const notify = () => {
      for (const follower of [...followers]) follower();
    };
    const classes = new globalThis.MutationObserver(notify);
    classes.observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener?.('change', notify);
    globalThis.addEventListener?.('sf-theme-change', notify);
    unwatch = () => {
      classes.disconnect();
      media?.removeEventListener?.('change', notify);
      globalThis.removeEventListener?.('sf-theme-change', notify);
    };
  }
  return () => {
    followers.delete(listener);
    if (!followers.size && unwatch) {
      unwatch();
      unwatch = null;
    }
  };
}

// Refusals that are a matter of trust are reported, not only hidden.
const TRUST = new Set(['foreign-pair-needs-sandbox', 'pair-refused']);

function report(element, effect, reason, detail = {}) {
  globalThis.console?.warn?.(`SF.Effects: ${effect} is not run (${reason})`, detail);
  element.dispatchEvent(new globalThis.CustomEvent('sf-effect-refused', {bubbles: true, detail: {effect, reason, ...detail}}));
}

// A placement: the effect or its pair drawn into `host` as the theme policy
// says, the `areas` in the drawn theme, the state on `element`; followed
// through page theme changes while its mode is auto.
function place({element, host, areas, manifest, module, pair, pairRefused, stored = {}, locale, themeMode = 'auto', windows = false, foreign}) {
  const problems = checkEffectManifest(manifest);
  if (problems.length) throw new TypeError(`Effect manifest is invalid: ${problems.join('; ')}`);
  // A trusted effect never pulls an untrusted pair inline: a pair by catalogue
  // id is the one it names; a pair by address runs only as the sandbox module
  // the core made for it (loadEffect), never as a module handed in.
  const outside = pairIsForeign(manifest);
  const usable = pair && isObject(pair.manifest) && !checkEffectManifest(pair.manifest).length
    && (outside ? isSandboxed(pair.module) : pair.manifest.id === manifest.pair) ? pair : null;
  const theme = themeAreas();
  let mode = themeMode;
  let values = stored;
  let current = null;
  let resolution = null;
  let held = false;
  let destroyed = false;
  element.setAttribute(STATE, 'running');
  const choose = () => {
    const page = pageScheme(host.ownerDocument);
    let next = resolveTheme(manifest, {pageScheme: page, themeMode: mode, pair: usable?.manifest, foreign});
    if (next.effect === 'pair' && !usable) {
      const reason = outside && pair ? 'foreign-pair-needs-sandbox' : pairRefused ? 'pair-refused' : 'pair-not-loaded';
      next = {hidden: true, reason};
    }
    else if (next.effect === 'pair' && windows && !capabilities(usable.manifest).includes('windows')) next = {hidden: true, reason: 'pair-without-windows'};
    const target = mode === 'dark' || mode === 'light' ? mode : page;
    return {next: Object.freeze(next), drawn: next.hidden ? target : next.scheme};
  };
  const apply = () => {
    if (destroyed) return false;
    const {next, drawn} = choose();
    theme.set(areas(), drawn);
    const which = next.hidden ? null : next.effect;
    const was = resolution ? (resolution.hidden ? null : resolution.effect) : undefined;
    const changed = !resolution || resolution.hidden !== next.hidden || resolution.reason !== next.reason || resolution.scheme !== next.scheme || resolution.effect !== next.effect;
    resolution = next;
    let updated = false;
    if (was === which && current) {
      if (current.scheme !== drawn) {
        current.update(values, {scheme: drawn});
        updated = true;
      }
    } else if (was !== which) {
      current?.destroy();
      current = null;
      if (which) {
        const chosen = which === 'self' ? {manifest, module} : usable;
        current = mountModule(host, {manifest: chosen.manifest, module: chosen.module, stored: values, locale, scheme: drawn});
        if (held) current.pause();
        updated = true;
      }
    }
    if (changed) {
      element.setAttribute(STATE, next.hidden ? 'hidden' : 'running');
      if (next.hidden) element.setAttribute(REASON, next.reason);
      else element.removeAttribute(REASON);
      if (next.hidden && TRUST.has(next.reason)) report(element, manifest.pair ?? manifest.id, next.reason, {pairOf: manifest.id});
    }
    return updated;
  };
  const unfollow = followPage(() => {
    if (mode === 'auto') apply();
  });
  try {
    apply();
  } catch (error) {
    unfollow();
    theme.restore();
    element.removeAttribute(STATE);
    throw error;
  }
  const handle = Object.freeze({
    // New settings (the pair takes those of its own keys that are valid for
    // it), and with {themeMode} another mode -- each without a remount when
    // the same effect stays.
    update(stored = values, {themeMode: nextMode} = {}) {
      if (destroyed) return;
      values = stored;
      if (nextMode !== undefined) mode = nextMode;
      if (!apply()) current?.update(values, {scheme: current.scheme});
    },
    pause() {
      held = true;
      current?.pause();
    },
    resume() {
      held = false;
      current?.resume();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unfollow();
      current?.destroy();
      current = null;
      theme.restore();
      element.removeAttribute(STATE);
      element.removeAttribute(REASON);
    },
    get scheme() {
      return current?.scheme ?? null;
    },
    get effect() {
      return resolution.hidden ? null : resolution.effect;
    },
    get resolution() {
      return resolution;
    },
    get themeMode() {
      return mode;
    },
    get sandboxed() {
      return current?.sandboxed ?? false;
    },
  });
  return {handle, apply: () => apply()};
}

// A layer under an element's content for the effect to draw in: the element
// becomes a positioned, isolated box, and the layer sits under its children.
function makeLayer(element) {
  const host = element.ownerDocument.createElement('div');
  host.setAttribute('data-sf-effect-layer', '');
  host.style.cssText = 'position:absolute;inset:0;z-index:-1;overflow:hidden;border-radius:inherit;pointer-events:none';
  const kept = {position: element.style.position, isolation: element.style.isolation};
  if (globalThis.getComputedStyle(element).position === 'static') element.style.position = 'relative';
  element.style.isolation = 'isolate';
  element.prepend(host);
  return {
    host,
    remove() {
      host.remove();
      element.style.position = kept.position;
      element.style.isolation = kept.isolation;
    },
  };
}

// Mount an effect's module under the rules. `module` is the imported entry
// (or its mount function). Without `themeMode` it draws in `scheme` (its home
// scheme when it cannot), as in 1.0. With `themeMode` (auto, dark, light) it
// is a placement: the theme policy picks the effect, its `pair` ({manifest,
// module}, a catalogue pair already loaded) or nothing, `area` (the host by
// default) takes the drawn theme's class, and auto follows the page's theme.
export function mountEffect(host, options = {}) {
  if (options.themeMode === undefined) return mountModule(host, options);
  if (!(host instanceof globalThis.Element)) throw new TypeError('An effect mounts into an element');
  const area = options.area instanceof globalThis.Element ? options.area : host;
  const {manifest, module, pair, stored, locale, themeMode, foreign} = options;
  return place({element: area, host, areas: () => [area], manifest, module, pair, stored, locale, themeMode, foreign}).handle;
}

// Windows mode (windows-are-mask-safe) -------------------------------------

const px = (value, size) => {
  const text = String(value).trim().split(/\s+/u)[0];
  const number = Number.parseFloat(text);
  if (!Number.isFinite(number)) return 0;
  return text.endsWith('%') ? (number / 100) * size : number;
};
const fixed = (value) => Number(value.toFixed(2));

// A rounded rectangle as a path, corner by corner.
function roundedRect(x, y, w, h, style) {
  const limit = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius']
    .map((name) => fixed(Math.min(px(style[name], Math.min(w, h)), limit)));
  [x, y, w, h] = [x, y, w, h].map(fixed);
  return `M${fixed(x + tl)} ${y}H${fixed(x + w - tr)}A${tr} ${tr} 0 0 1 ${fixed(x + w)} ${fixed(y + tr)}`
    + `V${fixed(y + h - br)}A${br} ${br} 0 0 1 ${fixed(x + w - br)} ${fixed(y + h)}`
    + `H${fixed(x + bl)}A${bl} ${bl} 0 0 1 ${x} ${fixed(y + h - bl)}V${fixed(y + tl)}A${tl} ${tl} 0 0 1 ${fixed(x + tl)} ${y}Z`;
}

function placeWindows(group, {windows = WINDOW, ...options}) {
  if (!(group instanceof globalThis.Element)) throw new TypeError('A windows group is an element');
  const problems = checkEffectManifest(options.manifest);
  if (problems.length) throw new TypeError(`Effect manifest is invalid: ${problems.join('; ')}`);
  if (!capabilities(options.manifest).includes('windows')) throw new TypeError('The effect does not declare the windows capability');
  const selector = typeof windows === 'string' && windows ? windows : WINDOW;
  const cards = () => [...group.querySelectorAll(selector)];
  const layer = makeLayer(group);
  let placed;
  try {
    placed = place({...options, element: group, host: layer.host, areas: cards, windows: true});
  } catch (error) {
    layer.remove();
    throw error;
  }
  // The scene is one, the size of the group; only the windows show it.
  let frame = 0;
  const build = () => {
    frame = 0;
    const origin = layer.host.getBoundingClientRect();
    const shapes = cards().map((card) => {
      const box = card.getBoundingClientRect();
      if (!box.width || !box.height) return '';
      return roundedRect(box.left - origin.left, box.top - origin.top, box.width, box.height, globalThis.getComputedStyle(card));
    }).filter(Boolean);
    layer.host.style.clipPath = shapes.length ? `path('${shapes.join(' ')}')` : 'inset(50%)';
  };
  const schedule = () => {
    if (!frame) frame = globalThis.requestAnimationFrame(build);
  };
  const Resize = globalThis.ResizeObserver;
  const sizes = Resize ? new Resize(schedule) : null;
  const watchCards = () => {
    if (!sizes) return;
    sizes.disconnect();
    sizes.observe(group);
    for (const card of cards()) sizes.observe(card);
  };
  // Cards that come and go: the effect's own nodes in the layer are not news.
  const changes = new globalThis.MutationObserver((records) => {
    if (records.every((record) => layer.host.contains(record.target))) return;
    watchCards();
    placed.apply();
    schedule();
  });
  changes.observe(group, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-sf-effect-window']});
  globalThis.addEventListener('scroll', schedule, {passive: true, capture: true});
  globalThis.addEventListener('resize', schedule, {passive: true});
  watchCards();
  build();
  const {handle} = placed;
  return Object.freeze({
    update: handle.update,
    pause: handle.pause,
    resume: handle.resume,
    // The windows were changed by other means than the DOM (a custom selector's class).
    refresh() {
      watchCards();
      placed.apply();
      schedule();
    },
    destroy() {
      if (frame) globalThis.cancelAnimationFrame(frame);
      frame = 0;
      sizes?.disconnect();
      changes.disconnect();
      globalThis.removeEventListener('scroll', schedule, {capture: true});
      globalThis.removeEventListener('resize', schedule);
      handle.destroy();
      layer.remove();
    },
    get scheme() {
      return handle.scheme;
    },
    get effect() {
      return handle.effect;
    },
    get resolution() {
      return handle.resolution;
    },
    get themeMode() {
      return handle.themeMode;
    },
    get sandboxed() {
      return handle.sandboxed;
    },
  });
}

// One effect drawn once behind a group (simai.effect 1.1, windows): seen only
// through the group's window cards (`windows`, a selector, default
// [data-sf-effect-window]), one continuous scene across them. Only for an
// effect declaring capabilities ["windows"]. Options as mountEffect's with a
// theme mode (auto by default); the window cards take the drawn theme, the
// other cards keep the page's.
export function mountWindows(group, options = {}) {
  const {manifest, module, pair, stored, locale, themeMode = 'auto', windows, foreign} = options;
  return placeWindows(group, {manifest, module, pair, stored, locale, themeMode, windows, foreign});
}

// Catalogue loading with integrity (pair-under-the-same-trust) --------------

class EffectRefused extends Error {
  constructor(reason, detail = {}) {
    super(reason);
    this.name = 'EffectRefused';
    this.reason = reason;
    this.detail = detail;
  }
}

const decode = (bytes) => new globalThis.TextDecoder().decode(bytes);
const pageAddress = () => globalThis.document?.baseURI ?? globalThis.location?.href;

// The catalogue base, an absolute address ending in a slash; null without one.
function catalogueBase(catalogue) {
  const value = catalogue ?? effectsConfig().catalogue;
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value, pageAddress());
    url.search = '';
    url.hash = '';
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.href;
  } catch {
    return null;
  }
}

async function sha256(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new EffectRefused('no-integrity-check');
  const hash = new Uint8Array(await subtle.digest('SHA-256', bytes));
  return [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchBytes(url) {
  let response;
  try {
    response = await globalThis.fetch(url, {credentials: 'omit', referrerPolicy: 'no-referrer'});
  } catch {
    throw new EffectRefused('fetch-failed', {url});
  }
  if (!response.ok) throw new EffectRefused('fetch-failed', {url, status: response.status});
  return new Uint8Array(await response.arrayBuffer());
}

const indexes = new Map();
function catalogueIndex(base) {
  if (!indexes.has(base)) {
    const loading = (async () => {
      const config = effectsConfig();
      const own = catalogueBase() === base;
      const file = (own && config.index) || 'catalogue/index.json';
      const bytes = await fetchBytes(new URL(file, base).href);
      if (own && config.indexSha256 && (await sha256(bytes)) !== config.indexSha256) throw new EffectRefused('integrity', {file});
      let index;
      try {
        index = JSON.parse(decode(bytes));
      } catch {
        throw new EffectRefused('invalid-index', {file});
      }
      if (index?.schema !== 'simai.ui-effects.catalogue' || !Array.isArray(index.effects)) throw new EffectRefused('invalid-index', {file});
      return index;
    })();
    loading.catch(() => indexes.delete(base));
    indexes.set(base, loading);
  }
  return indexes.get(base);
}

// The module runs from the bytes that were verified, never from a second fetch.
async function importVerified(bytes) {
  const url = globalThis.URL.createObjectURL(new globalThis.Blob([bytes], {type: 'text/javascript'}));
  try {
    return await import(/* webpackIgnore: true */ url);
  } catch (error) {
    throw new EffectRefused('module-failed', {message: String(error?.message ?? error)});
  } finally {
    globalThis.URL.revokeObjectURL(url);
  }
}

async function loadVerified(base, id) {
  const index = await catalogueIndex(base);
  const entry = index.effects.find((candidate) => candidate?.id === id);
  if (!entry) throw new EffectRefused('not-in-catalogue', {id});
  if (typeof entry.path !== 'string' || !/^effects\/[a-z][a-z0-9-]{1,40}\/$/u.test(entry.path)) throw new EffectRefused('invalid-index', {id});
  const folder = new URL(entry.path, base).href;
  const digests = new Map((Array.isArray(entry.files) ? entry.files : []).map((file) => [file?.path, file?.sha256]));
  const verified = async (name) => {
    const expected = digests.get(name);
    if (typeof expected !== 'string') throw new EffectRefused('file-not-in-index', {id, file: name});
    const bytes = await fetchBytes(new URL(name, folder).href);
    if ((await sha256(bytes)) !== expected.toLowerCase()) throw new EffectRefused('integrity', {id, file: name});
    return bytes;
  };
  const manifestBytes = await verified('effect.json');
  let manifest;
  try {
    manifest = JSON.parse(decode(manifestBytes));
  } catch {
    throw new EffectRefused('invalid-manifest', {id});
  }
  const problems = checkEffectManifest(manifest);
  if (problems.length) throw new EffectRefused('invalid-manifest', {id, problems});
  if (manifest.id !== id) throw new EffectRefused('manifest-mismatch', {id});
  // Every file is verified before any of it runs.
  const entryBytes = await verified(manifest.entry);
  const styles = [];
  for (const name of manifest.styles ?? []) styles.push(decode(await verified(name)));
  const module = await importVerified(entryBytes);
  if (typeof module?.mount !== 'function') throw new EffectRefused('module-failed', {id, message: 'no mount export'});
  return Object.freeze({id, url: `${folder}effect.json`, manifest, module, styles: Object.freeze(styles), sandboxed: false});
}

// A foreign effect: its manifest and files fetched once, with no index to
// check them against -- the sandbox is the trust boundary. The manifest must
// still hold; the module never runs in the page, only in its frame.
async function loadForeign(url) {
  const manifestBytes = await fetchBytes(url);
  let manifest;
  try {
    manifest = JSON.parse(decode(manifestBytes));
  } catch {
    throw new EffectRefused('invalid-manifest', {url});
  }
  const problems = checkEffectManifest(manifest);
  if (problems.length) throw new EffectRefused('invalid-manifest', {url, problems});
  const source = decode(await fetchBytes(new URL(manifest.entry, url).href));
  const styles = [];
  for (const name of manifest.styles ?? []) styles.push(decode(await fetchBytes(new URL(name, url).href)));
  const module = sandboxModule({id: manifest.id, source, styles});
  return Object.freeze({id: manifest.id, url, manifest, module, styles: Object.freeze([]), sandboxed: true});
}

// The address of a foreign effect.json: https, or the page's own origin.
function foreignAddress(url) {
  const address = new URL(url);
  const own = new URL(pageAddress()).origin;
  if ((address.protocol !== 'https:' && address.origin !== own) || !address.pathname.endsWith('/effect.json') || address.username || address.password) return null;
  address.hash = '';
  return address.href;
}

// Where a reference points: {id} of the pinned catalogue (an id, or the
// address of an effect.json under its base), or {foreign: url} for any other
// effect.json, which runs only in the sandbox.
async function locate(reference, base, foreign) {
  if (typeof reference !== 'string' || !reference.trim()) throw new EffectRefused('no-effect');
  const value = reference.trim();
  if (ID.test(value)) {
    if (!base) throw new EffectRefused('no-catalogue', {id: value});
    return {id: value};
  }
  const sandbox = foreignMode(foreign) === 'sandbox';
  let url;
  try {
    url = new URL(value, pageAddress()).href;
  } catch {
    throw new EffectRefused(sandbox ? 'invalid-reference' : 'foreign-effect-needs-sandbox', {url: value});
  }
  if (!base || !url.startsWith(base)) {
    if (!sandbox) throw new EffectRefused('foreign-effect-needs-sandbox', {url});
    const address = foreignAddress(url);
    if (!address) throw new EffectRefused('invalid-reference', {url});
    return {foreign: address};
  }
  const index = await catalogueIndex(base);
  const entry = index.effects.find((candidate) => typeof candidate?.path === 'string' && new URL(`${candidate.path}effect.json`, base).href === url);
  if (!entry) throw new EffectRefused('not-in-catalogue', {url});
  return {id: entry.id};
}

const loaded = new Map();

// Load an effect: from the pinned catalogue by its id, or by the address of
// its effect.json under the catalogue base (`catalogue`, or
// SF_BOOT_CONFIG.effects.catalogue), every file checked against the index's
// SHA-256 before anything runs; or, by any other https address of an
// effect.json, as a foreign effect whose module runs only in the sandbox
// (sandboxed: true) -- unless foreign effects are refused (`foreign`, or
// SF_BOOT_CONFIG.effects.foreign = 'refuse'). Answers {id, url, manifest,
// module, styles, sandboxed}; rejects with an error whose `reason` names the
// refusal.
export function loadEffect(reference, {catalogue, foreign} = {}) {
  const base = catalogueBase(catalogue);
  return (async () => {
    const where = await locate(reference, base, foreign);
    const key = where.foreign ? `foreign\n${where.foreign}` : `${base}\n${where.id}`;
    if (!loaded.has(key)) {
      const loading = where.foreign ? loadForeign(where.foreign) : loadVerified(base, where.id);
      loading.catch(() => loaded.delete(key));
      loaded.set(key, loading);
    }
    return loaded.get(key);
  })();
}

// An effect's own styles, verified with it, in the page while it is placed.
const styleUses = new Map();
function useStyles(effect, document) {
  if (!effect?.styles?.length) return () => {};
  let use = styleUses.get(effect.url);
  if (!use) {
    const nodes = effect.styles.map((css) => {
      const style = document.createElement('style');
      style.setAttribute('data-sf-effect-style', effect.id);
      style.textContent = css;
      document.head.append(style);
      return style;
    });
    use = {nodes, count: 0};
    styleUses.set(effect.url, use);
  }
  use.count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    use.count -= 1;
    if (use.count) return;
    for (const node of use.nodes) node.remove();
    styleUses.delete(effect.url);
  };
}

const placements = new Map();

// Place an effect from the catalogue on an element: load it (and its pair,
// when the pair is a catalogue id) with integrity, then draw it in a layer
// under the element's content -- or, with `windows` (true or a selector),
// behind the element's window cards. Answers the placement's handle, or null
// when it was refused (the element's data-sf-effect-state is then "refused",
// data-sf-effect-reason says why, and sf-effect-refused is dispatched).
export async function placeEffect(element, options = {}) {
  if (!(element instanceof globalThis.Element)) throw new TypeError('An effect is placed on an element');
  const {effect: reference, settings = {}, themeMode = 'auto', windows = false, catalogue, locale, foreign} = options;
  placements.get(element)?.destroy();
  element.setAttribute(STATE, 'loading');
  element.removeAttribute(REASON);
  try {
    const main = await loadEffect(reference, {catalogue, foreign});
    if (windows && !capabilities(main.manifest).includes('windows')) throw new EffectRefused('windows-not-declared', {id: main.id});
    let pair = null;
    let pairRefused = null;
    if (typeof main.manifest.pair === 'string') {
      // A pair by address is foreign, loaded for the sandbox (or not at all
      // when foreign effects are refused); a pair by id is the catalogue's,
      // and a foreign effect's id names nothing in this catalogue.
      const outside = pairIsForeign(main.manifest);
      if (!outside && main.sandboxed) {
        pairRefused = 'pair-of-foreign-effect';
        report(element, main.manifest.pair, pairRefused, {pairOf: main.id});
      } else if (!outside || foreignMode(foreign) === 'sandbox') {
        try {
          pair = await loadEffect(main.manifest.pair, {catalogue, foreign});
        } catch (error) {
          pairRefused = error?.reason ?? 'pair-failed';
          report(element, main.manifest.pair, pairRefused, {pairOf: main.id, ...(error?.detail ?? {})});
        }
      }
    }
    if (element.getAttribute(STATE) !== 'loading') return null;
    if (!element.isConnected) {
      // Taken off the page while it loaded: found again if it comes back.
      element.removeAttribute(STATE);
      return null;
    }
    const releases = [useStyles(main, element.ownerDocument), useStyles(pair, element.ownerDocument)];
    const common = {manifest: main.manifest, module: main.module, pair: pair ? {manifest: pair.manifest, module: pair.module} : undefined, pairRefused, stored: settings, locale, themeMode, foreign};
    let handle;
    let layer = null;
    try {
      if (windows) {
        handle = placeWindows(element, {...common, windows});
      } else {
        layer = makeLayer(element);
        handle = place({...common, element, host: layer.host, areas: () => [element]}).handle;
      }
    } catch (error) {
      layer?.remove();
      for (const release of releases) release();
      throw error;
    }
    const placed = Object.freeze({
      update: handle.update,
      pause: handle.pause,
      resume: handle.resume,
      destroy() {
        if (placements.get(element) === placed) placements.delete(element);
        handle.destroy();
        layer?.remove();
        for (const release of releases) release();
      },
      get scheme() {
        return handle.scheme;
      },
      get effect() {
        return handle.effect;
      },
      get resolution() {
        return handle.resolution;
      },
      get themeMode() {
        return handle.themeMode;
      },
      get sandboxed() {
        return handle.sandboxed;
      },
    });
    placements.set(element, placed);
    return placed;
  } catch (error) {
    if (error instanceof EffectRefused) {
      element.setAttribute(STATE, 'refused');
      element.setAttribute(REASON, error.reason);
      report(element, reference, error.reason, error.detail);
    } else {
      element.setAttribute(STATE, 'failed');
      element.removeAttribute(REASON);
      element.dispatchEvent(new globalThis.CustomEvent('sf-effect-error', {bubbles: true, detail: {effect: reference, phase: 'mount', message: String(error?.message ?? error)}}));
    }
    return null;
  }
}

// Declarative mount ----------------------------------------------------------
//
//   <section data-sf-effect="<catalogue id or effect.json address>"
//            data-sf-effect-settings='{"speed": 80}' data-sf-effect-theme="auto">
//   <div data-sf-effect-windows="<id or address>" ...>
//     <article data-sf-effect-window>...</article> ...
//
// Found once the page has loaded, and in content added later.

const DECLARED = `[data-sf-effect]:not([${STATE}]), [data-sf-effect-windows]:not([${STATE}])`;

function placeDeclared(element) {
  const windows = element.hasAttribute('data-sf-effect-windows');
  const reference = element.getAttribute(windows ? 'data-sf-effect-windows' : 'data-sf-effect');
  let settings = {};
  const raw = element.getAttribute('data-sf-effect-settings');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!isObject(parsed)) throw new TypeError('not an object');
      settings = parsed;
    } catch {
      globalThis.console?.warn?.(`SF.Effects: data-sf-effect-settings of ${reference} is not a JSON object; the defaults are used`);
    }
  }
  const themeMode = element.getAttribute('data-sf-effect-theme') || 'auto';
  return placeEffect(element, {effect: reference, settings, themeMode, windows});
}

function scan(root) {
  const found = root instanceof globalThis.Element && root.matches(DECLARED) ? [root] : [];
  found.push(...(root.querySelectorAll?.(DECLARED) ?? []));
  for (const element of found) placeDeclared(element);
}

function watchDeclared(document) {
  const declared = document.querySelector(DECLARED);
  scan(document);
  // A page that configures no catalogue and declares no effect when it loads
  // is not watched on every change: a foreign effect it adds later is placed
  // with placeEffect.
  if (!effectsConfig().catalogue && !declared) return;
  new globalThis.MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node.nodeType === 1) scan(node);
      if (record.removedNodes.length) {
        for (const [element, placed] of placements) if (!element.isConnected) placed.destroy();
      }
    }
  }).observe(document.documentElement, {childList: true, subtree: true});
}

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Effects = Object.freeze({
    checkEffectManifest, checkSetting, effectSettings, effectSchemes, pairIsForeign, foreignMode,
    allowedModes, resolveTheme, pageScheme,
    mountEffect, mountWindows, loadEffect, placeEffect,
    EFFECT_FORMAT, SANDBOX_RUNNER_SHA256: FRAME_RUNNER_SHA256,
    get EFFECT_SCHEMA() {
      noteDeprecated({kind: 'global', from: 'SF.Effects.EFFECT_SCHEMA', to: 'SF.Effects.EFFECT_FORMAT'});
      return EFFECT_SCHEMA;
    },
  });
  if (typeof document !== 'undefined' && document.documentElement) {
    // After the page has loaded: an effect is never what the page waits for.
    const start = () => watchDeclared(document);
    if (document.readyState === 'complete') globalThis.setTimeout(start, 0);
    else window.addEventListener('load', start, {once: true});
  }
}
