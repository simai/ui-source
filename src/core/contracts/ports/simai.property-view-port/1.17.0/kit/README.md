# Conformance kit — property view host port 1.17.0

The 62 case files of kit 1.16.0, unchanged, and one more for what 1.17.0
adds: the property type `html`, formatted text (Larena, 2026-10-30). The notes
below are the kit's history.

| case | what it holds the host to |
|:---|:---|
| `an-html-field-is-saved-as-the-cleaned-string` | an html field arrives as a string of the sf-rich-text subset and is saved as the string the editor cleaned |

The subset is sf-rich-text's: `p`, `h2`, `h3`, `h4`, `strong`, `em`, `a` with
an `href` that is https:, mailto:, tel: or a path on the site, `ul`, `ol`,
`li`, `blockquote` and `br`, and no other attribute. The field is edited with
sf-rich-text, so a save carries what that editor cleaned; a value the host
sends is cleaned by the same rule before it is drawn, in a record and in a
table cell (as its text), so a script, a style, an `on*` attribute or a
`javascript:` link in a stored value is never shown. The host keeps its own
cleaning of what it stores: the panel is not the only writer.

`html` is a type, not a variant of `text`: a renderer that does not know it
draws nothing for it rather than the markup as text, and a host that declares
no html field is a 1.16.0 host.

# Conformance kit — property view host port 1.16.0

The 57 case files of kit 1.15.0, unchanged, and five more for what 1.16.0
adds: a string typed through a mask and a choice drawn as buttons (consumer
simai.main, agreed contract q-b0de123841). The notes below are the kit's
history.

| case | what it holds the host to |
|:---|:---|
| `a-masked-field-arrives-with-its-mask` | a string field carries its mask in the Framework grammar and its value as shown; a field without one is the plain string it was |
| `a-masked-value-is-saved-as-shown` | a completed masked value is saved with its fixed parts, and the host stores what it receives |
| `an-incomplete-masked-value-is-never-sent` | no save is raised while a masked field is incomplete; each masked field is complete or not on its own |
| `a-cleared-masked-field-sends-null-or-empty` | a cleared masked field sends null, or "" when it declares `nullable: false`; required stays a mark |
| `a-choice-as-buttons-saves-the-option-value` | a choice as buttons saves the option's value in its own type, or null when the chosen button is pressed again on a field that is not required |

