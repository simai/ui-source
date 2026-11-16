#!/usr/bin/env python3
"""Group build 9: the GB9 patch notes name C278 without naming the withdrawn language (the C278 grep
keeps only country data)."""
import pathlib, glob
root = pathlib.Path(__file__).resolve().parents[2]
old = 'its Kazakh words are withdrawn with the Kazakh pack (C278)'
new = 'its words of the withdrawn pilot interface pack leave it (C278)'
n = 0
for f in glob.glob(str(root / 'src/smart/*/component.json')):
    p = pathlib.Path(f); s = p.read_text()
    if old in s: p.write_text(s.replace(old, new)); n += 1
assert n == 9, n
print('notes', n)
