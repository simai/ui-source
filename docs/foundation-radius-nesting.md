# Corners of nested blocks

How a block inside a rounded block picks its corner. Asked by the ui-chat kit
(simai/ui-source#31); the step-down rule below is the Framework's answer, and
there are no extra nesting variables to set.

## The two ladders

A corner comes from the radius ladder (`--sf-radius-*`,
`src/core/figma_variables/figma_radius.scss`) and an inset from the space ladder
(`--sf-space-*`). The steps the rule uses, in pixels at a 16px root:

| Step | radius, mobile | padding, mobile | radius, desktop (60rem) | padding, desktop |
| --- | --- | --- | --- | --- |
| 1/2 | 4 | 8 | 4 | 12 |
| 1 | 8 | 12 | 8 | 16 |
| 2 | 12 | 16 | 16 | 20 |
| 3 | 16 | 16 | 24 | 24 |
| 4 | 24 | 24 | 32 | 32 |

The ladders are tuned together: at every step the corner is no wider than the
padding of the same step, so `p-N radius-N` is one decision, not two.

## The rule: one step down per level

1. A container takes its padding and its corner from the same step:
   `p-N radius-N` (or `--sf-space-N` and `--sf-radius-N` in its own rule).
2. A block inside it takes the next step down: `p-(N-1) radius-(N-1)`, and so
   on for each level.
3. Below step 1/2 a block is a control. Controls take their corner from the
   role, `--sf-radius--ui`, not from the ladder; large surfaces that stand on
   the page take `--sf-radius--surface`.

```html
<section class="p-4 radius-4">        <!-- the panel -->
  <div class="p-3 radius-3">           <!-- a card in it -->
    <div class="p-2 radius-2">         <!-- a box in the card -->
      <button class="sf-button">…</button>  <!-- a control: --sf-radius--ui -->
    </div>
  </div>
</section>
```

A component that offers a corner variable (`--sf-card-radius`,
`--sf-highlight-radius`, …) is placed the same way: set it to the step below
its container's, for example a code block in a chat bubble that is
`radius-3` takes `--sf-highlight-radius: var(--sf-radius-2)`.

Why steps and not `container radius - inset`: a formula needs the container's
values where the inner block is drawn, and a custom property resolves where it
is declared, so every consumer would write the chain again; with the ladders as
they are, `radius - inset` is zero or less at every step, so the formula gives
the control corner for every inner block. The step keeps the inner corner
visibly related to the outer one and stays on the ladder (C18).

## The check

`tests/nesting-ladders.contract.test.mjs` holds the rule against the ladders,
on mobile and desktop: every step the rule pairs has a `radius-N` class, the
corner of a step is never wider than its padding, and an inner corner is never
larger than the outer one -- so the case ui-chat asked a lint for (an inner
corner larger than the outer while the inset is smaller than the inner corner)
cannot arise from the ladder. A change to either ladder that breaks it fails
the test.