The mask grammar is the Framework's, the one sf-input reads as `mask-pattern`:
`0` a digit, `a` a letter, `*` any character, `\` escapes the next character,
and every other character is a fixed part shown in the field. A host does not
translate its own masks into another grammar, and the value is never stripped
of its fixed parts: a stored value read back through a mask changed later would
otherwise mean something else.

Completeness is the panel's to hold, not the host's to repair. A value that
does not fill every place of its mask is not sent by `group.save` nor by
`record.save`; it is said under the field, and what was typed is kept. Empty is
not incomplete: an optional masked field may be cleared.

`buttons` is a variant of `choice`, not a type. Its value is the same value a
dropdown writes, so a host that does not know the variant reads and writes it
unchanged, and a renderer that does not know it draws the dropdown.

# Conformance kit — property view host port 1.15.0

The 51 case files of kit 1.14.0, unchanged, and six more for what 1.15.0
adds: reading one group of a record (standard simai.smart-component 1.3.8
§4.9, items 25 and 35). The notes below are the kit's history.

| case | what it holds the host to |
|:---|:---|
| `group-load-applied-carries-the-group-and-the-revision` | a group read carries the record's head and revision, the arrangement with every group's field count, and the fields of the group asked for |
| `group-load-revision-is-the-records` | two group reads with no save between them answer the same revision, the record's, the one record.load answers |
| `group-load-without-a-group-answers-the-first` | group null answers the group the panel opens on and names it |
| `group-load-unknown-group-is-refused` | a group the record does not hold is refused with a reason, never drawn as an empty group |
| `group-load-without-the-capability` | a host without `group-load` is never asked; the adapter reads the record once per revision and serves every group from it |
| `group-save-after-group-load-stale-is-a-conflict` | a group save against an older revision is a conflict carrying the current one, even when another group moved it |

A group has no revision of its own. That is the point of the version, and
Larena's answer (msg-f6019c76): a host that kept one per group would let a
save of one group pass against a record another save had already changed,
and a panel that held one per group could not say which one a save means.
`group.save` sends the revision a group read answered, and the host compares
it with the record's; the conflict answer carries the current revision, as
vocabulary 1.1.1 §3.1 asks of every conflict.

`group-load` is a capability, not a requirement. A host that does not
announce it keeps working unchanged: the adapter asks `record.load` once per
revision and hands each section its group from that one answer.

# Conformance kit — property view host port 1.14.0

The 42 case files of kit 1.13.0, unchanged, and nine more for what 1.14.0
adds. The notes below are the kit's history.

| case | what it holds the host to |
|:---|:---|
| `lookup-arrives-with-its-label` | a lookup's value is {value, label}, a list of them when multiple, and the field names its source |
| `options-carry-the-source-and-a-limit` | candidates are asked for by source, at most limit at a time; next_cursor, not the length, says which page is last |
| `options-search-by-source-reaches-the-host` | the search runs over the whole reference list, on the host, case-insensitively |
| `group-save-may-ask-for-a-confirmation` | a save confirmed first is refused with confirm_required and a summary and a digest, and writes nothing |
| `group-save-confirmed-with-the-digest-is-applied` | the same save with confirm set to the digest is applied |
| `a-stale-confirmation-is-asked-again` | a digest that no longer matches is asked again, never applied |
| `save-may-ask-for-a-confirmation` | a whole-object save confirms the same way |
| `conditions-arrive-declared` | `when` carries the conditions a field is shown, required and enabled under |
| `a-field-hidden-by-its-condition-is-not-saved` | a hidden field is not in values, and the host does not clear it |

The confirmation is the data view port's (1.8.0), not a fifth answer: the
composite host port standard names four answers a host may give, and a
confirmation is a refusal that says what would make it an application.

# Conformance kit — property view host port 1.13.0

The 42 case files of kit 1.12.0, unchanged. 1.13.0 adds no intent: it
states that the view a person chooses is theirs, kept by the host per
collection, and that record.load and record.open answer through it.

# Conformance kit — property view host port 1.11.0

The 36 case files of kit 1.10.0 have their exact bytes here. 1.11.0
describes the answer in port.json and adds no case. The notes below are the
kit's history.

# Conformance kit: simai.property-view-port 1.9.0

Twenty-five cases a host runs to show it speaks this port. Transport-neutral: the kit
describes intents, payloads and answers, not HTTP, not a framework.

This version reads and saves. It was going to read only, and the Framework's own
port contract would not have it: the contract requires a kit to exercise all four
answers a host can owe, and `conflict` has no honest meaning on a read. So a
read-only first version of a port does not exist here — which is the right rule,
because a port published with half an answer vocabulary teaches a host a dialect
it will have to unlearn.

What the five cases are really about, in one line each:

| case | what it holds the host to |
|:---|:---|
| `load-applied-carries-the-object` | the arrangement is the host's: sections, groups and fields, never a flat list of values |
| `load-refused-is-explained` | a refusal is said out loud, because on screen it is indistinguishable from an object with no fields |
| `load-unavailable-is-honest` | «cannot answer now» is never dressed as «applied, and empty» |
| `load-late-answer-is-dropped` | two reads in flight cannot leave the earlier object on screen |
| `rare-fields-arrive-declared` | the host marks rare fields and always sends them; hiding them is a view decision and writes nothing |
| `group-save-applied-is-one-revision` | one press, one intent, one revision, and only the fields the person changed |
| `group-save-stale-revision-is-a-conflict` | a moved revision is a conflict, never somebody else's save quietly lost |
| `group-save-field-errors-are-refused` | errors come back keyed by field, so each sits under the field it belongs to |
| `options-page-carries-a-cursor` | candidates arrive a page at a time, never as the whole set |
| `options-search-reaches-the-host` | a search is answered by the host, not by filtering the page already held |
| `options-without-the-capability` | a host that cannot serve candidates is never asked, and the field shows its value |
| `options-refused-is-explained` | a refusal is said, because an empty list and a refusal look the same |
| `the-address-is-the-hosts` | the window's address is the host's; without one there is nothing to copy or open |
| `upload-answers-with-the-stored-file` | the host stores the file and answers in the shape the field reads |
| `upload-refused-is-explained` | a file the host will not take is refused with a reason the field shows |
| `removing-a-file-is-a-save` | removing a file is a value change, so nothing is deleted before the save |
| `opening-a-reference-is-the-hosts-decision` | the component asks what to open; it follows no link and opens no window |

The one thing the kit cannot check for you, and the one worth saying anyway: the
host supplies a field's **property type**, never the component to draw it with.
The Framework owns the mapping from a type to a template. A host that sends a
component name has moved a decision across the seam, and the next consumer will
have a different name for the same field.


## What 1.1.0 adds, and what it does not require

One capability, `field-options`, and one intent, `field.options`. **A host still
speaking 1.0.0 keeps working**: the component accepts both versions, and a
reference field whose candidates nobody can serve shows its current value
read-only. That is not a degraded state to apologise for -- it is strictly better
than an empty control over a value that exists, which is what the first version
did and what a consumer read as the value having been lost.

The cursor is opaque to the component. It is sent back exactly as it arrived, and
the component never constructs one, so a host is free to page by offset, by key,
by token or by anything else it likes.

A search resets the paging: the cursor goes back to null. The page is not the
whole set, so filtering it in the component would hide every match that is not on
the page already loaded -- which is the normal case as soon as a collection is
larger than a page.
