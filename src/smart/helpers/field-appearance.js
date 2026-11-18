// One look vocabulary for every field (dispatcher decision 2026-11-17, Larena
// record forms msg-9e7b5015; FM-9): a field is bordered (the default, a box
// with a border) or filled (the container fill, no border, the bottom line).
// sf-input, sf-input-textarea, sf-input-quantity, sf-input-lookup,
// sf-input-rich, sf-input-code, sf-dropdown and sf-input-date answer to the
// same two words on the same setting, appearance, so a form gives one look to
// all its fields. A field may add a look of its own beside them (sf-input's
// hidden, sf-input-textarea's flush); the shared two never mean anything else.
// contracts/public-api-axes.json field_appearance holds the list.
//
// Former names keep working until 2027-01-01: they are noted in
// SF.deprecations and said once per page in the console for each component
// and name, whether or not the page opted in to deprecation warnings (the
// order asks for the warning). Every bundle carries its own copy of this
// module, so the names already said live on one shared global.
import {noteDeprecated} from '../../core/js/deprecations.js';

export const FIELD_APPEARANCES = Object.freeze(['bordered', 'filled']);
export const FIELD_APPEARANCE_DEFAULT = 'bordered';
export const FIELD_APPEARANCE_REMOVE_AFTER = '2027-01-01';

function saidNames() {
  const root = globalThis.SF = globalThis.SF || {};
  if (!(root.__sfFieldAppearanceSaid instanceof Set)) {
    Object.defineProperty(root, '__sfFieldAppearanceSaid', {value: new Set(), configurable: true});
  }
  return root.__sfFieldAppearanceSaid;
}

// A former name of the field's look was read: noted, and said once per page.
// kind "value" is a former word of appearance (outlined); kind "attribute" a
// former name of the setting itself (input-type).
// noted: the shared alias layer (core/js/aliases.js, from the component's
// aliases.json) already noted this use and put the new name in place before
// the component read it; only the console line is left to say.
export function sayFieldAppearanceFormer(component, {kind = 'value', from, to, since, journal, noted = false} = {}) {
  if (!component || !from) return;
  if (!noted) noteDeprecated({
    component,
    tag: component,
    kind,
    attribute: kind === 'value' ? 'appearance' : '',
    from,
    to,
    since,
    remove_after: FIELD_APPEARANCE_REMOVE_AFTER,
  });
  const said = saidNames();
  const key = `${component}|${kind}|${from}`;
  if (said.has(key)) return;
  said.add(key);
  const what = kind === 'value' ? `appearance="${from}"` : `${from}`;
  const write = kind === 'value' ? `appearance="${to}"` : `${to}`;
  globalThis.console?.warn?.(`[SIMAI Framework] ${component}: ${what} is a former name until ${FIELD_APPEARANCE_REMOVE_AFTER}; write ${write} -- every field names its looks bordered and filled.${journal ? ` See contracts/changes/journal.json (${journal}).` : ''}`);
}
