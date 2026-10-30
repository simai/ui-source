// The built-in hosts of sf-search's port (simai.search-port 1.0.0): the two
// simple paths a site already uses -- a static JSON index (`index`) and a
// `provider` function -- written as adapters of the port rather than as a
// second way into the panel. The element asks these exactly as it asks a host
// the page connected (`connectPort`), so there is one code path: the panel
// raises an intent, a host answers one envelope, and the capabilities the host
// announces decide which blocks exist at all.
//
// What they announce: `scopes`, `recent`, `popular` and `actions` where there
// is something to search (an index address or a provider), and nothing at all
// where there is not -- a page with neither still gets the field, the results
// and the keyboard, which is the port's base host. Neither announces `preview`
// (a static index and a one-answer provider have no words of a row to show
// without opening it) nor `spelling` (neither knows what was meant).
//
// The recent queries are the host's data (the port): these adapters keep them
// where the component used to -- a view preference of the person, under
// `sf-search/<recent-key>` -- so `recent.forget` and `recent.clear` are
// answered with the whole list, and a page that connects a real host hands its
// own recent queries instead and this store is never read.

export const PORT_ID = 'simai.search-port';
export const PORT_VERSION = '1.0.0';
export const SUPPORTED_PORT_VERSIONS = ['1.0.0'];
export const BUILTIN_CAPABILITIES = ['scopes', 'recent', 'popular', 'actions'];
export const RECENT_LIMIT = 5;
export const RESULT_LIMIT = 50;

const text = (value) => (value === undefined || value === null ? '' : String(value));
const words = (query) => query.toLowerCase().split(/\s+/u).filter(Boolean);
const applied = (data, sequence) => (sequence === undefined
  ? {answer: 'applied', data} : {answer: 'applied', sequence, data});

/**
 * One entry of a static index or of a provider's answer as the port's result,
 * with the text the built-in matching reads kept beside it (`match`): a
 * result carries only the keys the port declares, and the index's own `text`
 * is matched, never drawn.
 */
export function resultOf(entry, order) {
  const action = text(entry?.action);
  const url = text(entry?.url ?? entry?.href);
  const kind = action || entry?.kind === 'action' ? 'action' : 'page';
  const path = Array.isArray(entry?.path) ? entry.path.map(text).filter(Boolean).join(' › ') : text(entry?.path);
  const result = {
    id: entry?.id ?? (action || url || order),
    group: text(entry?.group),
    title: text(entry?.title),
    path: path || null,
    snippet: text(entry?.snippet) || null,
    icon: text(entry?.icon) || null,
    shortcut: text(entry?.shortcut) || null,
    kind,
    url: kind === 'action' ? null : (url || null),
  };
  return {result, match: `${result.title} ${result.path ?? ''} ${text(entry?.text)} ${result.snippet ?? ''}`.toLowerCase()};
}

/** A static index, or a provider's answer, as the port's data (one shape). */
export function readIndex(raw) {
  const scopes = (Array.isArray(raw?.groups) ? raw.groups : [])
    .map((group) => (typeof group === 'string' ? {id: group, label: group} : {id: text(group?.id), label: text(group?.label ?? group?.id) || null}))
    .filter((group) => group.id);
  const source = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  const entries = source.filter((entry) => entry && text(entry.title)).map(resultOf);
  const popular = (Array.isArray(raw?.popular) ? raw.popular : []).map(text).filter(Boolean);
  return {scopes, entries, popular};
}

/**
 * The matching of the built-in index host: every word of the query stands in
 * the title, the path or the entry's own text, case-insensitive; a title that
 * starts with the query first, then one that holds it, then one that holds
 * every word, then the rest, each in the index's order. The empty query
 * answers the commands (`kind: action`), which is what an empty field draws.
 */
export function matchIndex({scopes, entries, popular}, query) {
  const q = text(query).trim().toLowerCase();
  if (!q) return {scopes, results: entries.filter(({result}) => result.kind === 'action').map(({result}) => result), popular, total: undefined};
  const terms = words(q);
  const found = [];
  entries.forEach(({result, match}, order) => {
    if (!terms.every((word) => match.includes(word))) return;
    const title = result.title.toLowerCase();
    let rank = 3;
    if (title.startsWith(q)) rank = 0;
    else if (title.includes(q)) rank = 1;
    else if (terms.every((word) => title.includes(word))) rank = 2;
    found.push({result, rank, order});
  });
  found.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return {scopes, results: found.slice(0, RESULT_LIMIT).map((entry) => entry.result), popular, total: found.length};
}

/**
 * Where the built-in hosts keep this person's recent queries: a view
 * preference (`SF.Preferences`, `sf-search/<key>`), or the page's life alone
 * when no key is given or the browser refuses storage. The store is the
 * host's; the panel never reads it.
 */
