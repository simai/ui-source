#!/usr/bin/env python3
"""Group build 9, dispatcher decisions 2026-11-17 (core.styles 1.15.1, above 1.15.0 on every origin branch):
1. sf-reference-link's bare tag follows C236 (fix/nav-procedure-ref-nv1): a card has its route under the
   name at every width. Measured on the b5 stand: with a route the card's padding (space-1) and border, the
   name's line and the route's 1/2 line (78 at 1440, 62 at 390); without one the size-3 control (56 / 52).
   The phone rule stacks only the plain reference now.
2. C210 scroll tokens: the track declares its defaults from the scroll system; scrollbars.js keeps writing
   the live values on the track's own style. The known-exceptions group is dropped."""
import pathlib, json
root = pathlib.Path(__file__).resolve().parents[2]
def rw(path, pairs):
    p = root / path; s = p.read_text(encoding='utf-8')
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:80], s.count(old)); s = s.replace(old, new)
    p.write_text(s, encoding='utf-8')
rw('src/core/scss/_sf_css__placeholder.scss', [
("""   container; a card one control of size 3 high; a size one control of that
   step; a line, or plain, one line of the text of its step. On a phone a card
   stacks: the label line, the card's gap and the route line when there is a
   route, the card's --sf-space-1 above and below and its border.""",
"""   container; a card one control of size 3 high, and with a route (text) its
   route under the name at every width (owner decision C236): the card's
   --sf-space-1 above and below and its border, the name's line and the
   route's 1/2 line (78 at 1440, 62 on a phone); a size one control of that
   step; a line, or plain, one line of the text of its step. On a phone a plain
   reference stacks: the label line, the gap and the route line when there is
   a route."""),
(""":where(sf-reference-link:not(:defined)):not(:has(> [data-sf-static])) {
  display: block;
  block-size: var(--sf-reference-link--box);
}
""", """:where(sf-reference-link:not(:defined)):not(:has(> [data-sf-static])) {
  display: block;
  block-size: var(--sf-reference-link--box);
}

/* C236: a card with a route holds the name and the route under it. */
:where(sf-reference-link[text]:not([text=""]):not(:defined):not([appearance="inline"]):not([appearance="plain"]):not([line]:not([line=""])):not([size]:not([size=""]))):not(:has(> [data-sf-static])) {
  block-size: calc(var(--sf-reference-link--box-pad) + var(--sf-reference-link--box-line) + var(--sf-text-height-1\\/2));
}
"""),
("""@media (width < map.get(bp.$breakpoint-array, sm)) { // below sm: the card stacks, as its sheet draws it
  :where(sf-reference-link:not(:defined):not([appearance="inline"]):not([line]:not([line=""])):not([size]:not([size=""]))):not(:has(> [data-sf-static])) {""",
"""@media (width < map.get(bp.$breakpoint-array, sm)) { // below sm: a plain reference stacks, as its sheet draws it (a card is stacked at every width, C236)
  :where(sf-reference-link[appearance="plain"]:not(:defined):not([line]:not([line=""])):not([size]:not([size=""]))):not(:has(> [data-sf-static])) {"""),
])
rw('src/core/scss/_sf_css__scroll.scss', [
("""  // the area (--sf-scroll--*); nothing here draws until it does.
  .sf-scrollbar__track {
    position: absolute;""",
"""  // the area (--sf-scroll--*); nothing here draws until it does. The track
  // declares the same values from the scroll system as its defaults
  // (dispatcher decision 2026-11-17, C18); the script's live values on the
  // track's own style come first.
  .sf-scrollbar__track {
    --sf-scroll--gap: var(--sf-scroll--gap-content, var(--sf-0));
    --sf-scroll--edge: var(--sf-scroll--gap-edge, var(--sf-0));
    --sf-scroll--room: var(--sf-scroll-bg-width);
    --sf-scroll--rest-at: var(--sf-scroll--rest, var(--sf-scroll-thumb-size));
    --sf-scroll--rest-colour: var(--sf-scroll-bg-thumb);
    --sf-scroll--held-colour: var(--sf-scroll--thumb-held, var(--sf-on-surface-variant));
    position: absolute;"""),
])
p = root / 'contracts/undeclared-tokens.json'; j = json.loads(p.read_text())
assert 'runtime-set-scrollbar' in j['groups']; del j['groups']['runtime-set-scrollbar']
p.write_text(json.dumps(j, ensure_ascii=False, indent=2) + '\n')
rw('src/core/passports/core.styles.json', [('  "version": "1.15.0",', '  "version": "1.15.1",')])
f = root / 'tests/fixtures/first-paint/box-from-attributes.json'; s = f.read_text(encoding='utf-8')
old = 'on a phone a card stacks to the label line, the card gap and a route line when text is set, with the card\'s padding and border (RL-18, 2026-11-14)'
assert s.count(old) == 1
f.write_text(s.replace(old, 'a card with text holds its route under the name at every width, the card\'s padding and border, the name\'s line and the route\'s 1/2 line (C236; 78 at 1440, 62 at 390); on a phone a plain reference stacks to the label line, the gap and a route line when text is set (RL-18, 2026-11-14)'), encoding='utf-8')
print('ok')
