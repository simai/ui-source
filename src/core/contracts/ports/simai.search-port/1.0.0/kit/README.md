# Conformance kit — site search host port 1.0.0

Twenty-six cases a host runs to show it speaks this port. Transport-neutral:
the kit describes intents, payloads and answers, not HTTP, not a framework.
The port is the seam of `sf-search` (SIMAI Framework), shared by the built-in
provider over a static JSON index (ui.simai.io, Docara) and by a host that
queries its own store (Larena, Bitrix, an admin's command palette).

A host claims this port only after it passes every case here and records the
kit version, its own revision and the result.

Each case is a plain document: `given` is the state the host is put in, `when`
is the intent the component raises with its payload, `then` is the answer the
host owes:

- `answer` — one of `applied`, `refused`, `unavailable`;
- `answer_must_include` — fields the answer carries beside `answer`, such as
  `sequence` on a sequenced request or `reason` on a refusal;
- `data_must_include` — keys of the answer's `data`;
- `echo_must_include` — the request the answer repeats;
- `note` — what else the case checks, in words, with the exact values and the
  reason codes a host answers (`capability-not-provided`, `query-too-short`,
  `forbidden`).

A case with a `capability` applies only to a host that announces it; a host
that does not passes the case by never receiving the intent.

## How a host runs the kit

1. Put the index, the store and the person's recent queries in the state
   `given` describes. Anything the case does not name is the host's own
   choice.
2. Deliver the payload of `when` as the named intent. A host may call its own
   handler directly; the browser is not required.
3. Compare the answer with `then`.

## Digest

`conformance.sha256` in `port.json` is over the listing of this directory: for
every file, sorted by path, the line `<path relative to the kit> <sha256 of
the bytes>\n`, then the sha256 of that listing
(`tests/host-port-kits.contract.test.mjs` checks it).

## History

| version | cases | what changed |
|:---|:---|:---|
| 1.0.0 | 26 | The first edition: one sequenced read (`query.change`), opening a result, running a command, a sequenced preview and the two ways a recent query is forgotten, with six capabilities over them. |

## 1.0.0

| case | what it holds the host to |
|:---|:---|
| `base-host-needs-no-capability` | a host that announces nothing still answers a working search |
| `query-answer-names-its-sequence` | every answer to a sequenced read names the sequence it answers |
| `query-stale-sequence-dropped` | an answer to an older sequence is dropped; the list never flickers back to a stale query |
| `query-echoes-what-it-answered` | the answer echoes the query and the scope the host read |
| `query-refused-is-explained` | a query the host will not answer is refused with a reason, not with an empty list |
| `query-unavailable-is-honest` | a search that cannot run now is `unavailable`, not an empty list |
| `empty-query-answers-the-blocks` | the empty query answers the blocks, never an empty list |
| `page-result-without-a-url-is-dropped` | a page result with no `url` is dropped, not drawn as a row that does nothing |
| `capability-absent-is-explained` | a capability never announced is never drawn, and the intent behind it answers `unavailable` with `capability-not-provided` |
| `result-open-is-the-hosts-decision` | opening a result is the host's, and it may answer with the recent queries it keeps |
| `result-open-refused-keeps-the-panel-open` | a refused open leaves the window open and says why |
| `scope-is-a-field-of-the-query` | a scope pressed is the same question as a keystroke |
| `scopes-carry-their-counts` | the scopes come in order, each with the number the whole index holds |
| `scopes-without-the-capability-are-not-offered` | no `scopes`, no pills — not even an «All» of one |
| `recent-forget-answers-the-whole-list` | a removal is answered with the whole list the host keeps now |
| `recent-clear-answers-the-empty-list` | a clear is answered with the empty list |
| `recent-without-the-capability-is-not-offered` | no `recent`, no block and no storage key of the panel's own |
| `popular-answers-the-empty-field` | the popular queries come with the empty query, strongest first |
| `popular-without-the-capability-is-not-offered` | no `popular`, no pills |
| `action-run-applies-and-the-panel-closes` | a command is run by the host, and `applied` closes the panel |
| `action-run-without-the-capability-is-unavailable` | no `actions`, no command rows; asked anyway, `unavailable` |
| `preview-answers-the-row-it-was-asked-for` | a preview names the result it belongs to |
| `preview-stale-sequence-dropped` | a preview to an older sequence is dropped |
| `preview-without-the-capability-is-not-offered` | no `preview`, no pane |
| `correction-is-offered-not-applied` | a correction is offered; the panel never corrects a query by itself |
| `spelling-without-the-capability-is-not-offered` | no `spelling`, no correction line |

The vocabulary is the standard's (simai.smart-component 1.3.13 §4.9, smart
vocabulary 1.1.5): the three answers, one answer envelope for every intent,
and `sequence` on a sequenced read so a late answer is told from the current
one.

What the port leaves to the panel, not to the host: the arrangement of the
window, where the query is typed, which row is highlighted, how a title's
match is marked, the keyboard, and which of the announced blocks a page wants
shown. The capability is the floor and the page's setting is the veto: a block
is drawn only where the host announces the capability **and** the page has not
turned it off. `path` and `keys` have no capability behind them — where a
result stands is a field of the result and the key hints at the foot of the
card are the panel's own — so both are settings of `sf-search` alone.
