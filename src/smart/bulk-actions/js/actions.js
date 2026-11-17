// The actions of the group actions bar as it reads and splits them (owner
// decision C295). Pure: no element, no lit, so the contract tests import it.
import {isDestructiveAction, orderActions} from './danger.js';

// Visible labelled actions; the rest go to «⋯» (C155 (2)). A phone shows one,
// as an icon button with its name in the tooltip.
export const VISIBLE = 3;
export const VISIBLE_COMPACT = 1;

export const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
};

/**
 * One action as the bar reads it. Takes the bar's own shape {id, text, icon,
 * status, confirm, undo, min, max, reason, priority, disabled} and the shapes
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
    min: number(item.min),
    max: number(item.max),
    reason: String(item.reason ?? '').trim(),
    priority,
    pinned,
    disabled: item.disabled === true,
    order: index,
  };
}

/** The visible actions and the ones for «⋯»: by priority, the dangerous ones always in «⋯», last. */
export function splitActions(actions, cap = VISIBLE) {
  const list = (Array.isArray(actions) ? actions : []).map(normalizeAction).filter(Boolean);
  const safe = list.filter((action) => !action.danger)
    .sort((a, b) => (a.priority - b.priority) || (a.order - b.order));
  const danger = list.filter((action) => action.danger);
  const visible = safe.length <= cap && !danger.length ? safe : safe.slice(0, cap);
  const rest = [...safe.filter((action) => !visible.includes(action)), ...orderActions(danger)];
  return {visible, rest};
}

