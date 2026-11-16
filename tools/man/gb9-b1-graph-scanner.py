#!/usr/bin/env python3
"""Group build 9: two scanner misreads of scripts/dependency-graph.mjs (C250/C251) after the merges.
1. A tag name followed by an attribute (`sf-pagination appearance="more"`) is markup prose in a
   message (smart.list's retired-name note), not a drawn class.
2. A sheet that writes its size classes through the field ladder (`ladder.size-class('sf-x', $size)`
   in `@each $size in ladder.$outer|$sizes`, fix/fields-sizes-e2) has those sizes."""
import pathlib
root = pathlib.Path(__file__).resolve().parents[2]
p = root / 'scripts/dependency-graph.mjs'
s = p.read_text()
a = "      if (tagLits.has(m.index + m[1].length)) continue;\n"
assert s.count(a) == 1
s = s.replace(a, a + "      // A tag followed by an attribute is markup written as words (a note's `to`), not a class.\n      if (/^\\s+[a-z][a-z-]*=/u.test(t.slice(m.index + m[0].length, m.index + m[0].length + 40))) continue;\n", 1)
b = """        if (kind === 'size') { const s = v.match(/^size-([0-9/]+)$/u); if (s) vals.add(s[1]); } else vals.add(v);
      }
"""
assert s.count(b) == 1
s = s.replace(b, b + """      // Sizes written through the field ladder (ladder.size-class in @each over ladder.$outer or $sizes).
      if (kind === 'size' && /ladder\\.size-class\\(/u.test(text(p))) {
        const lists = {outer: ['1/3', '3'], sizes: ['1/3', '1/2', '1', '2', '3']};
        for (const m of text(p).matchAll(/@each \\$size in ladder\\.\\$(outer|sizes)\\b/gu)) for (const v of lists[m[1]]) vals.add(v);
      }
""", 1)
p.write_text(s)
print('ok')

# The two debt entries the corrected scanner shows were misreads: menu-context names
# sf-settings only in its retired-name note; country-code writes 1/3 and 3 through the ladder.
import json
d = root / 'contracts/graph/dependency-debt.json'
j = json.loads(d.read_text())
n = len(j['missing'])
j['missing'] = [e for e in j['missing'] if not (e['smart'] == 'smart.menu-context' and e['unit'] == 'smart.settings')]
assert len(j['missing']) == n - 1
d.write_text(json.dumps(j, ensure_ascii=False, indent=2) + '\n')
t = root / 'contracts/graph/twin-debt.json'
j = json.loads(t.read_text())
hit = [e for e in j['divergences'] if e['plain'] == 'component.country-code']
assert len(hit) == 1 and 'size-ladder' in hit[0]['codes']
e = hit[0]
i = e['codes'].index('size-ladder')
e['codes'].pop(i); e['notes'].pop(i)
t.write_text(json.dumps(j, ensure_ascii=False, indent=2) + '\n')
print('debt ok')
