# Accordion

`.sf-accordion` is a disclosure section: a heading with a native button that
shows and hides the section's content. Each section opens independently; an
`.sf-accordion-group` with `data-mode="single"` keeps one section open at a
time.

```html
<article class="sf-accordion">
  <h3 class="sf-accordion-heading">
    <button class="sf-accordion-trigger" type="button" aria-expanded="true">
      <span class="sf-accordion-title">Section</span>
      <i class="sf-icon" aria-hidden="true">chevron_right</i>
    </button>
  </h3>
  <div class="sf-accordion-content" role="region">Content</div>
</article>
```

The runtime links the trigger and the content (`aria-controls`, and
`aria-labelledby` on a `role="region"` content), keeps `aria-expanded`, the
content's `hidden` and the root's `active` class in step, and draws the
chevron; `sf-accordion--plus-minus` draws `add` / `remove` instead. A section
that starts closed carries `hidden` (or the `hidden` class) on its content.

## A single section

One section needs no disclosure (simai/ui-source#19, #29). The only
`.sf-accordion` of an `.sf-accordion-group`, or a section marked
`sf-accordion--single`, renders as a plain section: its content is always
shown, and its heading is a heading, not a toggle -- the runtime puts a plain
element (`span.sf-accordion-trigger[data-sf-accordion-static]`, with the
same id and title) in the button's place and marks the root
`sf-accordion--static`. There is no chevron, no hover and nothing in the tab
order; the line under the heading stays, as under an open section. When a
second section joins the group the button comes back, open (the content
the reader sees does not vanish);
when sections leave and one remains, it becomes plain. A group that keeps its
one section a toggle -- a list that fills in later -- says
`data-single-section="toggle"`. The legacy markup keeps its toggle.

```html
<div class="sf-accordion-group">
  <article class="sf-accordion sf-accordion--flush sf-accordion--size-1/2">
    <h3 class="sf-accordion-heading">
      <button class="sf-accordion-trigger" type="button" aria-expanded="true">
        <span class="sf-accordion-title">Содержимое</span>
        <i class="sf-icon" aria-hidden="true">chevron_right</i>
      </button>
    </h3>
    <div class="sf-accordion-content" role="region">Поля блока</div>
  </article>
</div>
```

## Appearance

- default: a filled surface (`--sf-surface-container`) with the surface radius;
- `sf-accordion--outline`: a hairline border, no fill;
- `sf-accordion--flush`: no fill and no radius, sections divided by a line --
  for panels and lists of sections.

## Size

Without a size class the accordion has a roomy header for content pages. In
dense interfaces put it on the control ladder with `sf-accordion--size-1/3`,
`sf-accordion--size-1/2`, `sf-accordion--size-1`, `sf-accordion--size-2` or
`sf-accordion--size-3` (on each `.sf-accordion`):

- the header is exactly the control height of the size
  (`--sf-ui-N--control-height`), the height of an `sf-input` or an `sf-button`
  of the same size, and grows only when a long title wraps;
- the title takes the size's text and line height, the chevron is a line tall;
- the header's inline padding is the size's `--sf-ui-N--space-x`, and the
  content takes the same, so the content starts under the title.

A size is not inherited: a nested accordion without a size class keeps the
default look.

```html
<article class="sf-accordion sf-accordion--flush sf-accordion--size-1/2">…</article>
```

## Variables

The public variables (`src/core/contracts/public-variables.v1.json`), set on
the accordion or any ancestor: `--sf-accordion-background-color`,
`--sf-accordion-border-color`, `--sf-accordion-border-width`,
`--sf-accordion-radius`, `--sf-accordion-title-color`,
`--sf-accordion-content-color`, `--sf-accordion-icon-color` and
`--sf-accordion-divider-color`. Each falls back to the value the accordion
drew before it; hover, pressed and focus keep their own.

Also set on the accordion: `--sf-accordion--trigger-padding-block`,
`--sf-accordion--trigger-padding-inline`, `--sf-accordion--content-padding`,
`--sf-accordion--border-color`; `--sf-accordion-title--color`,
`--sf-accordion-content--color` and `--sf-accordion-divider--color` change the
title, content and divider colours. A size class sets the paddings, so set
them after it (or on a more specific selector) to override a size.

## Legacy markup

The released markup without a trigger -- the accordion itself is the control,
with `.sf-accordion-title`, `.sf-icon` and `.sf-accordion-content` inside it --
still works (`sf-accordion--legacy` is added at runtime, with `role="button"`,
`tabindex="0"`, Enter and Space). New markup uses the trigger.
