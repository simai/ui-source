# Accordion contract

## Component brief

`Accordion` is a presentation and local-interaction component for revealing
sections of related content. It does not load data, persist state, route the
user, or own application effects. Those are Smart or application concerns.

The authoritative implementation is
`src/component/accordion/`. The default mode lets sections open and close
independently. A composition root `.sf-accordion-group` may opt into
`data-mode="single"` when opening one section must close another. Accordion
items are direct children of that group, so nested groups keep their own mode
and state. The former `data-sf-accordion-mode="single"` form remains a
deprecated read-only compatibility alias and is not used in new examples.

The default surface uses a neutral fill for a self-contained card. Add
`.sf-accordion--outline` when the surrounding layout already provides the
surface and the Accordion needs only a persistent semantic outline. This is a
visual variant; behavior and accessible structure remain identical.
Use `.sf-accordion--flush` for a dense list or menu inside a surface already
owned by its parent. It removes the card fill and radius while retaining a
constant semantic boundary between adjacent rows.

## Scenarios

| Scenario             | Initial state                              | Action                             | Result                                                                    |
| -------------------- | ------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------- |
| Independent sections | any combination                            | activate one heading               | only that section changes                                                 |
| Single-open group    | zero or one open                           | open another heading               | the previous section closes                                               |
| Keyboard             | trigger focused                            | Enter or Space                     | associated panel toggles                                                  |
| Content interaction  | panel open                                 | use a link or control in the panel | panel remains open                                                        |
| Dynamic insertion    | component added after boot                 | Loader observes it                 | the same contract is initialized once                                     |
| Filled surface       | standalone section or settings card        | render the default component       | the neutral fill provides containment                                     |
| Outline surface      | component sits on an existing page surface | add `.sf-accordion--outline`       | the component stays transparent with a persistent outline                 |
| Flush surface        | component is a row in a dense list or menu | add `.sf-accordion--flush`         | the component stays transparent and square with a persistent row boundary |

## Target contract

- The heading contains a native `.sf-accordion-trigger` button.
- The button owns `aria-expanded` and `aria-controls`.
- The associated `.sf-accordion-content` has a stable ID.
- A behavioral group uses `.sf-accordion-group`; `data-mode="single"` is the
  only non-default mode. Without `data-mode`, or with `data-mode="multiple"`,
  items remain independent.
- The default state indicator is one `chevron_right` glyph rotating from right
  to down. Add `.sf-accordion--plus-minus` to the accordion root to show `add`
  while closed and `remove` while open. This visual modifier does not change
  grouping or behavior.
- Prefer the chevron for navigation, hierarchy, menus and sequential
  disclosure. Use plus/minus for FAQ-like or optional-detail disclosure where
  the primary meaning is show more / show less.
- Only the trigger toggles the panel; panel content is not a button.
- The default surface and interaction states use neutral semantic tokens.
- The `outline` variant changes only the root surface: it uses a transparent
  background and a persistent `outline-variant` border. Trigger hover/active,
  the expanded divider, spacing and behavior remain shared with the default.
- The `flush` variant changes only the root surface: it uses the square radius,
  transparent background and persistent block-end boundary. Trigger behavior,
  internal spacing and state geometry remain shared with the default.
- An expanded trigger keeps a persistent semantic divider between the clickable
  heading and its panel. The divider does not participate in layout, so hover,
  focus and expansion never shift the component.
- Panel content uses the same Framework inset on every side. Hover and focus
  may change the trigger background, but never its perceived ownership of the
  panel or the spacing around panel content.
- The trigger title and panel content use the normal body text size. The title
  is distinguished by medium weight; panel content uses regular weight and the
  secondary on-surface color. Semantic heading rank does not force a larger
  visual size inside this compact control.
- One `chevron_right` indicator represents the current disclosure state: it
  points to inline-end when collapsed and rotates to block-end when expanded.
  RTL mirrors only the collapsed direction; `aria-expanded` remains the source
  of truth and the icon stays hidden from assistive technology.
- The trigger keeps DOM focus after every supported interaction, but its visual
  indicator appears through `:focus-visible`, following the browser input-mode
  heuristic rather than every pointer click.
