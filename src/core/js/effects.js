// Background effects (simai.effect 1.0.0; Larena's design of 2026-10-14,
// larena-specs docs/architecture/2026-10-14-background-effects.md). An effect
// is an animated background drawn into one area of a page; its manifest
// (effect.json) says everything a product needs to list and configure it
// without running its code, and its module exports mount(host, settings,
// context) -> {update, pause, resume, destroy}.
//
// What lives here is the part every product would otherwise write again:
// checking a manifest, turning stored values into checked settings with the
// defaults filled, and mounting an effect under the rules -- one still frame
// for a person who asked for less motion, nothing drawn while the tab is
// hidden, the host out of the accessibility tree and out of the pointer's
// way, and everything gone after destroy. Running a foreign effect in a
// sandbox is the product's (an iframe without allow-same-origin); this module
// is what runs inside it as well.

import {isSchema} from './composition/schema-name.mjs';

// The label a writer emits. A reader takes either form of the format name
// (simai.effect.v1, or simai.effect with schema_version 1): schema-name.mjs.
export const EFFECT_SCHEMA = 'simai.effect.v1';
const SETTING_TYPES = new Set(['choice', 'integer', 'number', 'boolean', 'string', 'text', 'color', 'file']);
const ID = /^[a-z][a-z0-9-]{1,40}$/u;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/u;
const KEY = /^[a-zA-Z][a-zA-Z0-9]{0,40}$/u;
const FILE = /^[a-z0-9][a-z0-9._-]*$/u;
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => isObject(value) && Object.keys(value).length > 0
  && Object.entries(value).every(([lang, text]) => /^[a-z]{2}(-[A-Z]{2})?$/u.test(lang) && typeof text === 'string' && text.length > 0);

// The problems of a manifest, empty when it holds.
export function checkEffectManifest(manifest) {
  if (!isObject(manifest)) return ['manifest: not an object'];
  const problems = [];
  const allowed = ['schema', 'schema_version', 'id', 'version', 'label', 'author', 'entry', 'styles', 'preview', 'surfaces', 'settings', 'needs'];
  for (const key of Object.keys(manifest)) if (!allowed.includes(key)) problems.push(`${key}: undeclared`);
  if (!isSchema(manifest, 'simai.effect', 1)) problems.push('schema: not simai.effect, schema_version 1');
  if (typeof manifest.id !== 'string' || !ID.test(manifest.id)) problems.push('id');
  if (typeof manifest.version !== 'string' || !VERSION.test(manifest.version)) problems.push('version');
  if (!isText(manifest.label)) problems.push('label');
  if (typeof manifest.entry !== 'string' || !FILE.test(manifest.entry) || !/\.m?js$/u.test(manifest.entry)) problems.push('entry: one module file');
  if (manifest.styles !== undefined && (!Array.isArray(manifest.styles) || !manifest.styles.every((file) => typeof file === 'string' && FILE.test(file) && file.endsWith('.css')))) problems.push('styles');
  if (!Array.isArray(manifest.surfaces) || !manifest.surfaces.length) problems.push('surfaces');
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

const reducedMotion = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// Mount an effect's module under the rules. `module` is the imported entry
// (or its mount function). Answers a handle whose methods are safe to call in
// any order and more than once.
export function mountEffect(host, {manifest, module, stored = {}, locale} = {}) {
  if (!(host instanceof globalThis.Element)) throw new TypeError('An effect mounts into an element');
  const problems = checkEffectManifest(manifest);
  if (problems.length) throw new TypeError(`Effect manifest is invalid: ${problems.join('; ')}`);
  const mount = typeof module === 'function' ? module : module?.mount;
  if (typeof mount !== 'function') throw new TypeError('An effect module exports mount(host, settings, context)');
  // The host stands under the page: read by nobody, touched by no pointer.
  host.setAttribute('aria-hidden', 'true');
  host.style.pointerEvents = 'none';
  host.setAttribute('data-sf-effect', manifest.id);
  const document = host.ownerDocument;
  let {settings} = effectSettings(manifest, stored);
  const context = () => Object.freeze({
    reducedMotion: reducedMotion(),
    locale: locale ?? (document.documentElement.getAttribute('lang') || 'en'),
  });
  let handle = mount(host, settings, context()) ?? {};
  let paused = false;
  let destroyed = false;
  const call = (name, ...args) => {
    try {
      handle?.[name]?.(...args);
    } catch (error) {
      host.dispatchEvent(new globalThis.CustomEvent('sf-effect-error', {bubbles: true, detail: {effect: manifest.id, phase: name, message: String(error?.message ?? error)}}));
    }
  };
  // Nothing is drawn while the tab is hidden.
  const onVisibility = () => {
    if (destroyed) return;
    if (document.hidden) call('pause');
    else if (!paused) call('resume');
  };
  document.addEventListener('visibilitychange', onVisibility);
  // A person who turns reduced motion on is given a still frame at once: the
  // effect is mounted again with the context that says so.
  const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const onMotion = () => {
    if (destroyed) return;
    call('destroy');
    host.replaceChildren();
    handle = mount(host, settings, context()) ?? {};
  };
  motion?.addEventListener?.('change', onMotion);
  if (document.hidden) call('pause');
  return Object.freeze({
    update(stored) {
      if (destroyed) return;
      settings = effectSettings(manifest, stored).settings;
      call('update', settings);
    },
    pause() {
      if (destroyed) return;
      paused = true;
      call('pause');
    },
    resume() {
      if (destroyed) return;
      paused = false;
      if (!document.hidden) call('resume');
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      motion?.removeEventListener?.('change', onMotion);
      call('destroy');
      // Whatever the effect left behind goes with it.
      host.replaceChildren();
      host.removeAttribute('data-sf-effect');
    },
  });
}

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Effects = Object.freeze({checkEffectManifest, checkSetting, effectSettings, mountEffect, EFFECT_SCHEMA});
}
