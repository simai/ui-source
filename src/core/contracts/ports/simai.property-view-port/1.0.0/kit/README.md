# Conformance kit: simai.property-view-port 1.0.0

Eight cases a host runs to show it speaks this port. Transport-neutral: the kit
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

The one thing the kit cannot check for you, and the one worth saying anyway: the
host supplies a field's **property type**, never the component to draw it with.
The Framework owns the mapping from a type to a template. A host that sends a
component name has moved a decision across the seam, and the next consumer will
have a different name for the same field.
