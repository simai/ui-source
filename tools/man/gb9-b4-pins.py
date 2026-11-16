#!/usr/bin/env python3
"""Group build 9, build b4: input-lookup's current number (1.16.1) in the C123 list."""
import pathlib
p = pathlib.Path(__file__).resolve().parents[2] / 'tests/field-action-gaps-c123.contract.test.mjs'
s = p.read_text(); old = "['input-lookup', '1.15.1', '1.15.3']"; assert s.count(old) == 1
p.write_text(s.replace(old, "['input-lookup', '1.15.1', '1.16.1']")); print('ok')
# the generated manifests carry the same numbers
root = pathlib.Path(__file__).resolve().parents[2]
for f, old, new in [('tests/c61-round-5.contract.test.mjs', "json('src/smart/list-timeline/smart.manifest.json').version, '1.4.0');", "json('src/smart/list-timeline/smart.manifest.json').version, '1.4.1'); // group build 9"),
                    ('tests/tags-c145.contract.test.mjs', "json('src/smart/input-lookup/smart.manifest.json').version, '1.15.3');", "json('src/smart/input-lookup/smart.manifest.json').version, '1.16.1'); // group build 9")]:
    q = root / f; t = q.read_text(); assert t.count(old) == 1, f; q.write_text(t.replace(old, new))
print('manifest pins ok')
q = root / 'tests/tags-c145.contract.test.mjs'; t = q.read_text()
for f in ['component', 'smart.manifest']:
    old = f"json('src/smart/tag/{f}.json').version, '1.11.0');"; assert t.count(old) == 1, f
    t = t.replace(old, f"json('src/smart/tag/{f}.json').version, '1.11.2'); // group build 9")
q.write_text(t); print('tag pins ok')
