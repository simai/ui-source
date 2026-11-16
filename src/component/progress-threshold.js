// The status a progress indicator draws (owner decision C131 (7)): the more
// serious of the page's status and the threshold its value reached. The
// thresholds are the page's, in per cent like the value; unset (null, an
// empty attribute, a word) is no threshold. neutral, info and success rank
// below warning, warning below error. One source for sf-progress-bar,
// sf-progress-scale and the class scale (div.sf-progress-scale with
// data-warning-at / data-error-at), so a scale and a bar with the same
// numbers draw the same colour.
export const STATUS_RANK = { warning: 1, error: 2 };

export function thresholdStatus(value, warningAt, errorAt) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  if (Number.isFinite(errorAt) && number >= errorAt) return 'error';
  if (Number.isFinite(warningAt) && number >= warningAt) return 'warning';
  return '';
}

export function effectiveStatus(status, value, warningAt, errorAt) {
  const reached = thresholdStatus(value, warningAt, errorAt);
  return (STATUS_RANK[reached] ?? 0) > (STATUS_RANK[status] ?? 0) ? reached : status;
}

// A threshold as an attribute holds it: a number, else none. An empty or
// missing attribute is none, never 0 (Number('') is 0).
export function readThreshold(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}
