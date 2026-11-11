# Conformance kit — document host port 1.0.0 (draft)

Twenty-four cases a host runs to show it speaks `simai.document-port`. The kit
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
  - `limits` — `max_nodes` and `max_bytes` per language value;
  - `parents` — with `levels`: each parent level's stored `values` and the
    areas it `locked`;
  - `drafts`, `publications`, `published` — with `history` and `publish`: the
    earlier drafts (with their values), the publications (newest first) and the
    id of the live one;
  - `fault` — a store failure the harness puts on the host (`storage-unavailable`).
- `when` — the intent and its payload.
- `then` — what the answer must be:
  - `answer` — one of `applied`, `conflict`, `refused`, `unavailable`;
  - `answer_must_include` — fields beside `answer` (`reason`, `current_revision`, `current`);
  - `data_must_include` — keys of `data`;
  - `expect` — machine checks: `{path, equals | not_equals | not_in | absent | at_most | length}`
    on the answer (dot paths, numbers index arrays), `{path, equals_step: "when", step_path}`
    to compare with the first answer, and `{area, language, mark, texts}` for
    the layout.region named `area` in `data.resolved[language]`: its
    `extensions["simai:area"]` mark and the texts of its paragraphs;
  - `note` — what else the case means, in words.
- `after` — further steps on the same host state, each with its own `when`
  and `then`: what a refused write must have left alone, what a repeat must
  answer.

Reasons are compared without regard to `-` and `_` (vocabulary 1.1.5 §3).

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

## 1.0.0

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
