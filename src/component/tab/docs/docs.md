# Tab

Legacy low-level adapter for projects that render two visual representations
inside each tab item. New interfaces should use the `Tabs` component.

## Public contract

- Root: `.sf-tab`.
- List: direct `nav > ul`; items and direct `.sf-tab-content > section` are
  paired by index.
- Optional initial item: `data-active="<index>"` or constructor option
  `{start}`. The concise data attribute is canonical.
- Each list item is the single tab and focus owner. Its
  `.sf-tab-inactive`/`.sf-tab-active` children are presentation only and must
  not contain independent actions.
- `.active`, `aria-selected`, `tabindex`, `hidden`, `aria-controls` and
  `aria-labelledby` are synchronized by the runtime.
- Arrow Left/Right, Home/End, Enter and Space are supported; disabled items use
  `.disabled` or `aria-disabled="true"`.
- Selection emits `sf:tab-change` with `{index, tab, panel}`.

The component intentionally owns no skin. Projects compose its presentation
from Framework utilities. Keyboard focus uses Framework focus tokens.