- Because the trigger is joined to its panel and the Accordion clips its
  surface, focus uses the shared inset `--sf-ui-focus-inset` treatment. It
  encloses the complete trigger without highlighting the non-interactive panel
  or changing component geometry.
- Theme, RTL, increased text size, and reduced motion do not require a variant.
- Styling is adapted through semantic tokens and Framework utilities, not a
  second component skin.

## Token map

| Role                           | Component token                          | Framework source                       |
| ------------------------------ | ---------------------------------------- | -------------------------------------- |
| large surface radius           | `--sf-accordion--radius`                 | `--sf-radius-default`                  |
| outline and row boundary width | `--sf-accordion--border-width`           | `--sf-px`                              |
| outline and row boundary color | `--sf-accordion--border-color`           | `--sf-outline-variant`                 |
| trigger block inset            | `--sf-accordion--trigger-padding-block`  | `--sf-space-2`                         |
| trigger inline inset           | `--sf-accordion--trigger-padding-inline` | `--sf-space-3`                         |
| panel inset                    | `--sf-accordion--content-padding`        | `--sf-space-3`                         |
| joined trigger focus           | inherited directly                       | `--sf-ui-focus-inset`                  |
| state motion                   | inherited directly                       | `--sf-duration-fast`, `--sf-animation` |

No first-party Accordion style introduces raw length, duration or color
literals. Rotation angles express the disclosure direction for which Framework
does not currently expose a higher-level role token.

## Surface geometry

| Variant | Radius                | Fill                       | Persistent outer boundary |
| ------- | --------------------- | -------------------------- | ------------------------- |
| default | `--sf-radius-default` | semantic surface container | none                      |
| outline | `--sf-radius-default` | transparent                | complete semantic outline |
| flush   | `--sf-radius-square`  | transparent                | block-end row separator   |

The trigger and panel keep the same semantic inset in every variant. Borders
are always reserved within their variant and do not appear only on hover.

## Component structure

- Block: `.sf-accordion`.
- Elements: `.sf-accordion-heading`, `.sf-accordion-trigger`,
  `.sf-accordion-title`, `.sf-accordion-content`.
- Root modifiers: `.sf-accordion--outline`, `.sf-accordion--flush` and the
  compatibility-only `.sf-accordion--legacy`.
- Group behavior belongs to the parent composition root
  `.sf-accordion-group` through the short local property
  `data-mode="single"`; the group class adds no visual skin.
- Panel links and controls remain their own Blocks and never turn the panel
  into one large interactive control.

## Gap decision

| Current behavior                                       | Decision  | Resolution                                                                                     |
| ------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------- |
| independent sections                                   | keep      | remains the default                                                                            |
| entire panel has `role=button`                         | fix       | use a native trigger                                                                           |
| content click collapses the panel                      | fix       | listen on the trigger only                                                                     |
| missing trigger/panel relationship                     | fix       | synchronize IDs and `aria-controls`                                                            |
| primary hover with mismatched content color            | fix       | neutral trigger states                                                                         |
| heading/panel boundary appears only on hover           | fix       | persistent divider on the expanded trigger                                                     |
| asymmetric panel inset                                 | fix       | use the same semantic spacing token on every side                                              |
| title repeats hierarchy through size, weight and color | fix       | inherit the semantic body typography and distinguish the title by weight                       |
| filled surface does not suit every surrounding surface | add       | provide one token-based `outline` modifier without duplicating behavior                        |
| dense lists need no card fill or radius                | add       | provide one token-based `flush` modifier with a persistent row boundary                        |
| no single-open scenario                                | add       | opt-in group mode                                                                              |
| long `data-sf-accordion-mode` authoring name           | deprecate | use `.sf-accordion-group` with `data-mode`; retain the old selector as a compatibility alias   |
| alternate plus/minus indicator                         | add       | use `.sf-accordion--plus-minus`; preserve the same trigger, ARIA, panel and grouping contracts |
| outer focus shadow is clipped into a boundary stripe   | fix       | use the shared inset focus ring on the trigger and keep pointer focus visually neutral         |
| old `.sf-accordion-wrap` markup                        | keep      | compatibility path, not the recommended example                                                |

No Smart Component is required: the scenarios are fully covered by a base
Component. Data loading or externally controlled state can be composed later
without duplicating its visual implementation.
