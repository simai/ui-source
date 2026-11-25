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

## Pending

On `feat/gb19-device` (group build 19, area A), not in a released pair:
`SF.device`, `SF.longPress` in core, sf-settings 1.11.0 (`devices`,
`device`, `phoneSwitch`) and this page.

## Known gaps

- 600 is the width the View layouts already switch at (sf-view-board,
  sf-view-calendar, the view head, sf-view-cards); it is not a step of the
  size scale (C181 (2), pending: 576 is `--sf-g8`, 640 `--sf-h0`). Moving it
  to a step moves View's switches with it, so it is a decision for DEV.
- The scope is read by sf-settings only. sf-menu-context menu items,
  sf-tabs items and sf-list actions do not read `devices` yet.
- Rule 9 is applied by the sf-settings phone switch in width (44) and in
  height where its row is 44 (size 1). A panel of size 1/2 keeps 28 rows on a
  phone, so the switch's press is 28 high there: an area reaching over the
  neighbouring rows would take their presses (a press on the lower part of
  one row's switch turned the next row's, probe round 4). A 44 row on a
  coarse pointer for every size is a decision for DEV. sf-tabs pills of size
  1/2 (28 px) and sf-checkbox boxes (20 x 20) on a coarse pointer are below
  44 too (study S-A, kanban scene) -- not changed here.
- sf-list and sf-list-item keep their own selection-or-menu choice (C148 (6),
  C150 (9)); they now take the press from core.

## Check

- `tests/device-scope-s-a.contract.test.mjs`: the layout and pointer words,
  the scope and the marks, the long press, the sf-settings contract (hidden
  items, `phoneSwitch`, the words in every language, the 44 hit area) and the
  numbers of this page.
