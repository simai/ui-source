// The actions of the group actions bar as it reads and splits them (owner
// decision C295). Pure: no element, no lit, so the contract tests import it.
import {isDestructiveAction, orderActions} from './danger.js';

// Visible labelled actions; the rest go to «⋯» (C155 (2)). A phone shows one,
// as an icon button with its name in the tooltip.
export const VISIBLE = 3;
export const VISIBLE_COMPACT = 1;
// An action on more items than this is long (C34's limit, C387): it goes in
// the background and its result comes in a notice, not in the bar.
export const LONG_OVER = 100;

export const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
};

/**
 * One action as the bar reads it. Takes the bar's own shape {id, text, icon,
 * status, confirm, undo, long, done-text, min, max, reason, priority,
 * disabled} and the shapes
 * of the copies it replaces: sf-pagination's {value, text, danger, disabled}
 * and sf-view-table's {id, name}.
 */
export function normalizeAction(item, index = 0) {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id ?? item.value ?? `action-${index + 1}`).trim();
  const text = String(item.text ?? item.name ?? item.label ?? id).trim();
  if (!id && !text) return null;
  const danger = isDestructiveAction(item);
  const pinned = item.priority === 'pin';
  const priority = pinned ? 0 : (Number.isFinite(Number(item.priority)) && item.priority !== null && item.priority !== ''
    ? Math.max(1, Math.trunc(Number(item.priority))) : Number.POSITIVE_INFINITY);
  let confirm = null;
  if (item.confirm && typeof item.confirm === 'object') confirm = {...item.confirm};
  else if (item.confirm === true || (danger && item.confirm !== false)) confirm = {};
  return {
    id: id || `action-${index + 1}`,
    text: text || id,
    icon: String(item.icon ?? '').trim(),
    status: danger ? 'danger' : '',
    danger,
    confirm,
    undo: item.undo === true,
    // true or false as the author says; null: long over LONG_OVER items.
    long: typeof item.long === 'boolean' ? item.long : null,
    doneText: String(item['done-text'] ?? item.doneText ?? '').trim(),
    min: number(item.min),
    max: number(item.max),
    reason: String(item.reason ?? '').trim(),
    priority,
    pinned,
    disabled: item.disabled === true,
    order: index,
  };
}

/**
 * The visible actions and the ones for «⋯»: by priority, the dangerous ones
 * always in «⋯», last. With iconOnly (a phone, where an action is an icon
 * button) an action without an icon never stands in the row: it would draw
 * as a second «⋯»; it goes in «⋯» with its label (GB15 A7).
 */
export function splitActions(actions, cap = VISIBLE, {iconOnly = false} = {}) {
  const list = (Array.isArray(actions) ? actions : []).map(normalizeAction).filter(Boolean);
  const safe = list.filter((action) => !action.danger)
    .sort((a, b) => (a.priority - b.priority) || (a.order - b.order));
  const danger = list.filter((action) => action.danger);
  const visible = (iconOnly ? safe.filter((action) => action.icon) : safe).slice(0, cap);
  const rest = [...safe.filter((action) => !visible.includes(action)), ...orderActions(danger)];
  return {visible, rest};
}


/**
 * Whether an action on count items is long (owner decision C387): what the
 * author says (long true or false), else more than LONG_OVER items. A long
 * one goes in the background and ends with a notice; a fast one says its
 * result in the bar.
 */
export function isLongAction(action, count) {
  if (action?.long === true || action?.long === false) return action.long;
  return number(count) > LONG_OVER;
}

/**
 * Where a result goes (C387, C331, C332): a fast action's in the bar (done
 * or the failed ones), a long one's in a notice; a failure is also written to
 * «Уведомления» (the sf-notification record) -- a long one's shown as an
 * error notice that stays, a fast one's only recorded, the bar shows it.
 */
export function resultRoute({long = false, failed = 0, undo = false} = {}) {
  const failures = number(failed) > 0;
  if (long) return {bar: null, notice: failures ? 'error' : 'success', record: failures};
  if (failures) return {bar: 'failed', notice: null, record: true};
  // A reversible action's notice already said it, with «Отменить» (C25).
  return {bar: undo ? null : 'done', notice: null, record: false};
}

/**
 * The fold by width (LV3-27, LV4-23): of the visible actions the first fit
 * stand in the row, the others go into «⋯» first, in their order, before the
 * ones that were already there (the dangerous ones stay last). fit null: as
 * split.
 */
export function foldActions({visible = [], rest = []} = {}, fit = null) {
  if (fit === null || fit === undefined || !Number.isFinite(Number(fit))) return {visible, rest};
  const keep = Math.max(0, Math.min(visible.length, Math.trunc(Number(fit))));
  if (keep >= visible.length) return {visible, rest};
  return {visible: visible.slice(0, keep), rest: [...visible.slice(keep), ...rest]};
}

/**
 * How many more actions fit the row (LV3-27): room is the free width beside
 * the count and the end group, widths the measured widths of the next folded
 * actions (undefined: not measured yet), gap the space before each one, and
 * freed what «⋯» gives back when the last one leaves it. An unmeasured action
 * is tried once (the next drawing measures it, and folds it again when the
 * row wraps). Answers the number of actions to take back.
 */
export function actionsThatFit({room = 0, widths = [], gap = 0, freed = 0} = {}) {
  let left = room;
  let taken = 0;
  for (let index = 0; index < widths.length; index += 1) {
    const width = widths[index];
    if (!Number.isFinite(width)) return taken + 1;
    const last = index === widths.length - 1;
    if (width + gap <= left + (last ? freed : 0)) {
      left -= width + gap;
      taken += 1;
    } else break;
  }
  return taken;
}
