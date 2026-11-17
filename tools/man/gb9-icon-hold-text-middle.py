#!/usr/bin/env python3
"""Group build 9 integrator fix (tokens.typography 1.8.4, above 1.8.3 on fix/small-fixes-sf1):
fix/icon-reserve-fp's hold keeps an unloaded icon's box and set vertical-align: middle, the icons sheet's
alignment on the base. fix/content-glyphs-ct1 moved the icons sheet to the text's middle (C151 point 5,
--sf-icon--text-middle). Merged, a held icon stood 4 px lower than the drawn one and its line grew 24 -> 28
until the icons sheet came (first paint 24, icon/* reds in 2 of 3 runs, 0 of 3 on the base). The hold now
publishes and reads the same registered middle, so it stands where the sheet will put it."""
import pathlib
root = pathlib.Path(__file__).resolve().parents[2]
def rw(path, pairs):
    p = root / path; s = p.read_text(encoding='utf-8')
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:80], s.count(old)); s = s.replace(old, new)
    p.write_text(s, encoding='utf-8')
rw('src/core/scss/_sf_css__typograpy.scss', [
("""     has no weight (:where), so any rule of a component or a utility wins. */
  :root[data-sf-loader] body .sf-icon:not(.sf-icon-loaded) {""",
"""     has no weight (:where), so any rule of a component or a utility wins.
     It stands where the sheet puts the glyph: on the middle of its text
     line (C151 point 5), the parent's middle read as the sheet reads it
     (the registered --sf-icon--text-middle below); a hold on middle stood
     4 px lower and grew a 24 line to 28 until the sheet came. */
  :root[data-sf-loader] body .sf-icon:not(.sf-icon-loaded) {"""),
("""    inline-size: var(--sf-icon-glyph-size, var(--sf-icon--width, var(--sf-text-height-1)));
    block-size: var(--sf-icon-glyph-size, var(--sf-icon--height, var(--sf-text-height-1)));
  }
""", """    inline-size: var(--sf-icon-glyph-size, var(--sf-icon--width, var(--sf-text-height-1)));
    block-size: var(--sf-icon-glyph-size, var(--sf-icon--height, var(--sf-text-height-1)));
  }

  @supports selector(:has(*)) {
    :where(:root[data-sf-loader] body :has(> .sf-icon:not(.sf-icon-loaded))) {
      --sf-icon--text-middle: var(--sf-text--middle);
    }

    :where(:root[data-sf-loader] body .sf-icon:not(.sf-icon-loaded)) {
      vertical-align: calc(var(--sf-icon--text-middle) - var(--sf-icon-glyph-size, var(--sf-icon--height, var(--sf-text-height-1))) / 2);
    }
  }
"""),
])
# the same registration as the icons sheet's (component icons), so the parent's middle is its pixels before that sheet is in
rw('src/core/scss/_sf_css__typograpy.scss', [
("""@use '../figma_variables/figma_typography_styles';
@layer sf.base {""",
"""@use '../figma_variables/figma_typography_styles';

// The icons sheet's own registration (component icons), here too so a held
// icon reads its parent's middle in that parent's pixels before the sheet is in.
@property --sf-icon--text-middle {
  syntax: '<length>';
  inherits: true;
  initial-value: 0;
}

@layer sf.base {"""),
])
rw('src/core/passports/tokens.typography.json', [('  "version": "1.8.1",', '  "version": "1.8.4",')])
print('ok')