export function recentStore({key = '', preferences = () => null, limit = RECENT_LIMIT} = {}) {
  const name = key ? `sf-search/${key}` : '';
  let kept = [];
  const store = {
    read() {
      if (!name) return kept;
      try {
        const saved = preferences()?.read(name);
        const list = Array.isArray(saved?.queries) ? saved.queries : [];
        kept = list.filter((entry) => typeof entry === 'string' && entry).slice(0, limit);
      } catch {
        // Storage refused (a private window, a sandbox): the list lives as long as the page.
      }
      return kept;
    },
    write(list) {
      kept = list.slice(0, limit);
      if (!name) return kept;
      try {
        if (kept.length) preferences()?.write(name, {v: 1, queries: kept});
        else preferences()?.remove(name);
      } catch {
        // As above: what cannot be kept is still shown for this page.
      }
      return kept;
    },
    record(query) {
      const text_ = text(query).trim();
      if (!text_) return store.read();
      const rest = store.read().filter((entry) => entry.toLowerCase() !== text_.toLowerCase());
      return store.write([text_, ...rest]);
    },
    forget(query) {
      return store.write(store.read().filter((entry) => entry !== query));
    },
    clear() {
      return store.write([]);
    },
  };
  return store;
}

/**
 * A host of the port over a static index or a provider.
 *
 * `read(query, {scope, signal})` answers the raw data of either path -- the
 * index read once, or the provider's answer -- and `local` says whether the
 * matching is this host's (an index) or the source's (a provider, which was
 * given the query). `recent` is the store above. A host with no `read` is the
 * port's base host: it announces nothing and answers an empty list, so the
 * field, the results and the keyboard work and no block is drawn.
 */
export function builtinSearchHost({read = null, local = false, recent = recentStore()} = {}) {
  const host = {
    id: PORT_ID,
    port: PORT_ID,
    version: PORT_VERSION,
    capabilities: read ? [...BUILTIN_CAPABILITIES] : [],
    builtin: true,

    async raise(intent, payload = {}, {signal} = {}) {
      const sequence = payload.sequence;
      if (intent === 'query.change') {
        const query = text(payload.query);
        const echo = {query, scope: text(payload.scope) || null};
        if (!read) return applied({results: [], echo}, sequence);
        const source = readIndex(await read(query, {scope: echo.scope ?? '', signal}));
        // An index is matched here; a provider was given the query, so its
        // answer is the page of results in its own order. Either way the
        // empty query answers the commands, which is what an empty field draws.
        const answer = local ? matchIndex(source, query) : {
          scopes: source.scopes,
          popular: source.popular,
          results: (query ? source.entries : source.entries.filter(({result}) => result.kind === 'action'))
            .map(({result}) => result).slice(0, RESULT_LIMIT),
          total: undefined,
        };
        const data = {results: answer.results, echo, scopes: answer.scopes, popular: answer.popular, recent: recent.read()};
        if (answer.total !== undefined && answer.total > data.results.length) data.total = answer.total;
        return applied(data, sequence);
      }
      if (intent === 'result.open' || intent === 'action.run') {
        // The host records the query where it keeps this person's recent
        // queries, and answers the whole list back. What a command does is
        // the page's: the panel raises its own sf-search-navigate for it.
        return applied({recent: recent.record(payload.query)});
      }
      if (intent === 'recent.forget') return applied({recent: recent.forget(text(payload.query))});
      if (intent === 'recent.clear') return applied({recent: recent.clear()});
      // preview and spelling: never announced, so never asked; asked anyway,
      // the answer is the port's own (§4.9, the kit's capability-absent case).
      if (intent === 'result.preview') return {answer: 'unavailable', reason: 'capability-not-provided', sequence};
      return {answer: 'unavailable', reason: 'intent-unknown'};
    },
  };
  return host;
}

/**
 * The index host: reads the address once (a failed read is tried again on the
 * next ask) and matches the query in what it read.
 */
export function indexHost(url, {fetch: fetchIndex = globalThis.fetch?.bind(globalThis), recent} = {}) {
  let read = null;
  const once = () => {
    if (read) return read;
    read = Promise.resolve(fetchIndex(url, {credentials: 'same-origin'})).then((response) => {
      if (!response.ok) throw new Error(`index ${response.status}`);
      return response.json();
    });
    read.catch(() => { read = null; });
    return read;
  };
  const host = builtinSearchHost({read: () => once(), local: true, recent});
  host.source = url;
  return host;
}

/** The provider host: the page's own function answers every query. */
export function providerHost(provider, {recent} = {}) {
  const call = typeof provider === 'function' ? provider : (query, options) => provider.search(query, options);
  const host = builtinSearchHost({read: (query, options) => call(query, options), local: false, recent});
  host.source = 'provider';
  return host;
}
