# Touch screens

Part of the SIMAI Framework foundations standard (index:
[foundation-standard.md](foundation-standard.md)). The rules come from study
S-A «Mobile adaptivity and gestures» (ui-control
`control/evidence/2026-11-24-study-s-a-mobile`, prototype
`prototypes/mobile-adaptivity-study.html`), decided as recommended under the
owner's autonomy setting (owner question q-7097831f9f, 2026-11-24): q1 device
scope, q2 phone columns, q3 record sections, q4 long press, q5 this page.
`tests/device-scope-s-a.contract.test.mjs` holds the numbers below against
core and the sf-settings contract.

## Rules

1. **Two words, never one for the other** (S-A q1). *Layout* is the width of
   a component's place: `phone` below 600 px of its nearest size container
   (else the page), `desktop` from 600. *Pointer* is the input: `coarse` when
   the page has a touch pointer and no fine one, else `fine`. Layout decides
   what a component shows; pointer decides gestures and what replaces hover.
   A tablet with a keyboard is a coarse pointer in a desktop layout; a narrow
   desktop window a fine pointer in a phone layout. Core holds both words
   (`SF.device`, `core/js/device.js`); a component does not measure them in a
   copy of its own.
2. **Device scope of items** (S-A q1). Any item -- a setting, a menu item, a
   tab, a column -- may carry `devices: ["phone"]` or `devices: ["desktop"]`.
   In the other layout it is hidden, not disabled; its value is kept. Disabled
   with a reason is for an item that works there but is unavailable now. A
   component marks its own items it knows are layout-bound
   (`SF.device.markDevices`); the author's mark wins.
3. **Phone columns are one list** (S-A q2). A column list decides the desktop
   and the phone in one place: the check box for the desktop, a «На телефоне»
   switch per column, one shared order (sf-settings `fields` with
   `phoneSwitch`). No device tabs.
4. **A gesture is a shortcut** (S-A q5). Every gesture has a visible control
   that does the same with one tap: a section swipe -- its tab; a sheet swipe
   -- × and the handle button; a long press -- «Выбрать» and «⋯»; a drag --
   «Переместить в…»; a pinch -- + and −. (WCAG 2.2 2.5.1, 2.5.7; Apple HIG.)
5. **The set of gestures** (S-A q5). Tap; long press of 500 ms (the tooltip's
   long press); a horizontal swipe only between pages of one level (record
   sections, board lanes, a gallery); a swipe down on a sheet's handle row or
   head closes it, a swipe toward its edge closes a full-screen side panel
   (C157). No row swipe in lists (C148 (6)); no edge swipes (the system's
   back); pinch only in images and maps.
6. **Long press** (S-A q4). On a surface with multiple selection it enters
   selection mode and chooses the item; in the mode a tap toggles, check
   boxes show on every item, sf-bulk-actions shows the count and actions, ×
   and Escape leave; a visible «Выбрать» enters the mode without a gesture.
   On a surface without selection it opens the item's «⋯» menu. The
   browser's own long-press menu is suppressed on the item; text fields keep
   theirs. Core holds the press (`SF.longPress`, `core/js/long-press.js`).
7. **No hover on touch** (S-A q5). What shows on hover (a check box, a
   handle, «⋯») is visible on a coarse pointer, or appears in selection mode.
   No slot is kept for an invisible control (no empty gap).
8. **Conflicts** (S-A q5). A swipe never starts on a control, a field or a
   slider, nor in a box that scrolls along the swipe's axis; that box keeps
   its scroll and does not hand it to the page at its edge
   (`overscroll-behavior: contain`). Swipeable content does not hold another
   swipe of the same axis. A vertical page scroll wins over a horizontal
   swipe until the motion is clearly horizontal (the slop of
   `core/js/sheet-swipe.js`).
9. **Targets** (S-A q5). On a coarse pointer every target has a hit area of
   at least 44 x 44 (`--sf-d1`; Apple 44 pt, Material 48 dp, WCAG 2.5.8
   minimum 24 with spacing). The drawn size stays on the size ladder; the hit
   area grows.
10. **Motion** (S-A q5). With `prefers-reduced-motion: reduce` page moves and
    sheet settles jump without animation; gestures work the same.
11. **Feedback** (S-A q5). A long press that entered a mode says so (a live
    region «Выбрано N»); a short vibration where the platform allows is
    optional.
