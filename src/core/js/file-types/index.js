// The type of an entry -- a file, a page, a folder -- and its icon, from one
// map (file-types.json; owner decision C102, 2026-11-12). Who chooses the icon,
// first word wins:
//
//   icon        a name the host gives (or false: no icon)
//   kind        one of the twelve words of the map (page, image, code, ...)
//   extension   of the name, when names say their type (file-types="name")
//   place       a folder (it has children, or kind="folder"), else a file
//
// No top-level side effects: a bundle that imports one function carries the
// map and nothing else. sf-tree draws its rows with it; sf-file-upload,
// sf-file-download and sf-view's file cells are to follow (C102 item 2).
import map from './file-types.json';

const KINDS = map.kinds;

/** The twelve kinds, in the map's order. */
export const FILE_KINDS = /* @__PURE__ */ Object.freeze(Object.keys(KINDS));

const BY_EXTENSION = /* @__PURE__ */ (() => {
  const found = new Map();
  for (const [kind, spec] of Object.entries(KINDS)) for (const extension of spec.extensions ?? []) found.set(extension, kind);
  return found;
})();

/** A word of the map, or '' for anything else (an old or unknown word). */
export function fileKind(word) {
  const kind = String(word ?? '').trim().toLowerCase();
  return Object.hasOwn(KINDS, kind) ? kind : '';
}

/** The kind a name's extension says («Смета.xlsx» → table), or ''. */
export function fileKindOfName(name) {
  const found = /\.([a-z0-9]+)$/iu.exec(String(name ?? '').trim());
  return found ? BY_EXTENSION.get(found[1].toLowerCase()) ?? '' : '';
}

/** The icon of a kind; a folder open shows its open icon. */
export function fileKindIcon(kind, {open = false} = {}) {
  const spec = KINDS[fileKind(kind)];
  if (!spec) return KINDS.file.icon;
  return open && spec['open-icon'] ? spec['open-icon'] : spec.icon;
}

/**
 * The kind an entry is shown as and its icon.
 *
 *   fileType({icon, kind, name, folder, open, byName})
 *     icon     a name, or false for none ('' / true: choose)
 *     kind     a word of the map, or ''
 *     name     the entry's name, read for its extension when byName
 *     folder   the entry has children (or says it will have them)
 *     open     a folder that is open
 *     byName   the extension may say the kind (default true)
 *   → {kind, icon}   icon '' when the host said false
 */
export function fileType({icon, kind, name, folder = false, open = false, byName = true} = {}) {
  let shown = fileKind(kind);
  // A folder is a folder by its place; file is the word for "some file", which
  // the name may say more about.
  if (!shown || shown === 'file') {
    if (folder && !shown) shown = 'folder';
    else shown = (byName && fileKindOfName(name)) || shown || 'file';
  }
  if (icon === false || icon === 'false') return {kind: shown, icon: ''};
  if (typeof icon === 'string' && icon.trim() && icon !== 'true') return {kind: shown, icon: icon.trim()};
  return {kind: shown, icon: fileKindIcon(shown, {open})};
}
