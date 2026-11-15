// The legacy low-vision version as an alias of the display settings (owner
// decision C196 (7), 2026-11-15; until 2027-01-01, journal
// display-settings-replaces-special).
//
// The SF4 panel of the Bitrix templates (sf-system _special.js) still writes
// its classes: html.special with special-img-*, special-interval-*,
// special-font-*, and body.sf-special-<colour>. Its own sheet reset every
// background, colour and edge with !important and lost buttons and focus
// rings (SP-1, SP-2, SP-7). The classes are read here and written as the
// core's root attributes instead (core/scss/_sf_css__display.scss), for the
// page only: the panel keeps its own cookies as before, nothing new is kept.
// Each legacy use is noted once in SF.deprecations.
import {applySettings, LEGACY_REMOVE_AFTER, LEGACY_SINCE, schemeName} from '../../../core/js/display-settings.js';
import {noteDeprecated} from '../../../core/js/deprecations.js';

const COLOURS = ['white', 'black', 'yellow', 'blue', 'green'];

function note(from, to) {
  noteDeprecated({component: 'special', kind: 'class', from, to, since: LEGACY_SINCE, remove_after: LEGACY_REMOVE_AFTER});
}

/** The display settings the legacy classes ask for (null: the version is off). */
export function legacySettings(html, body) {
  if (!html?.classList?.contains('special')) return null;
  const has = (name) => html.classList.contains(name);
  const colour = COLOURS.find((name) => body?.classList?.contains(`sf-special-${name}`)) ?? '';
  const settings = {};
  if (colour) {
    settings.scheme = schemeName(colour);
    note(`sf-special-${colour}`, `<html data-sf-scheme="${settings.scheme}">`);
  }
  if (has('special-interval-15') || has('special-interval-20')) {
    settings.textSpacing = 'wide';
    note(has('special-interval-15') ? 'special-interval-15' : 'special-interval-20', '<html data-sf-text-spacing="wide">');
  }
  if (has('special-img-none')) {
    settings.images = 'hide';
    note('special-img-none', '<html data-sf-images="hide">');
  } else if (has('special-img-black')) {
    settings.images = 'grey';
    note('special-img-black', '<html data-sf-images="grey">');
  }
  if (has('special-font-sans')) settings.font = 'sans';
  if (has('special-font-serif')) settings.font = 'serif';
  return settings;
}

/** Follows the legacy classes on <html> and <body>; returns the stop. */
export function bridgeLegacySpecial(doc = globalThis.document) {
  const html = doc?.documentElement;
  if (!html || doc.__sfSpecialBridge) return doc?.__sfSpecialBridge ?? null;
  let applied = false;
  const sync = () => {
    const settings = legacySettings(html, doc.body);
    if (settings) {
      applySettings(settings, html);
      applied = true;
    } else if (applied) {
      // The legacy panel turned the version off: back to the person's own choice.
      applySettings(globalThis.SF?.displaySettings?.read?.() ?? {}, html);
      applied = false;
    }
  };
  const Observer = doc.defaultView?.MutationObserver;
  const observer = Observer ? new Observer(sync) : null;
  const watch = () => {
    observer?.observe(html, {attributes: true, attributeFilter: ['class']});
    if (doc.body) observer?.observe(doc.body, {attributes: true, attributeFilter: ['class']});
    sync();
  };
  if (doc.body) watch();
  else doc.addEventListener('DOMContentLoaded', watch, {once: true});
  const stop = () => {
    observer?.disconnect();
    delete doc.__sfSpecialBridge;
  };
  doc.__sfSpecialBridge = stop;
  return stop;
}
