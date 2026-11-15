// The built-in hosts of sf-search's port (simai.search-port 1.1.0): the two
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
// own recent queries instead and this store is never read. Since 1.1.0 the
// list also holds the pages last opened (owner decision C162 (6): up to five
// queries and up to three pages, «Очистить» clears both).
//
// 1.1.0 (owner decision C175): an entry may carry a type mark (badge), a
// moment (time), an avatar ({name, image}) and, for a command, its next step
// (steps: an array of options in a static index; a provider is asked the step
// with options.step). A group may name the product's results page (more), and
// so may the whole answer.

export const PORT_ID = 'simai.search-port';
export const PORT_VERSION = '1.1.0';
export const SUPPORTED_PORT_VERSIONS = ['1.0.0', '1.1.0'];
export const BUILTIN_CAPABILITIES = ['scopes', 'recent', 'popular', 'actions'];
export const RECENT_LIMIT = 5;
export const RECENT_PAGES_LIMIT = 3;
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
  // 1.1.0: the parts a row draws only where they are given.
  if (text(entry?.badge)) result.badge = text(entry.badge);
  if (text(entry?.time)) result.time = text(entry.time);
  const avatar = avatarOf(entry?.avatar);
  if (avatar) result.avatar = avatar;
  if (kind === 'action' && (entry?.steps === true || (Array.isArray(entry?.steps) && entry.steps.length))) result.steps = true;
  return {result, match: `${result.title} ${result.path ?? ''} ${text(entry?.text)} ${result.snippet ?? ''}`.toLowerCase(),
    options: kind === 'action' && Array.isArray(entry?.steps) ? entry.steps : null};
}

/** An avatar given as a name, or as {name, image}: the port's {name, image}. */
export function avatarOf(value) {
  if (!value) return null;
  if (typeof value === 'string') return {name: value, image: null};
  const name = text(value.name ?? value.text);
  const image = text(value.image ?? value.src ?? value.url);
  return name || image ? {name, image: image || null} : null;
}

