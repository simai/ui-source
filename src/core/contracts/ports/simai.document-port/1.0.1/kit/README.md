# Conformance kit — document host port 1.0.1 (draft 3)

Forty-four cases a host runs to show it speaks `simai.document-port`. The kit
is the port's acceptance gate: an adapter (Larena, Bitrix) is accepted against
1.0.1 when it passes every case. 1.0.1 is draft 3; 1.0.0, released as draft 2
in ui-b654460cad2a, stays as it was (a released edition is never changed). The kit
is transport-neutral: it describes intents, payloads and answers, not HTTP and
not a framework. `run.mjs` beside it reads the cases for a host adapter written
in JavaScript; a host in another language (Larena, Bitrix) reads `cases/*.json`
and applies the same checks in its own test harness.

## A case

- `given` — the state the host is put in before the case:
  - `capabilities` — what the host announces for this case (a case whose
    capability is absent here checks the refusal);
  - `target` — the bound storage element and its `parents`, nearest first;
  - `languages`, `revision`, `at`, `values` — the element as stored;
  - `limits` — `max_nodes` and `max_bytes` per language value, and the optional
    `max_total_bytes` of every language value together (draft 3);
  - `rights` — what the reader may do (`save`, `publish`, `languages`); absent:
    the reader may save, and publish when the host announces `publish`;
  - `parents` — with `levels`: each parent level's stored `values` and the
    areas it `locked`;
  - `drafts`, `publications`, `published` — with `history` and `publish`: the
    earlier drafts (with their values), the publications (newest first) and the
    id of the live one, or (draft 3) an object `{id: null, revision, languages, at}`:
    a publication made outside the port that the harness puts live;
  - `fault` — a failure the harness puts on the host: `storage-unavailable`
    (answered `unavailable`) or `session-expired` (answered `refused`).
- `when` — the intent and its payload. A step may take payload values from
  earlier answers: `bind` maps a payload key to `{step, path}`, the step being
  `when` or `after.<n>` (1-based), for the revisions a host makes itself.
- `then` — what the answer must be:
  - `answer` — one of `applied`, `conflict`, `refused`, `unavailable`;
  - `answer_must_include` — fields beside `answer` (`reason`, `current_revision`, `current`);
  - `data_must_include` — keys of `data`;
  - `expect` — machine checks: `{path, equals | not_equals | not_in | absent | at_most | length}`
    on the answer (dot paths, numbers index arrays; `equals` on objects is key order aside),
    `{path, equals_step, step_path}` to compare with an earlier answer (`when`, `after.<n>`), and `{area, language, mark, texts}` for
    the layout.region named `area` in `data.resolved[language]`: its
    `extensions["simai:area"]` mark and the texts of its paragraphs;
  - `note` — what else the case means, in words.
- `after` — further steps on the same host state, each with its own `when`
  and `then`: what a refused write must have left alone, what a repeat must
  answer.

Reasons are hyphenated codes from the port's list, matched exactly: a host
maps its own codes (`area_locked`, `document_access_denied`) to them.

## Running it

```js
import {runKit} from './run.mjs';
const report = await runKit({
  async setup(given) { /* load the fixture, announce given.capabilities */ },
  async send(intent, payload) { /* raise the intent, return the answer object */ },
  async teardown() { /* roll back */ },
});
```

or `node run.mjs ./adapter.mjs`, whose default export is the adapter or a
function returning one. ui-source runs the kit against a reference host in
memory (`tests/document-port.contract.test.mjs`), so every case is answerable
as written.

## Digest

`conformance.sha256` in `port.json` is over the listing of this directory: for
every file, sorted by path, the line `<path relative to the kit> <sha256 of the
bytes>\n`, then the sha256 of that listing (`tests/host-port-kits.contract.test.mjs`).
`run.mjs` is part of the kit and of the digest.

## Draft 3 (group build 15, from Larena's first adapter)

What Larena's server side found while passing draft 2 (39/39), and what the
port now says:

- **Empty objects.** A host keeps `{}` as `{}` where the document schema has an
  object (`data`, `props`, `slots`, `presentation`, `extensions`). A host whose
  storage cannot tell an empty object from an empty list elsewhere (a PHP
  decoder, inside unknown `data`) refuses the save `would-lose` with the
  diagnostic `empty-object-not-kept` at the path; it never stores `[]` for it.
- **The whole element's size.** A host may announce `limits.max_total_bytes`
  (Larena: 1048576, its record cap). A save whose stored values together pass it
  is refused `too-large` on the whole element, with the diagnostic
  `{code: "max-total-bytes", severity: "error", path: "/values", limit, total}`,
  though each language is within `max_bytes`.
- **Catalogue words (C302).** In the presentation catalogue (type plus
  template, the property-view port) a field holding a composition document is
  template `document`, component `host`: the host's own editor of the element.
- **A publication made outside the port** (the host's publication page, a
  schedule) is answered `published: {id: null, revision, languages}` with `at`
  when the host knows it. `null` is only an element never published.
