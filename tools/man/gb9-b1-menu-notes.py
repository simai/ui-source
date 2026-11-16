#!/usr/bin/env python3
"""Group build 9: the msg-e22e231d notes were renumbered by the merge (menu 1.11.2 -> 1.13.5,
contents 1.7.4 -> 1.7.7, «written on the branch as ...»); the test finds the note by either number."""
import pathlib
root = pathlib.Path(__file__).resolve().parents[2]
p = root / 'tests/menu-doc-tree-m1.contract.test.mjs'; s = p.read_text()
old = "    assert.ok(component['x-decisions'].some((note) => note.startsWith(`version ${version} `) && /msg-e22e231d/u.test(note)), name);"
new = "    assert.ok(component['x-decisions'].some((note) => (note.startsWith(`version ${version} `) || note.startsWith(`version ${current} (written on the branch as ${version};`)) && /msg-e22e231d/u.test(note)), name);"
assert s.count(old) == 1; p.write_text(s.replace(old, new)); print('ok')
