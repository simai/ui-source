// A control's status is danger alone (rule C13): a button, an icon button or
// a menu item that deletes, discards or cannot be undone. error is its former
// name (until 2027-01-01) and critical an older one. There are no success,
// warning or info controls -- a result's colour belongs to a notice or a
// badge (ui-control research 2026-11-13-button-schemes, R202, defect BS-1).
// Such a word used to be dropped without a sound and the scheme colour drawn;
// it still draws so, and the console now says it once per page for each
// component and word.
//
// Every bundle carries its own copy of this module, so the words already said
// live on one shared global, as SF.deprecations keeps its notes.
const CONTROL_STATUSES = Object.freeze(['', 'danger', 'error', 'critical']);

function saidWords() {
  const root = globalThis.SF = globalThis.SF || {};
  if (!(root.__sfUnknownStatusWarned instanceof Set)) {
    Object.defineProperty(root, '__sfUnknownStatusWarned', {value: new Set(), configurable: true});
  }
  return root.__sfUnknownStatusWarned;
}

// Answers whether `value` is a status the control does not know, and says so
// once per page. `allowed` narrows the words a component reads; `label` is how
// the message names the setting (status="…" on a host, an item's status).
export function warnUnknownControlStatus(component, value, {allowed = CONTROL_STATUSES, label = 'status'} = {}) {
  if (value === null || value === undefined) return false;
  const word = String(value);
  if (allowed.includes(word)) return false;
  const said = saidWords();
  const key = `${component}|${label}|${word}`;
  if (said.has(key)) return true;
  said.add(key);
  globalThis.console?.warn?.(`[SIMAI Framework] ${component}: ${label}="${word}" is not a status of a control; a control's status is danger (rule C13), and there are no success, warning or info controls. Drawn without a status.`);
  return true;
}