- **One draft per change of the values.** `history.list` lists a draft only
  when the document values changed: versions with the same values (an edit of
  the record's other fields, a save of the same values) are one draft, named by
  the newest revision of the group, at its time.
- **Paging over a folded draft.** `before` names a draft by the revision
  `history.list` answered for it, the newest of its group; a host may answer
  `not-found` for an older version folded inside it.
- **client_key lifetime.** A host keeps a `client_key` at least 7 days (it may
  keep it longer; Larena keeps 30). Past that a repeat is a new operation: a
  save or a publish is compared with the revision it names (usually
  `stale-revision`), a restore or a rollback makes a new draft or publication.
  The editor never repeats a write older than 7 days with the same key. Not a
  kit case: the kit does not move a host's clock.

| case | what it holds the host to |
|:---|:---|
| `save-over-the-total-byte-limit-is-refused-for-the-element` | with `max_total_bytes`: values together past it are `too-large`, diagnostic `max-total-bytes` at `/values` with `limit` and `total`; nothing written |
| `save-keeps-empty-objects-where-the-document-has-objects` | `{}` in `props`, `extensions` and `presentation` comes back `{}` on save and load |
| `load-describes-a-publication-made-outside-the-port` | an outside publication is `published` with `id` null, its revision and languages |
| `history-lists-a-draft-only-when-the-values-changed` | a save of the stored values is applied and listed as the draft it equals, by the newest revision |
| `history-pages-from-a-folded-draft-by-its-newest-revision` | `before` set to a folded draft's newest revision pages on from the next draft |

## Cases from 1.0.0 (draft 2)

| case | what it holds the host to |
|:---|:---|
| `load-answers-every-language-under-one-revision` | one load: target, every language's value, one revision, rights, limits within 200 nodes and 262144 bytes |
| `load-leaves-a-missing-translation-absent` | a language without a value is listed and absent, never another language's |
| `save-moves-one-revision-for-all-languages` | a save of one language is a new revision of the element; other languages keep their values |
| `save-removes-a-language-with-null` | `null` removes a language's value |
| `save-stale-revision-is-a-conflict-with-the-current` | an older `expected_revision` is `conflict stale-revision` with `current_revision` and `current`; nothing written |
| `save-refused-as-invalid-changes-nothing` | an invalid document is `refused invalid` with diagnostics per language; the revision stays |
| `save-over-the-node-limit-is-refused` | 201 nodes is `too-large`; 200 is accepted |
| `save-over-the-byte-limit-is-refused` | more than 262144 bytes of UTF-8 is `too-large` (bytes, not characters) |
| `save-unknown-language-is-refused` | the editor does not add languages: `unknown-language` |
| `save-languages-disagree-on-areas-is-refused` | every language inherits, replaces and clears the same areas: `structure-mismatch` |
| `load-marks-every-area-with-its-origin` | with `levels`: the resolved document marks each area with origin, state and lock; stored values carry no mark |
| `resolve-follows-the-recipe-inherit-replace-clear` | left out inherits, carried replaces, carried empty clears; resolve writes nothing |
| `save-into-a-locked-area-is-refused` | an area a level above locks is marked locked; replacing or clearing it is `area-locked` |
| `history-lists-drafts-and-publications-apart` | two lists, newest first; the current draft first |
| `restore-is-a-new-draft` | a restore is a new revision with the old values, never a rewind; a repeat of its key is the same restore |
| `publish-repeat-with-the-same-key-is-one-publication` | the same `client_key` and parameters after a lost answer is the same publication |
| `publish-same-key-other-revision-is-an-idempotency-conflict` | a key reused with other parameters is `conflict idempotency-conflict`; nothing published |
| `publish-against-a-moved-publication-is-a-conflict` | an `expected_published` that is not live is `conflict environment-changed` with the current state |
| `publish-leaves-out-a-missing-translation` | a publication publishes only the languages that have a value |
| `rollback-is-a-new-publication` | a rollback publishes an earlier publication's revision as a new publication; the draft stays |
| `publish-at-without-scheduling-is-refused` | `at` without `scheduled-publish` is `capability-not-provided` |
| `capability-absent-is-refused-by-name` | an intent of a capability not announced is `capability-not-provided` |
| `unknown-intent-is-refused` | an intent the port does not declare (there is no `document.lock`) is `unknown-intent` |
| `storage-down-is-unavailable` | a store that cannot be reached is `unavailable storage-unavailable`, never thrown |
| `save-keeps-unknown-content-through-load-history-and-restore` | round trip: an undeclared node type, unknown data/props keys, a foreign extensions key, bindings and a `media:<id>` come back equal on save, load and restore |
| `save-of-a-resolved-document-keeps-inherited-areas-inherited` | a resolved document saved as shown stores only this level's areas; inherited ones go on inheriting; other extensions keys stay |
| `save-of-an-edited-inherited-area-is-refused` | an area marked inherited whose content changed is `would-lose` with a diagnostic; nothing written |
| `save-without-the-right-to-save-is-refused` | `rights.save` false is `access-denied` |
| `save-of-a-language-outside-rights-is-refused` | a language outside `rights.languages`, written or removed, is `access-denied`; an allowed one is applied |
| `restore-of-an-unknown-revision-is-not-found` | an unknown (or pruned) revision is `not-found` |
| `rollback-to-an-unknown-publication-is-not-found` | an unknown publication is `not-found`; nothing published |
| `restore-against-a-moved-draft-is-a-conflict` | a stale `expected_revision` on restore is `conflict stale-revision` with the current values |
| `rollback-against-a-moved-publication-is-a-conflict` | a moved `expected_published` on rollback is `conflict environment-changed` |
| `history-pages-with-limit-and-before` | `limit` per list, `more`, `before` (drafts) and `before_publication` (publications); an unknown cursor is `not-found` |
| `save-repeat-with-the-same-key-is-one-save` | an optional `client_key` on save: the same key and values is the same save; other values `idempotency-conflict` |
| `save-removing-the-main-language-is-refused` | `null` for the first of `languages` is `invalid` |
| `save-language-keys-are-exact-and-match-the-locale` | `RU` beside `ru` is `unknown-language`; a value whose `locale` is not its key is `structure-mismatch` |
| `publish-edges-are-refused-or-conflicts` | a language with no value is `missing-translation`; a revision that is not the current draft is `conflict stale-revision` |
| `session-expired-is-refused-by-name` | a session that ended is `session-expired`, not `access-denied` |
