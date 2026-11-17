#!/usr/bin/env python3
"""Group build 9 integrator fix (component.icons 1.4.1, above 1.4.0 on fix/content-glyphs-ct1):
the C151 point 5 lift reads the glyph's baseline as its box's bottom edge. That holds once Material Symbols
is in (no descent), not before: an inline-flex box's baseline is its text's, and overflow: clip (unlike
hidden) does not move it. Until the icon font came the glyph stood 3.2 px lower (3.9 on a phone) and grew
its line 24.8 -> 27.2 (20.1 -> 23.9); the first-paint gate saw it as icon/* reds in 2 of 3 runs on group
build 9, 0 of 3 on the released pair (middle alignment). Layout containment gives the box no baseline of
its own, so the line synthesizes it from the bottom edge, with or without the font: measured 0.0 / 24.8
and 0.0 / 20.1 in both cases (probe/iconhold3.mjs)."""
import pathlib
root = pathlib.Path(__file__).resolve().parents[2]
def rw(path, pairs):
    p = root / path; s = p.read_text(encoding='utf-8')
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:80], s.count(old)); s = s.replace(old, new)
    p.write_text(s, encoding='utf-8')
rw('src/component/icons/scss/_css__icons.scss', [
("""  // draw spells its letters, up to 384 px wide over the label beside it.
  overflow: clip;
""", """  // draw spells its letters, up to 384 px wide over the label beside it.
  overflow: clip;
  // Its baseline is its bottom edge, the font in or not (the lift below reads
  // it so): layout containment leaves the box no baseline of its own, and the
  // line takes the bottom edge. Without it the baseline was the name's text,
  // and before Material Symbols came (no descent) a fallback face's descent
  // stood the glyph 3-4 px low and grew a 24 line to 27 (group build 9).
  contain: layout;
"""),
("""// clips (overflow), so its baseline is its bottom edge; the middle of a text""",
 """// clips and contains its layout, so its baseline is its bottom edge; the middle of a text"""),
])
rw('src/component/icons/passport.json', [('  "version": "1.4.0",', '  "version": "1.4.1",')])
print('ok')
