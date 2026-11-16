// C116: an action that deletes is the dangerous one of the band -- Apply over
// it is the outlined danger button, and it is listed last. It says so with the
// danger flag ("delete:Delete::danger", {danger: true}) or by a value that
// deletes (delete, remove, destroy, trash), the same rule sf-view's band reads.
export function isDestructiveAction(item) {
  return Boolean(item) && (item.danger === true || /^(delete|remove|destroy|trash)\b/iu.test(String(item.value ?? item.id ?? "")));
}

// The order the band lists the actions in: as written, the dangerous ones last.
export function orderActions(actions = []) {
  return [...actions].sort((a, b) => Number(isDestructiveAction(a)) - Number(isDestructiveAction(b)));
}
