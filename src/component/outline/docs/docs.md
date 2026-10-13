# Outline

Outline is semantic navigation through the headings of the current document.
Use it for long pages where readers need to see the structure and move directly
to a section.

## Markup

Use a named `nav`, native lists and fragment links. Mark exactly one current
fragment with `aria-current="location"` when the page tracks reading position.
The host application owns that synchronization; Outline is CSS-only.

```html
<nav class="sf-outline" aria-label="On this page">
  <ul class="sf-outline__list">
    <li><a class="sf-outline__link" href="#overview" aria-current="location">Overview</a></li>
    <li><a class="sf-outline__link" href="#usage">Usage</a></li>
  </ul>
</nav>
```

## Hierarchy

Nest another `.sf-outline__list` inside its owning list item when the document
contains a real subordinate heading. Do not skip heading levels only to obtain
more visual indentation.

## Current and focus states

The active marker reserves space in every row, so changing current state does
not move labels. Native links retain source-order keyboard navigation. The
focus treatment appears through `:focus-visible` and remains inside scrollable
or clipped hosts.

`[data-sf-outline-active]` remains a compatibility selector. New markup should
prefer the native `aria-current="location"` state.

## Adaptation

Place the component on a Framework surface and use layout utilities on its host.
Component custom properties expose gap, indentation, row padding and semantic
state colors without replacing its structural contract.
