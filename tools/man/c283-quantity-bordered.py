#!/usr/bin/env python3
"""Owner decision C283 (2026-11-17), in group build 9 after fix/fields-c224-c227: sf-input-quantity
and the plain .sf-quantity stay BORDERED by default, as in the released pair. Only the
filled-by-default part of C224 is undone: the filled rules now answer sf-quantity--filled alone
(the class C224 already named; the Smart appearance=filled setting is group build 10's).
The rest of C224-C227 (bottom-line plumbing, label floor, textarea, date popup) stays.
component.quantity 1.9.0 (above 1.8.0 on origin/fix/layer-order-c273), sf-input-quantity 1.11.0
(above 1.10.0 on origin/fix/fields-c224-c227)."""
import pathlib, json, re
root = pathlib.Path(__file__).resolve().parents[2]
def rd(p): return (root / p).read_text(encoding='utf-8')
def wr(p, s): (root / p).write_text(s, encoding='utf-8')
def sub(s, old, new, count=1):
    assert s.count(old) == count, (old[:70], s.count(old)); return s.replace(old, new)

q = 'src/component/quantity/scss/_css__quantity.scss'; s = rd(q)
s = sub(s, """/* The look (owner decision C224, 2026-11-16; prototypes/forms-quantity-study.html
   #q-qty-filled): a plain sf-quantity looks as the Smart quantity field and
   the other fields of a form do -- filled, no border: sf-input--filled's and
   sf-textarea--filled's box (C52, C113). The bordered box stays a choice by
   the same name as sf-input's, sf-quantity--bordered (sf-quantity--filled
   names the default).""", """/* The filled look (owner decision C224, 2026-11-16; prototypes/forms-quantity-study.html
   #q-qty-filled), on request only (owner decision C283, 2026-11-17): a
   quantity is bordered by default, as in the released pair; sf-quantity--filled
   draws it filled, no border: sf-input--filled's and sf-textarea--filled's box
   (C52, C113). sf-quantity--bordered names the default.""")
n0 = s.count('.sf-quantity:not(.sf-quantity--bordered)')
assert n0 == 8, n0
s = s.replace('.sf-quantity:not(.sf-quantity--bordered)', '.sf-quantity.sf-quantity--filled')
s = sub(s, '.sf-quantity.error:not(.sf-quantity--bordered) .sf-quantity-wrap', '.sf-quantity.sf-quantity--filled.error .sf-quantity-wrap')
assert 'not(.sf-quantity--bordered)' not in s
wr(q, s)

d = 'src/component/quantity/docs/docs.md'; s = rd(d)
s = sub(s, """A plain `sf-quantity` is filled, as the Smart quantity field and the other
fields of a form are: the container fill, no border, the bottom line in
`--sf-outline` -- the look of `sf-input--filled` and `sf-textarea--filled`.""",
"""A plain `sf-quantity` is bordered, as in the released pair (owner decision
C283, 2026-11-17). `sf-quantity--filled` draws it filled on request: the
container fill, no border, the bottom line in `--sf-outline` -- the look of
`sf-input--filled` and `sf-textarea--filled`.""")
s = sub(s, """field takes the error container fill, a disabled one the disabled fill. The
bordered box stays a choice by the same name as the Input's:
`sf-quantity--bordered`. `sf-quantity--filled` names the default.""",
"""field takes the error container fill, a disabled one the disabled fill.
`sf-quantity--bordered` names the default.""")
s = sub(s, "the edge and the bottom line (1.7.0, owner decision C224).", "the edge and the bottom line (1.7.0, owner decision C224; 1.9.0, C283: filled on request).")
s = sub(s, '<label class="sf-quantity sf-quantity--size-1 sf-quantity--bordered">...</label>', '<label class="sf-quantity sf-quantity--size-1 sf-quantity--filled">...</label>')
wr(d, s)

m = 'src/smart/input-quantity/docs.md'; s = rd(m)
s = sub(s, """Поле с заливкой и без рамки, как остальные поля формы с заливкой
(`sf-input--filled`): заливка контейнера и нижняя линия; при наведении заливка
темнее и рамка цветом текста, пока вводят — рамка обычного поля без заливки
(решение владельца C224, 1.10.0). Поле с рамкой — класс `sf-quantity--bordered`
на корне (`root-class="sf-quantity--bordered"`), как у `sf-input`.""",
"""Поле с рамкой, как в выпущенной паре (решение владельца C283, 1.11.0). Поле с
заливкой и без рамки (C224) — только по запросу: класс `sf-quantity--filled` на
корне (`root-class="sf-quantity--filled"`): заливка контейнера и нижняя линия;
при наведении заливка темнее и рамка цветом текста, пока вводят — рамка обычного
поля без заливки.""")
s = sub(s, "(с рамкой — `sf-quantity--bordered` — красится рамка)", "(с заливкой — `sf-quantity--filled` — заливается тоном ошибки)")
s = sub(s, "| `--sf-quantity-invalid-border-color` | Рамка поля с рамкой (`sf-quantity--bordered`) в состоянии ошибки. |", "| `--sf-quantity-invalid-border-color` | Рамка поля в состоянии ошибки. |")
wr(m, s)

p = 'src/component/quantity/passport.json'; s = rd(p)
s = sub(s, '  "version": "1.7.0",', '  "version": "1.9.0",'); wr(p, s)

c = 'src/smart/input-quantity/component.json'; s = rd(c)
s = sub(s, '  "version": "1.10.0",', '  "version": "1.11.0",')
j = json.loads(s)
last = [n for n in j['x-decisions'] if isinstance(n, str) and n.startswith('version 1.10.0 ')]
assert len(last) == 1
note = ('version 1.11.0 (2026-11-17, owner decision C283, group build 9; component.quantity 1.9.0; numbered above 1.10.0 on '
        'origin/fix/fields-c224-c227): a minor, a look. The field is bordered by default again, as in the released pair: '
        'C283 reverses the filled-by-default part of C224 (1.10.0). The filled look stays, on request only: '
        'root-class="sf-quantity--filled" (the appearance setting comes in a later build). The label floor of C226 and '
        'everything else of 1.10.0 stay. Settings, values, events and keys unchanged.')
old = json.dumps(last[0], ensure_ascii=False)
assert s.count(old) == 1
s = s.replace(old, old + ',\n    ' + json.dumps(note, ensure_ascii=False), 1)
json.loads(s); wr(c, s)

t = 'tests/fields-c224-c227.contract.test.mjs'; s = rd(t)
s = sub(s, "test('C224: a plain sf-quantity is filled with no border; sf-quantity--bordered keeps the box', () => {",
    "// C283 (2026-11-17) reverses the default of C224: bordered by default, filled on request (sf-quantity--filled).\ntest('C224 under C283: a plain sf-quantity is bordered; sf-quantity--filled draws the filled box', () => {")
s = s.replace(".sf-quantity:not(.sf-quantity--bordered)", ".sf-quantity.sf-quantity--filled")
s = sub(s, ".sf-quantity.error:not(.sf-quantity--bordered) .sf-quantity-wrap", ".sf-quantity.sf-quantity--filled.error .sf-quantity-wrap")
s = sub(s, "  assert.match(read('src/component/quantity/docs/docs.md'), /`sf-quantity--bordered`/u);",
    "  assert.match(read('src/component/quantity/docs/docs.md'), /`sf-quantity--filled` draws it filled on request/u);\n  assert.doesNotMatch(q, /:not\\(\\.sf-quantity--bordered\\)/u, 'no rule fills a quantity by default');")
wr(t, s)
print('ok')
