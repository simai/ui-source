// The button set (owner decision C116, 2026-11-13; ui-control research
// 2026-11-13-buttons-system, prototype buttons-system.html). Three words of a
// button become former names until 2027-01-01 and draw as their successors:
//
// - scheme="secondary" on sf-button draws as on-surface (#q-secondary). The
//   secondary colour stays in core for badges, tabs and segments; the icon
//   button already reads it as on-surface-variant (C15, 2026-11-08).
// - appearance="surface" on sf-button draws as the soft grey button, tonal
//   with the on-surface scheme (#q-surface, C113).
// - a danger button keeps three looks -- filled (the last confirmation),
//   outline (opens a confirmation) and the fill-less icon in a row
//   (#q-danger-looks); tonal or surface with status danger draws as outline,
//   on sf-button and sf-button-icon alike.
//
// Each word is noted in SF.deprecations and said once per page in the console
// for each component and word, whether or not the page opted in to the notes,
// as sf-button's spacing and the BS-1 status warning are. Every bundle carries
// its own copy of this module, so the words already said live on one shared
// global.
import {noteDeprecated} from '../../core/js/deprecations.js';

export const BUTTON_SET_SINCE = '2026-11-13';
export const BUTTON_SET_REMOVE_AFTER = '2027-01-01';

const DANGER = new Set(['danger', 'error', 'critical']);

function saidWords() {
  const root = globalThis.SF = globalThis.SF || {};
  if (!(root.__sfButtonSetWarned instanceof Set)) {
    Object.defineProperty(root, '__sfButtonSetWarned', {value: new Set(), configurable: true});
  }
  return root.__sfButtonSetWarned;
}

// Whether a status word paints the control as danger (C13: error and critical
// are danger's former names on a control).
export function isDangerStatus(status) {
  return DANGER.has(String(status ?? ''));
}

// A danger control's look: tonal and surface draw as outline. Answers the look
// drawn and the former word, or '' when the look is one of danger's own.
export function dangerLook(appearance, status) {
  if (!isDangerStatus(status)) return {appearance, former: ''};
  if (appearance === 'tonal' || appearance === 'surface') return {appearance: 'outline', former: appearance};
  return {appearance, former: ''};
}

// sf-button's look under C116. `appearance` and `scheme` are the words the page
// wrote (after the dated aliases: link is already ghost); answers the look and
// the colour the template draws and the former words met, each
// {attribute, from, to, drawn, danger?}.
export function buttonSetLook({appearance, scheme, status} = {}) {
  const formers = [];
  let look = appearance;
  let colour = scheme;
  const danger = dangerLook(look, status);
  if (danger.former) {
    formers.push({attribute: 'appearance', from: danger.former, to: 'outline', danger: true, drawn: 'appearance="outline" status="danger" (a danger button is filled, outline or a fill-less icon)'});
    look = danger.appearance;
  } else if (look === 'surface') {
    formers.push({attribute: 'appearance', from: 'surface', to: 'tonal', drawn: 'appearance="tonal" scheme="on-surface"'});
    look = 'tonal';
    colour = 'on-surface';
  }
  if (scheme === 'secondary') {
    formers.push({attribute: 'scheme', from: 'secondary', to: 'on-surface', drawn: 'scheme="on-surface"'});
    colour = 'on-surface';
  }
  return {appearance: look, scheme: colour, formers};
}

function sentence(component, former) {
  return `[SIMAI Framework] ${component}: ${former.attribute}="${former.from}"${former.danger ? ' with status="danger"' : ''} is a former name until ${BUTTON_SET_REMOVE_AFTER} and draws as ${former.drawn}; write that instead (rule C116). See contracts/changes/journal.json (value-button-set-c116).`;
}

// Notes each former word in SF.deprecations and says it once per page.
export function sayButtonSetFormers(component, formers = []) {
  for (const former of formers) {
    noteDeprecated({
      component,
      tag: component,
      kind: 'value',
      attribute: former.attribute,
      from: former.danger ? `${former.from} (status danger)` : former.from,
      to: former.to,
      since: BUTTON_SET_SINCE,
      remove_after: BUTTON_SET_REMOVE_AFTER,
    });
    const said = saidWords();
    const key = `${component}|${former.attribute}|${former.from}|${former.to}`;
    if (said.has(key)) continue;
    said.add(key);
    globalThis.console?.warn?.(sentence(component, former));
  }
}
