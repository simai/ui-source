# Component files 1.4: equivalence report (phase 1)

Standard simai.smart-component 1.4 has a person write five files per Smart
component (component.json, examples.json, index.js, lang/<locale>.json,
docs.md) and generates seven: rule.js, aliases.json, meta.mjs,
studio.fixture.json, studio.scenario.json, probe.json, smart.manifest.json.
Phase 1 puts the generator into this repository in **check mode only**: no
component folder changes. This report says, for every Smart component of
simai/ui-source and simai/ui-pro, how far the generated files are from the
committed ones, and classifies every difference of smart.manifest.json.

## Answer

- **Five of the seven files are reproduced for all 70 components**: rule.js,
  aliases.json, studio.fixture.json, studio.scenario.json and probe.json are
  byte-identical or semantically identical (same JSON with sorted keys, same
  evaluated rule) everywhere. Byte differences are formatting only (quote
  style, relations on one line, row key order); `--write` in phase A
  normalises them.
- **smart.manifest.json differs on all 70**, as stand 26 found on three. Of
  1517 differences, a quarter are the committed registry being stale against
  component.json (a1-fact: a missing event, setting, method, default, type,
  version, title), 8 % are words, 56 % are one rule the committed files apply
  unevenly (a2: the base settings, the argument and payload forms, former
  values as aliases), and 11 % (166) are real conflicts (c), in 24 of 70
  components; 46 components have none.
- **meta.mjs differs on all 20 that have one**: the committed files are
  partial overrides of the studio generator (they describe a few attributes);
  the generated one describes all. Two attributes they describe are declared
  nowhere else (button-group `items` as JSON, tag `type`).
- **The registry is read today by people and agents**: the public Smart
  reference on ui.simai.io, ui-studio's MCP catalog and ui-vscode's
  IntelliSense show the stale facts below (sf-button without `press`, sf-modal
  without its ten events and three actions, sf-table without `columns`,
  `rows`, `sort`, `selection`).

## Phase A, waves 1 and 2 (2026-10-28)

