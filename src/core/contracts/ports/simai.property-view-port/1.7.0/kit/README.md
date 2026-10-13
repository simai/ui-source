# Conformance kit: simai.property-view-port 1.7.0

Twenty-four cases a host runs to show it speaks this port. Transport-neutral: the kit
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
