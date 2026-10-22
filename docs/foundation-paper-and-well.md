# Paper and well

Two theme roles for showing a document inside the interface -- an email, a
page, a print layout -- requested by the ui-mail kit (simai/ui-source#24).
Both are declared in `src/core/scss/_sf_css__theme.scss` with the other roles.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `--sf-paper` | white | white | the sheet the document is drawn on |
| `--sf-on-paper` | neutral-10 | neutral-10 | text on the paper that is not the document's own |
| `--sf-surface-well` | neutral-95 | neutral-5 | the recessed area around a canvas or a paper |

**Paper does not flip.** A document carries its own colours, written for white,
so its sheet stays white and its ink stays dark in the dark theme too
(`--sf-on-paper` on `--sf-paper`: 17.2:1 in both). The paper is not a surface
of the interface: controls do not sit on it, and the interface's own text
keeps `--sf-on-surface`.

**The well is recessed.** In the light theme it is a step under `surface-1`,
and the white paper stands on it by its shadow (`--sf-elevation-1--shadow`;
paper on well 1.13:1). In the dark theme, where height lightens a surface, it
is the darkest step and the paper stands off it by itself (18.9:1). Text on
the well takes the ordinary roles: `--sf-on-surface` (15.2:1 light, 14.7:1
dark) and `--sf-on-surface-variant` (5.71:1, 5.95:1) -- for a width caption,
say.

```html
<div style="background: var(--sf-surface-well); padding: var(--sf-space-3)">
  <iframe style="background: var(--sf-paper); box-shadow: var(--sf-elevation-1--shadow)"></iframe>
</div>
```

The device frame that shows a document at a width and fits its height stays
in the kit that needs it until a second one does. Probe:
`tests/browser/theme-paper-well.browser.mjs`.
