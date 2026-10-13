# Composite Smart Component terminology

The canonical English term is **Composite Smart Component**; the Russian term
is **составной смарт-компонент**. A composite Smart component combines child
components and coordinates their settings, events and state. Children may also
be composite. Merely placing several components next to each other does not
make them composite. The normal Smart component connection mechanism applies.

Existing manifests keep `kind: composite`. No API, schema, identifier or runtime
change is introduced. “Complex” and “комплексный/сложный” are historical names,
not separate categories. Block terminology is outside this decision.

Public explanation: https://ui-doc.test/ru/guide/smart-components/nesting/
Framework owner decision: ui-control/control/PLATFORM-DNA.md.
Historical handoffs retain their original wording.