Thirty components are in the 1.4 form and generate every file byte for byte:
close, help-mark, reference-link, avatar, avatars, slider, breadcrumbs,
empty-state, download-file, color, switch, page-header, menu, inline-editor,
sortable, copy-button, code-input, radio, checkbox, accordion, resizer, tabs,
icon, gallery, steps, profile-picker, range-slider, theme-generator,
datepicker, tree. Their component.json carries `relations`, `aliases`,
`x-rule` and `x-registry` (x-kept goes: x-registry holds its blocks);
examples.json carries the studio example (`studio`) and the conformance page
(`pages`); each is a patch version up. Their smart.manifest.json is generated,
so the stale facts above are fixed for them; the old files stay in the folder
until phase B. The tables below are the state after the two waves (the
numbers in «Answer» are phase 1's, over all 70).

Rules settled while converting: a default taken from the words (default-from)
names no fixed default (it is the page language's word, read at run time); an enum is the
setting's values (no added `""`); an action's `x-returns` in words is the
description of its outcome object; a former event name keeps the detail the
registry described (`x-registry.alias-events`, with `alias_of`) until its
alias ends; a native event's payload is `{type: "null"}` with its words; a
list setting's examples reach the registry. examples.json written as a bare
list (color, datepicker, range-slider) becomes `{examples: [...]}`, and switch,
which had none, gets one: the first-paint snapshot now draws their examples. The first-paint gate measured
range-slider's `tooltip` example for the first time and found a shift (48 px
printed, 54 adopted): listed in tests/fixtures/first-paint/gate-known.json and
queued to the component.

## Phase A, waves 3 to 6 (2026-10-28)

The other twenty-nine Framework components are in the 1.4 form: every Smart
component of this repository generates every file byte for byte, meta.mjs
among them (twenty families had a hand-written one). The pins of pending
manifests and meta.mjs in tests/component-files-generated are gone; ui-pro
is not converted. What changed for consumers, per component:
component-files-1.4-phase-a-changes.md.

Rules settled while converting (generator and standard text):

- An object setting or value with a default is a property input, as a list
  is (context-menu search, image-field value; tabs and profile-picker gain
  theirs, one patch version up).
- A native event name that carries a detail (x-detail: dropdown, quantity)
  describes it; the bridge takes the registry's words for its fields.
- A dated attribute alias of a setting (kind attribute, neither a host
  attribute nor retired) is an input until it ends; an inverted one (modal
  unclose) defaults to false.
- An alias setting offers its target's values only; the target's former
  values are aliases (button type no longer offers ghost).
- composition.declarative.props leaves out root-class and root-style: a
  composition document never sets classes or styles.
- What the code reads and component.json does not declare is carried in
  x-registry: inputs (tag type, quantity value, the role of context-menu and
  toast, which their code declares as props, context-menu tabs as a list) and
  alias-events (dropdown sf-field:reset, sent by the trait without an alias
  row). The carried field spelling question did not arise: composition-overlay
  declares node_id, parent_id and index beside id, parent and position, as its
  code sends both.
- A comment inside rule.js but outside the relation list goes to the relation
  it explains (badge, button-group, context-menu, modal) or before the rule
  (dropdown, textarea css).

## How it is made

```
node scripts/generate-component-files.mjs --check [--bytes] [--component <name>] [--file <file>] [--package <root>] [--json <out>]
node scripts/generate-component-files.mjs --write [--component <name>] [--file <file>] [--package <root>]
node scripts/report-component-files.mjs --package ../ui-pro/components   # this report and its JSON
```

Read on 2026-10-28 from simai/ui-source main 8583e378 and simai/ui-pro main
1468eb0 (read only); the full differences, every one by path, come from
`--check --json <file>`.

`--package` takes a package root that holds `src/smart/<name>/`; ui-pro runs
the same script over its own folders (`--package ../ui-pro/components`, read
only here). tests/component-files-generated.contract.test.mjs runs the check
over this repository.

**The bridge.** The folders are still 1.3.10 folders, so the generator first
reads a 1.4 view of each in memory and takes from today's files what the five
do not carry yet: relations and their comments from rule.js, the rows from
aliases.json, setting words from meta.mjs and the manifest (only where
component.json has no summary), x-registry and the build stamp (provenance,
runtime pair) from smart.manifest.json, the studio example from the fixture
and scenario, the conformance page from probe.json. Every bridged fact is
listed per component in the JSON (`bridge`). Two consequences:

1. For the five reproduced files, equality proves the generator is
   **lossless** on the way to 1.4 (phase A can switch their source), not that
   they cannot drift: in phase 1 they are partly their own input. What guards
   them today is the identity check (fixture, scenario and probe name their own
   component) and the manifest pins, whose counts cannot rise.
2. For smart.manifest.json, everything the registry alone says is carried
   (b, x-registry), so every difference left is a fact derived from
   component.json, lang/ or rule.js that the committed file says otherwise.

**Classes.** a1-fact: the committed file is stale against component.json,
lang/en.json or rule.js; the generator is right. a1-words: the same, for words
(summary, description; the role in words); component.json's text is taken, to
be read in the phase A diff. a2-rule: one rule for all where the committed
files differ in form. c: both files say different things and neither is the
obvious source; where the code gives evidence (it names the input, the event,
or one spelling of a field) it is quoted.

<!-- generated:start (scripts/report-component-files.mjs) -->

Inputs (Git tree of src/smart): simai/ui-source 1c87d05aec32, simai/ui-pro c2c97a94ac2e. Components: 70 (59 simai/ui-source, 11 simai/ui-pro).

### Per generated file

| File | identical (bytes) | semantically identical | differs | committed, not generated | generated, not committed |
|:---|---:|---:|---:|---:|---:|
| rule.js | 59 | 11 | 0 | 0 | 0 |
| aliases.json | 67 | 3 | 0 | 0 | 0 |
| meta.mjs | 20 | 0 | 0 | 0 | 0 |
| studio.fixture.json | 65 | 1 | 0 | 0 | 0 |
| studio.scenario.json | 62 | 1 | 0 | 0 | 0 |
| probe.json | 68 | 1 | 0 | 0 | 0 |
| smart.manifest.json | 59 | 0 | 11 | 0 | 0 |

### smart.manifest.json differences by class

| Class | Differences | Share |
|:---|---:|---:|
| a1-fact | 134 | 22 % |
| a1-words | 6 | 1 % |
| a2-rule | 366 | 60 % |
| c | 99 | 16 % |
| total | 605 | |

### smart.manifest.json differences by kind

| Class | Kind | Differences | Components |
|:---|:---|---:|:---|
| a1-fact | alias-event-missing | 43 | change-confirm, chat-composer, chat-interlocutor, chat-message, chat-window, message-log, table, thread-list |
| a1-fact | alias-setting-missing | 1 | chat-message |
| a1-fact | declarative.events | 1 | property-view |
| a1-fact | declarative.props | 5 | admin-menu, chat-window, data-view, property-view, table |
| a1-fact | event-missing | 2 | table |
| a1-fact | event-stale | 8 | data-view, property-view |
| a1-fact | input.default | 26 | admin-menu, chat-message, chat-window, data-view |
| a1-fact | input.enum-values-missing | 1 | table |
| a1-fact | input.maximum | 1 | chat-window |
| a1-fact | input.minimum | 1 | chat-window |
| a1-fact | input.type | 12 | change-confirm, chat-message, chat-window, message-log, thread-list |
| a1-fact | method-missing | 3 | data-view, property-view, table |
| a1-fact | payload-fields-missing | 6 | property-view, table |
| a1-fact | setting-missing | 18 | admin-menu, data-view, message-log, table, thread-list |
| a1-fact | title | 3 | data-view, property-view, table |
| a1-fact | uses-missing | 3 | data-view, property-view, table |
| a1-words | accessibility.role-words | 2 | chat-window, table |
| a1-words | input.description | 3 | chat-composer, chat-interlocutor, thread-list |
| a1-words | summary | 1 | chat-composer |
| a2-rule | base-setting | 24 | admin-menu, change-confirm, chat-composer, chat-interlocutor, chat-message, chat-window, data-view, message-log … (11) |
| a2-rule | declarative.assets | 2 | admin-menu, property-view |
| a2-rule | empty-block | 7 | change-confirm, chat-composer, chat-interlocutor, chat-message, chat-window, message-log, thread-list |
| a2-rule | input.default | 88 | admin-menu, change-confirm, chat-composer, message-log, property-view, table, thread-list |
| a2-rule | input.description | 7 | admin-menu, change-confirm, chat-composer, chat-interlocutor, message-log, table, thread-list |
| a2-rule | input.enum-as-range | 1 | chat-window |
| a2-rule | method.arguments-form | 35 | admin-menu, change-confirm, chat-composer, chat-interlocutor, chat-window, data-view, message-log, property-view … (10) |
| a2-rule | order | 3 | chat-composer, chat-message, chat-window |
| a2-rule | payload-field.type-form | 37 | admin-menu, change-confirm, chat-composer, chat-interlocutor, chat-message, data-view, message-log, property-view … (10) |
| a2-rule | payload.additionalProperties | 93 | admin-menu, change-confirm, chat-composer, chat-interlocutor, chat-message, chat-window, data-view, message-log … (11) |
| a2-rule | payload.description | 2 | data-view, table |
| a2-rule | payload.required | 63 | admin-menu, chat-composer, chat-message, chat-window, data-view, message-log, property-view, table … (9) |
| a2-rule | payload.type | 2 | table |
| a2-rule | template-open | 2 | chat-message, property-view |
| c | declarative.events | 3 | admin-menu, data-view, table |
| c | event-undeclared | 8 | data-view, property-view |
| c | host-port | 3 | admin-menu, chat-window, property-view |
| c | method.arguments | 4 | chat-window, thread-list |
| c | payload-field | 50 | admin-menu, data-view, message-log, property-view, table |
| c | payload-field.spelling | 24 | admin-menu, chat-composer, chat-window |
| c | payload-field.values | 6 | admin-menu, data-view, property-view, table |
| c | uses-not-loaded | 1 | data-view |

### (c) Conflicts, by component

**simai/ui-pro admin-menu** (29)

- `composition.declarative.events` — the registry lists sf-admin-menu-intent, which the code still names, and component.json does not declare; registry ["sf-admin-menu-intent","sf-admin-menu-navigate","sf-admin-menu-compact-change"], generated ["sf-admin-menu-compact-change","sf-admin-menu-query","sf-admin-menu-settings-cancel","sf-admin-menu-settings-mode-change","sf-admin-menu-settings-refresh","sf-admin-menu-settings-save","sf-admin-m... (src/smart/admin-menu/smart.manifest.json:97)
- `composition.declarative.host_port.path` — component.json port and the registry's host_port differ; registry "src/core/contracts/ports/simai.admin-navigation-port/1.0.0/port.json", generated "contracts/ports/simai.admin-navigation-port/1.0.0/port.json" (src/smart/admin-menu/smart.manifest.json:109, src/smart/admin-menu/component.json:126)
- `events.sf-admin-menu-compact-change.payload.properties.source.enum` — the values differ; registry absent, generated ["toggle","api"] (src/smart/admin-menu/smart.manifest.json:212, src/smart/admin-menu/component.json:155)
- `events.sf-admin-menu-settings-cancel.payload.properties.baseRevision` — baseRevision only in component.json; registry absent, generated {"type":"number"} (src/smart/admin-menu/smart.manifest.json:534, src/smart/admin-menu/component.json:190)
- `events.sf-admin-menu-navigate.payload.properties.id` — id only in component.json; registry absent, generated {} (src/smart/admin-menu/smart.manifest.json:99, src/smart/admin-menu/component.json:273)
- `events.sf-admin-menu-navigate.payload.properties.region` — region only in component.json; registry absent, generated {"type":"boolean"} (src/smart/admin-menu/smart.manifest.json:99, src/smart/admin-menu/component.json:279)
- `events.sf-admin-menu-refresh.payload.properties.reason` — reason only in component.json; registry absent, generated {"type":["string","null"]} (src/smart/admin-menu/smart.manifest.json:716, src/smart/admin-menu/component.json:291)
- `events.sf-admin-menu-refresh.payload.properties.site` — site only in component.json; registry absent, generated {} (src/smart/admin-menu/smart.manifest.json:716, src/smart/admin-menu/component.json:295)
- `events.sf-admin-menu-open.payload.properties.id` — id only in component.json; registry absent, generated {} (src/smart/admin-menu/smart.manifest.json:733, src/smart/admin-menu/component.json:306)
- `events.sf-admin-menu-open.payload.properties.href` — href only in component.json; registry absent, generated {"type":["string","null"]} (src/smart/admin-menu/smart.manifest.json:733, src/smart/admin-menu/component.json:307)
- `events.sf-admin-menu-open.payload.properties.group` — group only in component.json; registry absent, generated {"type":["string","null"]} (src/smart/admin-menu/smart.manifest.json:733, src/smart/admin-menu/component.json:312)
- `events.sf-admin-menu-toggle.payload.properties.id` — id only in component.json; registry absent, generated {} (src/smart/admin-menu/smart.manifest.json:750, src/smart/admin-menu/component.json:256)
- `events.sf-admin-menu-toggle.payload.properties.on` — on only in component.json; registry absent, generated {"type":"boolean"} (src/smart/admin-menu/smart.manifest.json:750, src/smart/admin-menu/component.json:325)
- `events.sf-admin-menu-save.payload.properties.values` — values only in component.json; registry absent, generated {"type":"object"} (src/smart/admin-menu/smart.manifest.json:767, src/smart/admin-menu/component.json:333)
- `events.sf-admin-menu-save.payload.properties.id` — id only in component.json; registry absent, generated {} (src/smart/admin-menu/smart.manifest.json:767, src/smart/admin-menu/component.json:337)
- `events.sf-admin-menu-save.payload.properties.revision` — revision only in component.json; registry absent, generated {"type":["number","null"]} (src/smart/admin-menu/smart.manifest.json:767, src/smart/admin-menu/component.json:342)
- `events.sf-admin-menu-query.payload.properties.kind.enum` — the values differ; registry absent, generated ["menu","site","search"] (src/smart/admin-menu/smart.manifest.json:789, src/smart/admin-menu/component.json:166)
- `events.sf-admin-menu-query.payload.properties.query` — query only in component.json; registry absent, generated {"type":"string"} (src/smart/admin-menu/smart.manifest.json:784, src/smart/admin-menu/component.json:164)
- `events.sf-admin-menu-query.payload.properties.requestId` — requestId only in component.json; registry absent, generated {"type":"string"} (src/smart/admin-menu/smart.manifest.json:784, src/smart/admin-menu/component.json:164)
- `events.sf-admin-menu-rename.payload.properties.id` — id only in component.json; registry absent, generated {} (src/smart/admin-menu/smart.manifest.json:818, src/smart/admin-menu/component.json:361)
- `events.sf-admin-menu-rename.payload.properties.title` — title only in component.json; registry absent, generated {"type":"string"} (src/smart/admin-menu/smart.manifest.json:818, src/smart/admin-menu/component.json:362)
- `events.sf-admin-menu-delete.payload.properties.ids` — ids only in component.json; registry absent, generated {"type":"array"} (src/smart/admin-menu/smart.manifest.json:835, src/smart/admin-menu/component.json:370)
- `events.sf-admin-menu-read.payload.properties.ids` — ids only in component.json; registry absent, generated {"type":"array"} (src/smart/admin-menu/smart.manifest.json:852, src/smart/admin-menu/component.json:378)
- `events.sf-admin-menu-reset.payload.properties.kind.enum` — the values differ; registry absent, generated ["settings","view"] (src/smart/admin-menu/smart.manifest.json:874, src/smart/admin-menu/component.json:241)
- `events.sf-admin-menu-reset.payload.properties.target` — target only in component.json; registry absent, generated {"type":"string"} (src/smart/admin-menu/smart.manifest.json:869, src/smart/admin-menu/component.json:248)
- `events.sf-admin-menu-reset.payload.properties.baseRevision` — baseRevision only in component.json; registry absent, generated {"type":"number"} (src/smart/admin-menu/smart.manifest.json:869, src/smart/admin-menu/component.json:239)
- `events.sf-admin-menu-reset.payload.properties.id` — id only in component.json; registry absent, generated {} (src/smart/admin-menu/smart.manifest.json:869, src/smart/admin-menu/component.json:256)
- `events.sf-admin-menu-settings-refresh.payload.properties.base_revision|baseRevision` — one field, two spellings: the registry base_revision, component.json (camelCased) baseRevision; the code names base_revision 7×, baseRevision 2×; registry base_revision, generated baseRevision (src/smart/admin-menu/smart.manifest.json:571, src/smart/admin-menu/component.json:213)
- `events.sf-admin-menu-settings-save.payload.properties.base_revision|baseRevision` — one field, two spellings: the registry base_revision, component.json (camelCased) baseRevision; the code names base_revision 7×, baseRevision 2×; registry base_revision, generated baseRevision (src/smart/admin-menu/smart.manifest.json:619, src/smart/admin-menu/component.json:226)

**simai/ui-pro chat-window** (23)

- `composition.declarative.host_port.version` — component.json port and the registry's host_port differ; registry "1.0.0", generated "1.0" (src/smart/chat-window/smart.manifest.json:114, src/smart/chat-window/component.json:478)
- `methods.settle.arguments` — arguments differ: registry ["request-id","result"], component.json ["requestId","result"]; registry [{"name":"request-id","required":true,"schema":{"type":"string"}},{"name":"result","required":true,"schema":{"type":"object"}}], generated [{"name":"requestId","schema":{"type":"string"}},{"name":"result","schema":{"type":"object"}}] (src/smart/chat-window/smart.manifest.json:287, src/smart/chat-window/component.json:397)
- `events.sf-chat-window-open.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:114)
- `events.sf-chat-window-load-more.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:127)
- `events.sf-chat-window-submit.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:140)
- `events.sf-chat-window-retry.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:153)
- `events.sf-chat-window-save.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:166)
- `events.sf-chat-window-delete.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:179)
- `events.sf-chat-window-read.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:192)
- `events.sf-chat-window-rate.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:205)
- `events.sf-chat-window-answer.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:218)
- `events.sf-chat-window-check.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:231)
- `events.sf-chat-window-stop.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:244)
- `events.sf-chat-window-create.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:257)
- `events.sf-chat-window-rename.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:270)
- `events.sf-chat-window-archive.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:283)
- `events.sf-chat-window-restore.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:296)
- `events.sf-chat-window-select.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:309)
- `events.sf-chat-window-query.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:322)
- `events.sf-chat-window-pin.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:335)
- `events.sf-chat-window-attach.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:349)
- `events.sf-chat-window-detach.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:362)
- `events.sf-chat-window-settled.payload.properties.request-id|requestId` — one field, two spellings: the registry request-id, component.json (camelCased) requestId; the code names request-id 10×, requestId 13×; registry request-id, generated requestId (src/smart/chat-window/smart.manifest.json:289, src/smart/chat-window/component.json:375)