/** A static index, or a provider's answer, as the port's data (one shape). */
export function readIndex(raw) {
  const scopes = (Array.isArray(raw?.groups) ? raw.groups : [])
    .map((group) => {
      if (typeof group === 'string') return {id: group, label: group};
      const scope = {id: text(group?.id), label: text(group?.label ?? group?.id) || null};
      if (Number.isInteger(group?.count)) scope.count = group.count;
      if (text(group?.more)) scope.more = text(group.more);
      return scope;
    })
    .filter((group) => group.id);
  const source = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  const entries = source.filter((entry) => entry && text(entry.title)).map(resultOf);
  const popular = (Array.isArray(raw?.popular) ? raw.popular : []).map(text).filter(Boolean);
  const more = text(raw?.more);
  const total = Number.isInteger(raw?.total) ? raw.total : undefined;
  return {scopes, entries, popular, more, total};
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
export function recentStore({key = '', preferences = () => null, limit = RECENT_LIMIT, pagesLimit = RECENT_PAGES_LIMIT} = {}) {
  const name = key ? `sf-search/${key}` : '';
  let kept = [];
  let pages = [];
  const pageOf = (page) => {
    const id = page?.id;
    const title = text(page?.title);
    const url = text(page?.url);
    if (id === undefined || id === null || !title || !url) return null;
    return {id, title, url, path: text(page?.path) || null, icon: text(page?.icon) || null};
  };
  // The whole list as the port answers it: the queries, then the pages.
  const both = () => [...kept, ...pages];
  const store = {
    read() {
      if (!name) return both();
      try {
        const saved = preferences()?.read(name);
        const list = Array.isArray(saved?.queries) ? saved.queries : [];
        kept = list.filter((entry) => typeof entry === 'string' && entry).slice(0, limit);
        pages = (Array.isArray(saved?.pages) ? saved.pages : []).map(pageOf).filter(Boolean).slice(0, pagesLimit);
      } catch {
        // Storage refused (a private window, a sandbox): the list lives as long as the page.
      }
      return both();
    },
    write(list, pageList = pages) {
      kept = list.slice(0, limit);
      pages = pageList.slice(0, pagesLimit);
      if (!name) return both();
      try {
        // v 2 adds the pages (1.1.0); a v 1 record is read as queries alone.
        if (kept.length || pages.length) preferences()?.write(name, {v: 2, queries: kept, pages});
        else preferences()?.remove(name);
      } catch {
        // As above: what cannot be kept is still shown for this page.
      }
      return both();
    },
    record(query) {
      const text_ = text(query).trim();
      store.read();
      if (!text_) return both();
      const rest = kept.filter((entry) => entry.toLowerCase() !== text_.toLowerCase());
      return store.write([text_, ...rest]);
    },
    // A page opened from the window (C162 (6)): the newest first, once.
    recordPage(page) {
      const entry = pageOf(page);
      store.read();
      if (!entry) return both();
      const rest = pages.filter((one) => String(one.id) !== String(entry.id));
      return store.write(kept, [entry, ...rest]);
    },
    forget(query) {
      store.read();
      return store.write(kept.filter((entry) => entry !== query));
    },
    forgetPage(id) {
      store.read();
      return store.write(kept, pages.filter((one) => String(one.id) !== String(id)));
    },
    clear() {
      return store.write([], []);
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
  // The results last answered, by id, so an opened page is kept in the recent
  // list with its title and path; the options of a static index's commands.
  const seen = new Map();
  const steps = new Map();
  // A command's next step: the options the index wrote under it, or the
  // provider's answer to the step (options.step), matched by the words typed.
  const stepOptions = async (step, query, signal) => {
    let list = steps.get(String(step));
    if (!list && !local) {
      const raw = await read(query, {scope: '', signal, step});
      list = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
    }
    const q = text(query).trim().toLowerCase();
    return (list ?? []).map((entry) => (typeof entry === 'string' ? {id: entry, title: entry} : entry))
      .filter((entry) => entry && text(entry.title))
      .map((entry, order) => ({id: entry.id ?? order, title: text(entry.title), icon: text(entry.icon) || null, path: text(entry.path) || null, kind: 'page', url: null}))
      .filter((entry) => !q || !local || entry.title.toLowerCase().includes(q));
  };
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
        const step = payload.step ?? null;
        if (step !== null && step !== undefined && step !== '') return applied({results: await stepOptions(step, query, signal), echo}, sequence);
        const source = readIndex(await read(query, {scope: echo.scope ?? '', signal}));
        for (const entry of source.entries) if (entry.options) steps.set(String(entry.result.id), entry.options);
        // An index is matched here; a provider was given the query, so its
        // answer is the page of results in its own order. Either way the
        // empty query answers the commands, which is what an empty field draws.
        const answer = local ? matchIndex(source, query) : {
          scopes: source.scopes,
          popular: source.popular,
          results: (query ? source.entries : source.entries.filter(({result}) => result.kind === 'action'))
            .map(({result}) => result).slice(0, RESULT_LIMIT),
          total: source.total,
        };
        for (const result of answer.results) seen.set(String(result.id), result);
        const data = {results: answer.results, echo, scopes: answer.scopes, popular: answer.popular, recent: recent.read()};
        if (answer.total !== undefined && answer.total > data.results.length) data.total = answer.total;
        if (query && source.more) data.more = source.more;
        return applied(data, sequence);
      }
      if (intent === 'result.open') {
        // The host records the query and the page opened where it keeps this
        // person's recent list, and answers the whole list back.
        const page = seen.get(String(payload.id)) ?? recent.read().find((entry) => typeof entry === 'object' && String(entry.id) === String(payload.id));
        if (page) recent.recordPage({...page, url: page.url ?? payload.url});
        return applied({recent: recent.record(payload.query)});
      }
      if (intent === 'action.run') {
        // What a command does is the page's: the panel raises its own
        // sf-search-navigate for it (with the value of its step).
        return applied({recent: recent.record(payload.query)});
      }
      if (intent === 'recent.forget') {
        if (payload.id !== undefined && payload.id !== null) return applied({recent: recent.forgetPage(payload.id)});
        return applied({recent: recent.forget(text(payload.query))});
      }
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
