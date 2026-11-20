// An in-memory reference host for simai.dataview-port 1.16.0: the parts that
// edition adds -- the level of a saved view (system, shared, personal, with
// package read as system until 2027-01-01) and the person's own view state
// (personal-preferences: page size, view zone, view opened last). It keeps a
// layer per person, as a server keeps it per account; a guest (person null)
// gets no capability, so the view keeps the state in the browser (C298).
//
// The full reference host -- records, column settings, bulk writes, the tree
// -- is the view set's (simai/ui-view package/tests/fixtures/
// dataview-reference-host.mjs); this one is the seam's own check of the
// 1.16.0 additions, run against the kit in
// tests/dataview-port-levels.contract.test.mjs.

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

// The level of a saved view, in 1.16.0 words: package (1.0.0-1.15.0) is the
// system level until the alias date; anything else is no level.
export const LEVEL_ALIAS_UNTIL = '2027-01-01';
export const viewLevel = (view, today = new Date().toISOString().slice(0, 10)) => {
  const level = view?.level;
  if (level === 'system' || level === 'shared' || level === 'personal') return level;
  if (level === 'package' && today <= LEVEL_ALIAS_UNTIL) return 'system';
  return null;
};

// people: {[person]: {revision, page_size?, view_zone?, view?}}
export const createMemoryHost = ({person = null, people = {}, saved_views = [], capabilities = ['saved-views', 'shared-saved-views', 'personal-preferences'], records = []} = {}) => {
  const layers = new Map(Object.entries(clone(people)));
  const views = new Map(saved_views.map((view) => [view.key, clone(view)]));
  // A guest has no account to keep a layer under: the capability is not
  // announced, whatever the host could do for a signed-in person.
  const offered = new Set(capabilities.filter((capability) => capability !== 'personal-preferences' || person !== null));
  const capabilityOf = {
    'view.open': 'saved-views', 'view.save': 'saved-views', 'view.delete': 'saved-views',
    'view.save_shared': 'shared-saved-views', 'preferences.save': 'personal-preferences',
  };
  let revisions = 0;
  const nextRevision = (prefix) => `${prefix}${Date.now().toString(36)}-${++revisions}`;
  const layer = () => layers.get(person) ?? {revision: 'p0'};
  let answered = 0;

  const saveView = (payload, level) => {
    const stored = views.get(payload.key);
    if (stored && viewLevel(stored) === 'system') return {answer: 'refused', reason: 'forbidden', message: 'A system view ships with the product; save the change as a new view.'};
    if (stored && payload.revision !== undefined && String(payload.revision) !== String(stored.revision)) return {answer: 'conflict', current_revision: stored.revision};
    if (stored && viewLevel(stored) !== level) return {answer: 'refused', reason: 'forbidden'};
    const {target, ...rest} = payload;
    const view = {...(stored ?? {}), ...rest, level, revision: nextRevision('v')};
    views.set(view.key, view);
    return {answer: 'applied', data: {saved_views: [...views.values()].map(clone)}};
  };

  return {
    get capabilities() { return [...offered]; },
    preferences: () => clone(layers.get(person)),
    raise(intent, payload = {}) {
      const needs = capabilityOf[intent];
      if (needs && !offered.has(needs)) return {answer: 'unavailable', reason: 'capability-not-provided'};
      switch (intent) {
        case 'query.change': {
          const query = payload.query ?? {};
          const data = {
            records: clone(records),
            total: records.length,
            echo: {filters_chosen: query.filters ?? {}, filters: query.filters ?? {}, filters_rejected: [], search: query.search ?? '', sort: query.sort ?? [], page: query.page ?? 1, per_page: query.per_page ?? 20},
          };
          // The person's layer comes with the first answer (and may come with
          // every answer; the view reads the newest).
          if (offered.has('personal-preferences') && answered === 0) data.preferences = clone(layer());
          answered += 1;
          return {answer: 'applied', sequence: payload.sequence, data};
        }
        case 'view.open': {
          const view = views.get(payload.key);
          if (!view) return {answer: 'refused', reason: 'view-missing'};
          return {answer: 'applied', data: {echo: {...(view.query ?? {})}, column_settings: {layers: {}, target: {kind: 'saved_view', key: view.key, revision: view.revision}}}};
        }
        case 'view.save':
          return saveView(payload, 'personal');
        case 'view.save_shared':
          return saveView(payload, 'shared');
        case 'preferences.save': {
          const current = layer();
          if (String(payload.base_revision) !== String(current.revision)) return {answer: 'conflict', current_revision: current.revision};
          const next = {...current};
          for (const [field, value] of Object.entries(payload.preferences ?? {})) {
            if (value === null) delete next[field];
            else next[field] = value;
          }
          next.revision = nextRevision('p');
          layers.set(person, next);
          return {answer: 'applied', data: {preferences: clone(next)}};
        }
        default:
          return {answer: 'unavailable', reason: 'capability-not-provided'};
      }
    },
  };
};
