// sf-list-timeline's runs: which events fold behind «Ещё N». A pure module,
// so a node test can hold its rules (tests/list-timeline-runs.contract.test.mjs).

/**
 * Runs inside one day: consecutive events of one actor and one kind. A run
 * longer than `collapse` keeps its first `collapse` events and folds the rest
 * into one «Ещё N» row (list-timeline.html R092), unless the run was opened;
 * a rest of one event is drawn, since the row would only take its place.
 * Events without an actor (a system log) and steps never make a run: each
 * stands alone, so a list is never folded whole. [{fold: null, item}] for an
 * event, [{fold: {key, items}}] for the folded rest, in order; the key is the
 * first folded id. collapse 0 folds nothing.
 */
export function foldRuns(items, {collapse = 5, opened = new Set()} = {}) {
  const out = [];
  const who = (item) => (item.state ? '' : item.actor?.name ?? '');
  let at = 0;
  while (at < items.length) {
    const first = items[at];
    let end = at + 1;
    if (who(first)) {
      while (end < items.length && who(items[end]) === who(first) && items[end].kind === first.kind) end += 1;
    }
    const run = items.slice(at, end);
    const rest = collapse > 0 ? run.slice(collapse) : [];
    if (rest.length > 1 && !opened.has(rest[0].id)) {
      for (const item of run.slice(0, collapse)) out.push({fold: null, item});
      out.push({fold: {key: rest[0].id, items: rest}, item: null});
    } else {
      for (const item of run) out.push({fold: null, item});
    }
    at = end;
  }
  return out;
}