**simai/ui-pro data-view** (17)

- `composition.uses` — the registry names a use rule.js does not load; registry ["smart.data-view"], generated ["component.icons","smart.button","smart.checkbox","smart.dropdown","smart.icon-button","smart.pagination","smart.table","smart.toast"] (src/smart/data-view/smart.manifest.json:31)
- `composition.declarative.events` — the registry lists sf-data-view-saved-view-intent, sf-table-column-settings-reset, sf-table-template-delete, sf-table-template-save, sf-table-template-select, which the code still names, and component.json does not declare; registry ["sf-count-request","sf-data-view-answer","sf-data-view-saved-view-intent","sf-data-view-state","sf-table-action-intent","sf-table-column-settings-change","sf-table-column-settings-reset","sf-table..., generated ["sf-data-view-open","sf-data-view-deleted","sf-data-view-answer","sf-data-view-state","sf-data-view-tree","sf-data-view-files-drop"] (src/smart/data-view/smart.manifest.json:52)
- `events.sf-data-view-answer.payload.properties.reason` — reason only in the registry; registry {"type":"string","description":"Why, when the answer is not applied: the host's reason, or the view's own (port-not-connected, capability-not-provided, action-not-allowed, no-base-revision). A refu..., generated absent (src/smart/data-view/smart.manifest.json:341, src/smart/data-view/component.json:165)
- `events.sf-data-view-answer.payload.properties.message` — message only in the registry; registry {"type":"string","description":"The host's own sentence for a person, as the port answer carries it. On a refused or unavailable query.change a non-empty message is what the view shows: the title o..., generated absent (src/smart/data-view/smart.manifest.json:696, src/smart/data-view/component.json:165)
- `events.sf-data-view-answer.payload.properties.data` — data only in the registry; registry {"type":"object","description":"The host's data, copied as it answered."}, generated absent (src/smart/data-view/smart.manifest.json:304, src/smart/data-view/component.json:165)
- `events.sf-data-view-answer.payload.properties.sequence` — sequence only in the registry; registry {"type":"integer","description":"The query sequence the host echoed, when it did."}, generated absent (src/smart/data-view/smart.manifest.json:704, src/smart/data-view/component.json:165)
- `events.sf-data-view-answer.payload.properties.effects` — effects only in the registry; registry {"type":"array","description":"Effects the host reported for the rest of the page."}, generated absent (src/smart/data-view/smart.manifest.json:708, src/smart/data-view/component.json:165)
- `events.sf-data-view-answer.payload.properties.instance_id` — instance_id only in the registry; registry {"type":"string","description":"The view's instance id, sf-data-view-<n>."}, generated absent (src/smart/data-view/smart.manifest.json:675, src/smart/data-view/component.json:165)
- `events.sf-data-view-saved-view-intent` — the code still names sf-data-view-saved-view-intent; neither component.json nor aliases.json declares it; registry {"summary":"An event a page raises on the view to save a shared saved view (port 1.1.0 or later): the view raises view.save_shared with the detail's key and label.","payload":{"type":"object","requ..., generated absent (src/smart/data-view/smart.manifest.json:55)
- `events.sf-data-view-state.payload.properties.state.enum` — the values differ; registry ["loading","populated","empty","error"], generated ["loading","populated","empty","error","no-access"] (src/smart/data-view/smart.manifest.json:757, src/smart/data-view/component.json:181)
- `events.sf-data-view-state.payload.properties.instance_id` — instance_id only in the registry; registry {"type":"string","description":"The view's instance id, sf-data-view-<n>."}, generated absent (src/smart/data-view/smart.manifest.json:675, src/smart/data-view/component.json:181)
- `events.sf-table-column-settings-reset` — the code still names sf-table-column-settings-reset; neither component.json nor aliases.json declares it; registry {"summary":"A table event the view listens to: the person asked for the default columns back. The view calls resetColumnSettings, an empty personal layer written against its revision; the host supp..., generated absent (src/smart/data-view/smart.manifest.json:59)
- `events.sf-table-template-delete` — the code still names sf-table-template-delete; neither component.json nor aliases.json declares it; registry {"summary":"A table event the view listens to: a saved template was deleted on the Templates tab, one event per template. The view raises view.delete with the key.","payload":{"type":"object","requ..., generated absent (src/smart/data-view/smart.manifest.json:62)
- `events.sf-table-template-save` — the code still names sf-table-template-save; neither component.json nor aliases.json declares it; registry {"summary":"A table event the view listens to: a filter template was saved. The view turns it into saveView (view.save) with key, label, revision, level, roles, layout and settings; an array detail..., generated absent (src/smart/data-view/smart.manifest.json:63)
- `events.sf-table-template-select` — the code still names sf-table-template-select; neither component.json nor aliases.json declares it; registry {"summary":"A table event the view listens to: a different saved template was applied on the Templates tab. The view raises view.open with the key and restores the filter fields the view was saved ..., generated absent (src/smart/data-view/smart.manifest.json:64)
- `events.sf-host-port-request` — the code still names sf-host-port-request; neither component.json nor aliases.json declares it; registry {"summary":"Asks the page for a host port, once per connection and only while this element has none. The shared convention for every component that takes `setHostPort`, so a consumer composing one ..., generated absent (src/smart/data-view/smart.manifest.json:1048)
- `events.sf-table-cell-set` — the code still names sf-table-cell-set; neither component.json nor aliases.json declares it; registry {"summary":"A table event the view listens to: a checkable cell was pressed. The view raises record.set of simai.dataview-port 1.11.0 (capability inline-edit) with record_id, key, value and revisio..., generated absent (src/smart/data-view/smart.manifest.json:1123)

**simai/ui-pro table** (12)

- `composition.declarative.events` — the registry lists sf-table-action-intent, which the code still names, and component.json does not declare; registry ["sf-table-search-change","sf-table-filter-change","sf-table-sort-change","sf-table-create-intent","sf-table-template-save","sf-table-template-select","sf-table-template-delete","sf-table-column-se..., generated ["sf-table-select","sf-table-apply","sf-table-save","sf-table-column-settings-reset","sf-table-create","sf-table-filter-change","sf-table-query","sf-table-refresh","sf-table-search-change","sf-tabl... (src/smart/table/smart.manifest.json:92)
- `events.sf-table-column-settings-reset.payload.properties.target.const` — the values differ; registry "personal", generated absent (src/smart/table/smart.manifest.json:1202, src/smart/table/component.json:318)
- `events.sf-table-column-settings-reset.payload.properties.tableSettingsKey` — tableSettingsKey only in the registry; registry {"type":["string","null"],"description":"The table's settings key, or null when it has none."}, generated absent (src/smart/table/smart.manifest.json:1203, src/smart/table/component.json:316)
- `events.sf-table-filter-change.payload.properties.templateKey` — templateKey only in the registry; registry {"type":"string","description":"The selected template's key, or an empty string."}, generated absent (src/smart/table/smart.manifest.json:1245, src/smart/table/component.json:328)
- `events.sf-table-filter-change.payload.properties.templateLabel` — templateLabel only in the registry; registry {"type":"string","description":"The selected template's label, or an empty string."}, generated absent (src/smart/table/smart.manifest.json:1246, src/smart/table/component.json:328)
- `events.sf-table-save.payload.properties.columnSettings` — columnSettings only in the registry; registry {"type":"object"}, generated absent (src/smart/table/smart.manifest.json:1546, src/smart/table/component.json:304)
- `events.sf-table-save.payload.properties.reason` — reason only in component.json; registry absent, generated {"type":"string"} (src/smart/table/smart.manifest.json:1535, src/smart/table/component.json:312)
- `events.sf-table-query.payload.properties.context` — context only in component.json; registry absent, generated {"type":"object"} (src/smart/table/smart.manifest.json:1569, src/smart/table/component.json:339)
- `events.sf-table-load-more.payload.properties.parent` — parent only in component.json; registry absent, generated {"type":"object"} (src/smart/table/smart.manifest.json:1610, src/smart/table/component.json:415)
- `events.sf-table-load-more.payload.properties.cursor` — cursor only in component.json; registry absent, generated {"type":"string"} (src/smart/table/smart.manifest.json:1610, src/smart/table/component.json:416)
- `events.sf-table-move.payload.properties.before` — before only in component.json; registry absent, generated {"type":"object"} (src/smart/table/smart.manifest.json:1623, src/smart/table/component.json:429)
- `events.sf-table-move.payload.properties.order` — order only in component.json; registry absent, generated {"type":"array"} (src/smart/table/smart.manifest.json:1623, src/smart/table/component.json:430)

**simai/ui-pro property-view** (11)

- `composition.declarative.host_port.sha256` — component.json port and the registry's host_port differ; registry "5e4a47b0ce0d7226a388d3f7b146f725d0db72aa1d1022fb59368ae4526f2d6a", generated "bc1ccf1449a7d90c07fbf33daaf82b0ee31c8e6761f81c0e517c9da68e437576" (src/smart/property-view/smart.manifest.json:128, src/smart/property-view/component.json:499)
- `events.sf-host-port-request` — the code still names sf-host-port-request; neither component.json nor aliases.json declares it; registry {"summary":"Asks the page for a host port, once per connection and only while this element has none. The shared convention for every component that takes `setHostPort`. Answered by calling `setHost..., generated absent (src/smart/property-view/smart.manifest.json:964)
- `events.sf-property-view-favourite.payload.properties.record_id` — record_id only in the registry; registry {"type":["string","null"]}, generated absent (src/smart/property-view/smart.manifest.json:984, src/smart/property-view/component.json:436)
- `events.sf-property-view-created.payload.properties.record_id` — record_id only in the registry; registry {"type":["string","integer","null"]}, generated absent (src/smart/property-view/smart.manifest.json:1021, src/smart/property-view/component.json:408)
- `events.sf-property-view-cancel.payload.properties.mode.enum` — the values differ; registry ["view","edit","create"], generated ["edit","create"] (src/smart/property-view/smart.manifest.json:1042, src/smart/property-view/component.json:416)
- `events.sf-property-view-cancel.payload.properties.scope` — scope only in the registry; registry {"enum":["group"]}, generated absent (src/smart/property-view/smart.manifest.json:1049, src/smart/property-view/component.json:414)
- `events.sf-property-view-cancel.payload.properties.section` — section only in the registry; registry {"type":"string"}, generated absent (src/smart/property-view/smart.manifest.json:1054, src/smart/property-view/component.json:414)
- `events.sf-property-view-cancel.payload.properties.group` — group only in the registry; registry {"type":"string"}, generated absent (src/smart/property-view/smart.manifest.json:1051, src/smart/property-view/component.json:414)
- `events.sf-property-view-delete.payload.properties.record_id` — record_id only in the registry; registry {}, generated absent (src/smart/property-view/smart.manifest.json:1116, src/smart/property-view/component.json:400)
- `events.sf-property-view-delete.payload.properties.collection` — collection only in component.json; registry absent, generated {"type":"string"} (src/smart/property-view/smart.manifest.json:1111, src/smart/property-view/component.json:402)
- `events.sf-property-view-delete.payload.properties.revision` — revision only in component.json; registry absent, generated {"type":"string"} (src/smart/property-view/smart.manifest.json:1111, src/smart/property-view/component.json:403)

**simai/ui-pro message-log** (3)

- `events.sf-message-log-chunk.payload.properties.revision` — revision only in component.json; registry absent, generated {"type":"string"} (src/smart/message-log/smart.manifest.json:592, src/smart/message-log/component.json:113)
- `events.sf-message-log-failed.payload.properties.reason` — reason only in component.json; registry absent, generated {"type":"string"} (src/smart/message-log/smart.manifest.json:620, src/smart/message-log/component.json:129)
- `events.sf-message-log-failed.payload.properties.message` — message only in component.json; registry absent, generated {"type":"string"} (src/smart/message-log/smart.manifest.json:620, src/smart/message-log/component.json:130)

**simai/ui-pro thread-list** (3)

- `methods.setThreads.arguments` — arguments differ: registry ["threads","options"], component.json ["threads","hasMore"]; registry [{"name":"threads","required":true,"schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":["string","number"]},"title":{"type":"string"},"updated_at":{"type":"string","descrip..., generated [{"name":"threads","schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":["string","number"]},"title":{"type":"string"},"updated_at":{"type":"string","description":"ISO 8601;... (src/smart/thread-list/smart.manifest.json:213, src/smart/thread-list/component.json:93)
- `methods.appendThreads.arguments` — arguments differ: registry ["threads","options"], component.json ["threads","hasMore"]; registry [{"name":"threads","required":true,"schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":["string","number"]},"title":{"type":"string"},"updated_at":{"type":"string","descrip..., generated [{"name":"threads","schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":["string","number"]},"title":{"type":"string"},"updated_at":{"type":"string","description":"ISO 8601;... (src/smart/thread-list/smart.manifest.json:289, src/smart/thread-list/component.json:93)
- `methods.openMenu.arguments` — arguments differ: registry ["id","anchor"], component.json ["id"]; registry [{"name":"id","required":true,"schema":{"type":"string"}},{"name":"anchor","required":true,"schema":{"type":"object"}}], generated [{"name":"id","schema":{}}] (src/smart/thread-list/smart.manifest.json:498, src/smart/thread-list/component.json:93)

**simai/ui-pro chat-composer** (1)

- `events.sf-chat-composer-submit.payload.properties.attachment-ids|attachmentIds` — one field, two spellings: the registry attachment-ids, component.json (camelCased) attachmentIds; the code names attachment-ids 2×, attachmentIds 1×; registry attachment-ids, generated attachmentIds (src/smart/chat-composer/smart.manifest.json:283, src/smart/chat-composer/component.json:82)

### (b) What only smart.manifest.json holds (x-registry), by key

| Key | Components | Lines | Belongs in 1.4 |
|:---|---:|---:|:---|
| methods | 50 | 4518 | dated `method` aliases in component.json, or retired (§4.4: no reader methods) |
| alias-events | 41 | 2569 | ? |
| contracts | 41 | 1600 | the port contract (src/core/contracts/ports) or the change journal: it restates them |
| ai_guidance | 70 | 1457 | one `registry` block (already copied in component.json x-kept) |
| presentation | 70 | 1302 | one `registry` block (already copied in component.json x-kept) |
| state | 54 | 784 | component.json `host-states` / `entry-state` (state machines are the standard's) |
| ownership | 70 | 673 | one `registry` block (already copied in component.json x-kept) |
| security | 70 | 574 | one `registry` block (already copied in component.json x-kept) |
| compatibility | 20 | 554 | the change journal (contracts/changes): migrations, replacement, extra deprecations |
| accessibility | 65 | 509 | component.json `accessibility` (focus, accessible_name, keyboard words: one field each) |
| inputs | 38 | 500 | base/host words and constraints §4.2 has no field for (minLength, required): add them to §4.2 or drop |
| composition-declarative | 6 | 432 | derived except standard/profiles/data/persistence/presentation: generate it |
| readiness | 32 | 343 | one small `registry` block, or derived from the gates a release ran |
| capabilities | 42 | 285 | one small `registry` block in component.json, or dropped in manifest schema v3 |
| persistence | 22 | 269 | the port contract (persistence is the host's) |
| item_contract | 12 | 251 | the port contract or the setting's `of` (§4.2) |
| tags | 36 | 195 | one small `registry` block, or dropped in schema v3 |
| trait-inputs | 6 | 102 | a trait contract (field-inherit@1) the generator expands; today the trait is code only (src/smart/helpers/inherited-value.js) |
| event-fields | 16 | 80 | component.json events (`canonical`: one flag per event) |
| public-parts | 6 | 39 | component.json `parts` |
| artifacts | 7 | 34 | derived (studio.fixture.json / studio.scenario.json names) |
| backend | 2 | 18 | the port contract |
| inputs-required | 3 | 10 | §4.2 `required` on a setting |
| adapter | 2 | 10 | one small `registry` block |
| reuse_mode | 7 | 7 | one small `registry` block |
| kind | 7 | 7 | one small `registry` block |
| lifecycle | 2 | 2 | one small `registry` block (stable/experimental is a release fact) |

### What each consumer of smart.manifest.json sees wrong today

| Consumer | Reads | Wrong facts | Components |
|:---|:---|---:|---:|
| ui-doc | summary, inputs (type, default, enum, description), methods, events (ui-doc scripts/build-smart-reference.mjs → the public Smart reference on ui.simai.io) | 238 | 11 |
| ui-studio | title, summary, version, inputs as the props schema (additionalProperties: false), methods, events, ai_guidance (packages/mcp catalog-service: public_abi for agents; scripts/lib/owner-sources.mjs) | 257 | 11 |
| ui-vscode | inputs (name, type, default, description, enum, examples), summary, compatibility.deprecations/replacement, lifecycle (src/generate/buildFramework.ts: IntelliSense) | 84 | 11 |
| ui registry (ui-builder bind-generated-runtime-contracts.py) | title and lifecycle, once, when an entry is added to ui contracts/owners/smart-component.manifest.json | 3 | 3 |

**ui-doc**

| Class | Kind | Facts | Components |
|:---|:---|---:|:---|
| c | payload-field | 50 | admin-menu, data-view, message-log, property-view, table |
| a1-fact | alias-event-missing | 43 | change-confirm, chat-composer, chat-interlocutor, chat-message, chat-window, message-log, table, thread-list |
| a1-fact | input.default | 26 | admin-menu, chat-message, chat-window, data-view |
| a2-rule | base-setting | 24 | admin-menu, change-confirm, chat-composer, chat-interlocutor, chat-message, chat-window, data-view, message-log, property-view, table … (11) |
| c | payload-field.spelling | 24 | admin-menu, chat-composer, chat-window |
| a1-fact | setting-missing | 18 | admin-menu, data-view, message-log, table, thread-list |
| a1-fact | input.type | 12 | change-confirm, chat-message, chat-window, message-log, thread-list |
| a1-fact | event-stale | 8 | data-view, property-view |
| c | event-undeclared | 8 | data-view, property-view |
| c | payload-field.values | 6 | admin-menu, data-view, property-view, table |
| a1-fact | payload-fields-missing | 6 | property-view, table |
| c | method.arguments | 4 | chat-window, thread-list |
| a1-fact | method-missing | 3 | data-view, property-view, table |
| a1-fact | event-missing | 2 | table |
| a1-fact | alias-setting-missing | 1 | chat-message |
| a1-fact | input.minimum | 1 | chat-window |
| a1-fact | input.maximum | 1 | chat-window |
| a1-fact | input.enum-values-missing | 1 | table |

**ui-studio**

| Class | Kind | Facts | Components |
|:---|:---|---:|:---|
| c | payload-field | 50 | admin-menu, data-view, message-log, property-view, table |
| a1-fact | alias-event-missing | 43 | change-confirm, chat-composer, chat-interlocutor, chat-message, chat-window, message-log, table, thread-list |
| a1-fact | input.default | 26 | admin-menu, chat-message, chat-window, data-view |
| a2-rule | base-setting | 24 | admin-menu, change-confirm, chat-composer, chat-interlocutor, chat-message, chat-window, data-view, message-log, property-view, table … (11) |
| c | payload-field.spelling | 24 | admin-menu, chat-composer, chat-window |
| a1-fact | setting-missing | 18 | admin-menu, data-view, message-log, table, thread-list |
| a1-fact | input.type | 12 | change-confirm, chat-message, chat-window, message-log, thread-list |
| a1-fact | event-stale | 8 | data-view, property-view |
| c | event-undeclared | 8 | data-view, property-view |
| c | payload-field.values | 6 | admin-menu, data-view, property-view, table |
| a1-fact | payload-fields-missing | 6 | property-view, table |
| a1-fact | declarative.props | 5 | admin-menu, chat-window, data-view, property-view, table |
| c | method.arguments | 4 | chat-window, thread-list |
| c | declarative.events | 3 | admin-menu, data-view, table |
| c | host-port | 3 | admin-menu, chat-window, property-view |
| a1-fact | title | 3 | data-view, property-view, table |
| a1-fact | uses-missing | 3 | data-view, property-view, table |
| a1-fact | method-missing | 3 | data-view, property-view, table |
| a1-fact | event-missing | 2 | table |
| a1-fact | alias-setting-missing | 1 | chat-message |
| a1-fact | input.minimum | 1 | chat-window |
| a1-fact | input.maximum | 1 | chat-window |
| c | uses-not-loaded | 1 | data-view |
| a1-fact | declarative.events | 1 | property-view |
| a1-fact | input.enum-values-missing | 1 | table |

**ui-vscode**

| Class | Kind | Facts | Components |
|:---|:---|---:|:---|
| a1-fact | input.default | 26 | admin-menu, chat-message, chat-window, data-view |
| a2-rule | base-setting | 24 | admin-menu, change-confirm, chat-composer, chat-interlocutor, chat-message, chat-window, data-view, message-log, property-view, table … (11) |
| a1-fact | setting-missing | 18 | admin-menu, data-view, message-log, table, thread-list |
| a1-fact | input.type | 12 | change-confirm, chat-message, chat-window, message-log, thread-list |
| a1-fact | alias-setting-missing | 1 | chat-message |
| a1-fact | input.minimum | 1 | chat-window |
| a1-fact | input.maximum | 1 | chat-window |
| a1-fact | input.enum-values-missing | 1 | table |

**ui registry (ui-builder bind-generated-runtime-contracts.py)**

| Class | Kind | Facts | Components |
|:---|:---|---:|:---|
| a1-fact | title | 3 | data-view, property-view, table |

### The facts by name

What the committed registry lacks or names wrongly, per component (`registry → component.json` where a value).

**event-missing** (2)

pro table: sf-table-reference-open, sf-table-view-change

**alias-event-missing** (43)

pro change-confirm: sf-change-confirm-accept, sf-change-confirm-decline, sf-change-confirm-expire; pro chat-composer: sf-chat-send, sf-chat-stop, sf-chat-files, sf-chat-action; pro chat-interlocutor: sf-chat-interlocutor; pro chat-message: sf-chat-action; pro chat-window: chat-port:open, chat-port:older, chat-port:send, chat-port:retry, chat-port:edit, chat-port:delete, chat-port:read, chat-port:rate, chat-port:file-retry, chat-port:decide, chat-port:check, chat-port:stop, chat-port:create, chat-port:rename, chat-port:archive, chat-port:interlocutor, chat-window:view, chat-window:more, chat-window:search, chat-window:pin, chat-window:attach, chat-window:detach, chat-window:files, chat-window:file-remove; pro message-log: sf-message-log-load-earlier; pro table: sf-table:column-settings-change, onColumnSettingsChange, onSearchEnd, onTemplateSave, onFilterUpdate; pro thread-list: sf-thread-list-select, sf-thread-list-unarchive, sf-thread-list-action, sf-thread-list-view

**method-missing** (3)

pro data-view: clearSelection; pro property-view: refresh; pro table: focusRow

**setting-missing** (18)

pro admin-menu: recent-results; pro data-view: bulk-actions, first-answer; pro message-log: messages; pro table: active-filter-fields, bulk-actions, columns, create-items, filter-fields, rows, table-data, table-settings, templates, toolbar-actions, sort, selection; pro thread-list: threads, actions

**alias-setting-missing** (1)

pro chat-message: view

**input.enum-values-missing** (1)

pro table: data-state ["ready"]

**event-undeclared** (8)

pro data-view: sf-data-view-saved-view-intent, sf-table-column-settings-reset, sf-table-template-delete, sf-table-template-save, sf-table-template-select, sf-host-port-request, sf-table-cell-set; pro property-view: sf-host-port-request

**title** (3)

pro data-view: "Data view composite" → "Data view"; pro property-view: "Property view" → "Record"; pro table: "Data view" → "Table"

### meta.mjs differences by class

| Class | Differences |
|:---|---:|

### Per component

| Component | rule | aliases | meta | fixture | scenario | probe | manifest a1-fact / a1-words / a2 / c | x-registry lines |
|:---|:---|:---|:---|:---|:---|:---|:---|---:|
| accordion | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 243 |
| alert | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 150 |
| avatar | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 66 |
| avatars | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 59 |
| badge | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 63 |
| breadcrumbs | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 172 |
| button | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 229 |
| button-group | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 202 |
| checkbox | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 261 |
| close | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 60 |
| code-input | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 194 |
| color | = | = | – | – | – | = | 0 / 0 / 0 / 0 | 156 |
| composition-overlay | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 269 |
| context-menu | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 194 |
| copy-button | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 148 |
| country-code | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 93 |
| datepicker | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 267 |
| download-file | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 113 |
| drawer | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 453 |
| dropdown | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 179 |
| empty-state | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 115 |
| file-preview | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 188 |
| file-upload | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 384 |
| gallery | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 192 |
| help-mark | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 116 |
| icon | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 75 |
| icon-button | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 273 |
| image-field | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 226 |
| inline-editor | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 202 |
| input | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 316 |
| list-item | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 143 |
| menu | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 292 |
| modal | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 719 |
| page-header | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 102 |
| pagination | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 593 |
| popover | = | = | – | – | – | = | 0 / 0 / 0 / 0 | 106 |
| profile-picker | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 209 |
| progress-bar | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 126 |
| progress-scale | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 112 |
| quantity | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 224 |
| radio | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 216 |
| range-slider | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 376 |
| reference-link | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 111 |
| resizer | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 156 |
| skeleton | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 87 |
| slider | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 106 |
| sortable | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 225 |
| spinner | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 127 |
| steps | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 175 |
| switch | = | = | – | = | = | – | 0 / 0 / 0 / 0 | 263 |
| tabs | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 186 |
| tag | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 196 |
| textarea | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 182 |
| theme-generator | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 253 |
| toast | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 160 |
| toggle | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 214 |
| tooltip | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 87 |
| tree | = | = | – | = | = | = | 0 / 0 / 0 / 0 | 170 |
| tree-item | = | = | = | = | = | = | 0 / 0 / 0 / 0 | 199 |
| pro admin-menu | ≈ | ≈ | – | = | = | = | 3 / 0 / 49 / 29 | 483 |
| pro change-confirm | ≈ | ≈ | – | = | – | = | 5 / 0 / 11 / 0 | 228 |
| pro chat-composer | ≈ | = | – | = | = | = | 4 / 2 / 14 / 1 | 257 |
| pro chat-interlocutor | ≈ | = | – | = | = | = | 1 / 1 / 7 / 0 | 192 |
| pro chat-message | ≈ | = | – | ≈ | = | = | 4 / 0 / 25 / 0 | 193 |
| pro chat-window | ≈ | ≈ | – | = | ≈ | ≈ | 38 / 1 / 52 / 23 | 1187 |
| pro data-view | ≈ | = | – | – | – | = | 33 / 0 / 20 / 17 | 421 |
| pro message-log | ≈ | = | – | = | – | = | 3 / 0 / 27 / 3 | 300 |
| pro property-view | ≈ | = | – | – | – | = | 11 / 0 / 93 / 11 | 530 |
| pro table | ≈ | = | – | = | = | = | 25 / 1 / 44 / 12 | 1259 |
| pro thread-list | ≈ | = | – | = | – | = | 7 / 1 / 24 / 3 | 301 |

`=` byte-identical, `≈` semantically identical, `≠` differs, `!` committed but not generated, `–` neither.

<!-- generated:end -->

## Consumers, ranked by harm

They read the **distribution** copy (distr/smart/<folder>/smart.manifest.json
of the released pair, here ui-36116c01a792 = ui-source 8583e378), which is the
committed file; the counts above are what they see.

1. **ui-doc → the public Smart reference (ui.simai.io)**, scripts/
   build-smart-reference.mjs: summary, the attribute table (type, default,
   values, words), methods, events. People and agents read it as the API. It
   lists no `press` for sf-button, no open/close family for sf-modal and
   sf-drawer, no `opened`/`closed` for sf-context-menu, sf-help-mark and
   sf-gallery, no `toggle` for sf-accordion, no actions for sf-tree, wrong
   types (heading-level as a string, list settings as strings) and 53 wrong
   defaults; the base settings (template words, root-class, root-style) are missing
   on all 70. Harm: highest — public, and a page written from it does not work
   (it listens for events that do not exist under those names).
2. **ui-studio**: packages/mcp catalog-service returns `public_abi` (inputs,
   methods, events) to agents and validates props against `inputs` with
   `additionalProperties: false`: a valid `root-style`, `status` or `columns`
   (sf-table) is refused; title and version are stale for 10 and 11
   components. Harm: high — agents are steered away from the real interface.
3. **ui-vscode** (src/generate/buildFramework.ts, IntelliSense): attributes,
   types, defaults, values, words and deprecations. It does not offer the base
   settings, sf-table's list settings, tabs' `type` values or `ready`; it
   shows 53 wrong defaults and 42 wrong types; 5 components' former values are
   not marked deprecated (compatibility.aliases empty). Harm: medium — an
   author sees wrong hints, the page still works.
4. **ui registry** (ui-builder bind-generated-runtime-contracts.py → ui
   contracts/owners/smart-component.manifest.json): title and lifecycle, once,
   when an entry is added; entries keep their curated title afterwards (today
   «Inputs», «List Item», «Radio», «Sortable», «Textarea» against lang/en
   «Text fields», «List item», «Radio buttons», «Drag and drop», «Text area»).
   Harm: low — names in a catalogue.
5. **Docara** and **larena**: not affected directly. Docara reads Larena's own
   `larena.ui.smart_manifest.v1` files (src/Framework/
   FrameworkManifestRepository.php) and the schema `smart.manifest.schema.json`;
   larena's scripts read their own package manifests. Neither reads
   src/smart/*/smart.manifest.json.

Inside this repository: tests/manifest-defaults, manifest-enum-follows-
component, studio-artifacts-agree and alpha-ramp-and-appearances read the
committed manifests and meta.mjs; tag-density and textarea-owner match
meta.mjs text with regular expressions. They change when meta.mjs becomes
generated (phase A, the families that have one).

## What the generator had to decide (for the standard text)

- **The DOM name of an event** follows core/js/element-manifest.js
  `eventName`: the verb itself for `"carries": "native"` and for change/input
  (unless `"x-native": false`), otherwise `<tag>-<verb>`. Stand 26 always
  prefixed the tag; that was wrong for the 27 native events (change/input of the
  fields and choices).
- **A native event's payload is `{type: "null"}`**: the browser's Event has no
  detail.
- **Carried field names are camelCased** in the payload schema (stand 26's
  rule). Three ui-pro components and composition-overlay spell some fields
  otherwise in the code: chat-window `request-id` (10×) beside `requestId`
  (13×), admin-menu `base_revision` (7×) beside `baseRevision` (2×),
  chat-composer `attachment-ids`, composition-overlay `node_id`/`parent_id`.
  This needs one decision in the standard (the detail key is the carried name
  as written, or always camelCase) before those components switch.
- **rule.js `css` is not derivable from the folder** for 9 components:
  dropdown, quantity, switch, textarea say `css: true` with no sheet in the
  folder; tabs and toggle hold a sheet and say nothing; ui-pro data-view says
  `css: false`. component.json `styles` (or an explicit flag) must say it;
  the bridge carries it as `x-rule.css`.
- **Two probe.json shapes**: stand 15's `{component, probe, format, page,
  probes}` (62) and the 1.3.8 field probes' `{probe, page, format, checks}`
  (checkbox, code-input, input, quantity, radio, textarea, toggle). The bridge
  carries the second whole; examples.json `pages` should take one shape.
- **Trait inputs**: six fields (field-inherit@1) take inherited-value,
  inherited-text and reset-label from src/smart/helpers/inherited-value.js;
  no contract declares them. The registry is right; a trait contract the
  generator expands is their home.
- **Two rule-level comments** (before or after the rule) are kept as
  `x-rule.$comment` / `$comment-after`; stand 26 dropped them.

## Phase A order (recommendation)

Before any wave: (1) gate 1's closed list gains `relations` and `aliases`;
(2) the carried-field spelling decision above; (3) the meta.mjs readers among
the tests are rewritten to read component.json (manifest-defaults,
alpha-ramp-and-appearances, tag-density, textarea-owner, studio-artifacts-agree);
(4) the three Git readers named by stand 26 (linkage.mjs, ui-builder bind,
ui-studio pin) keep working because phase A commits the generated files.

1. **Leaves without meta.mjs and without conflicts** (manifest a1 ≤ 5, the
   phase A diff is a short list of fixes): close, help-mark, reference-link,
   avatar, avatars, slider, breadcrumbs, empty-state, download-file, color,
   switch, page-header, menu, inline-editor, sortable, copy-button,
   code-input, radio, checkbox.
2. **The same with more stale facts**, each diff read as fixes: accordion,
   resizer, tabs, icon, gallery, steps, profile-picker, range-slider,
   theme-generator, datepicker, tree (its six 2.0 events and three actions
   reach the registry).
3. **meta.mjs families, no conflicts** (meta.mjs and its tests change
   together): skeleton, tooltip, alert, progress-bar, progress-scale, toggle,
   badge, button, icon-button, button-group (decide `items`), input,
   textarea, dropdown, list-item.
4. **Small conflicts, the code decides each** (listed above with lines):
   file-preview, country-code, tag (`type`), pagination, image-field, drawer,
   context-menu, toast, tree-item, spinner (four deprecated size inputs with
   no alias rows), popover.
5. **Large ones**: modal (16 stale, unclose/hide, open/close arguments),
   quantity (value, payload fields), file-upload, composition-overlay (12
   field-name conflicts).
6. **ui-pro** after the spelling decision: chat-interlocutor, change-confirm,
   chat-composer; then message-log, chat-message, thread-list; then table
   (12 conflicts; its 23 legacy methods need method alias rows or retirement),
   property-view, data-view (7 table events it listens to are declared as its
   own), admin-menu, chat-window last.