12. **Target size on a coarse pointer** (DEV decision on the coarse-pointer
    target size, group build 19; C428). The pointer word of rule 1 is the
    signal: a tablet and a laptop of the same width differ by design.
    - *Stacked rows* -- sf-settings panel rows, menu rows, list rows, tabs of
      every size and look -- grow to the touch target, `--sf-hit--touch` (44),
      at any size. Rows stand with no gap: a 44 area on a 28 row would lie
      16 px over the next row, and the neighbour would take the press
      (Material and Apple drop compact density on touch for the same reason).
      The text, the pads and the line under a tab stay the size's.
    - *Isolated controls* -- a check box, a radio or a switch without text,
      an icon button -- keep their drawn size; the hit area reaches 44 in each
      axis the control is smaller in by an invisible pseudo-element centred on
      it. The area lies under the neighbours: it stands at z-index -1 in the
      stacking context of the control's parent, which core makes one on a
      coarse pointer, so every neighbour's own box and text keep their own
      presses and the area takes only the empty room around the control.
    - Two isolated controls whose centres stand closer than 44 (their areas
      meet) are the rule check's failure: the gap is wrong, not the area. A
      toolbar of size 1/2 icon buttons with no gap is the example the probe
      keeps.
    - Not an area of its own: a control with text (its row is the target,
      W5), a tab's or a settings row's buttons (the row grows), the remove
      button of a tag (its own 24 area, C145 (1)), the drawer head's buttons
      (their own 44 area, C173 (6)).
    - Core holds the rule (`core/scss/mix/_mix__touch.scss`: `coarse`, `row`,
      `row-height`, `hit-area`; `core/scss/_sf_css__touch_targets.scss`: the
      parent's stacking context); the sheets include it. A fine pointer's
      geometry is unchanged.
    - Option 3 of the question (a smaller target accepted as an exception) is
      rejected: this rule is the standard.

## Numbers

`normal` is a desktop page (1440 px), `compact` a `data-sf-density="compact"`
region on it, `phone` a 390 px page. Two of the three are script words, not
custom properties: they are named by their `SF.*` path and the file that
holds them.

| Rule | Token | On | normal | compact | phone |
| --- | --- | --- | --- | --- | --- |
| S-A q1 | `SF.device.PHONE_BELOW` | core/js/device.js | 600 | 600 | 600 |
| S-A q4 | `SF.longPress.ms` | core/js/long-press.js | 500 | 500 | 500 |
| S-A q5 | `--sf-d1` | the hit area on a coarse pointer | 44 | 44 | 44 |
| 12 (C428) | `--sf-hit--touch` | a stacked row's least height and an isolated control's hit area, coarse pointer only | 44 | 44 | 44 |

## Pending

On `feat/gb19-device` (group build 19, area A), not in a released pair:
`SF.device`, `SF.longPress` in core, sf-settings (`devices`, `device`,
`phoneSwitch`), rule 12 (core touch targets and the sheets that include
them) and this page.

## Known gaps

- 600 is the width the View layouts already switch at (sf-view-board,
  sf-view-calendar, the view head, sf-view-cards); it is not a step of the
  size scale (C181 (2), pending: 576 is `--sf-g8`, 640 `--sf-h0`). Moving it
  to a step moves View's switches with it, so it is a decision for DEV.
- The scope is read by sf-settings only. sf-menu-context menu items,
  sf-tabs items and sf-list actions do not read `devices` yet.
- Rule 12 reaches the parts named there. Other rows that are already 44 on
  a coarse pointer keep their own rules (sf-menu-context rows, sf-list rows,
  a checkable control with text). Rows drawn by other packages (View tables,
  Pro lists) take the rule when they use these parts; their own rows are
  their owners'.
- Where an isolated control's parent has no box of its own (`display:
  contents`), its area lies under the nearest box: the control keeps its
  drawn size as its target, never a neighbour's press. A control in a parent
  of its own beside another such parent can still meet it: the rule check
  reports it.
- sf-list and sf-list-item keep their own selection-or-menu choice (C148 (6),
  C150 (9)); they now take the press from core.

## Check

- `tests/browser/touch-targets.browser.mjs` (rule 12): at 390 on a touch
  phone, real taps at the centre and at the top and bottom edge of every
  stacked row, and at the centre and every edge of each isolated control's
  44 area (switches and check boxes on and off), a tap on each toolbar
  button's own box beside its neighbour, and the rule check; at 1440 with a
  mouse, the ladder's rows and no area.
- `tests/touch-targets.contract.test.mjs` (rule 12): the core rule and the
  sheets that include it.
- `tests/device-scope-s-a.contract.test.mjs`: the layout and pointer words,
  the scope and the marks, the long press, the sf-settings contract (hidden
  items, `phoneSwitch`, the words in every language, the 44 hit area) and the
  numbers of this page.
