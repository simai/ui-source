// The one danger rule of the group actions (owner decision C295, defect BA-1:
// sf-pagination, sf-view, sf-view-table and sf-gallery each had a rule of
// their own, or none). An action is dangerous when it says so -- status
// "danger" (C13), or the danger flag of sf-pagination's markup -- or when its
// id deletes: delete, remove, destroy, trash, as a word at the start
// ("remove-all"), never inside another one ("deleted-view").
//
// A dangerous action is red, stands last after a line in the more menu and is
// asked about first (C39) unless it says confirm: false. sf-pagination
// re-exports this file, so a host that imported isDestructiveAction from it
// keeps the same answer.
const DELETING = /^(delete|remove|destroy|trash)\b/iu;

/** Whether an action deletes or cannot be undone. */
export function isDestructiveAction(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.status === 'danger' || item.status === 'error' || item.danger === true) return true;
  return DELETING.test(String(item.id ?? item.value ?? ''));
}

/** The actions as listed: as written, the dangerous ones last. */
export function orderActions(actions = []) {
  return [...actions].sort((a, b) => Number(isDestructiveAction(a)) - Number(isDestructiveAction(b)));
}
