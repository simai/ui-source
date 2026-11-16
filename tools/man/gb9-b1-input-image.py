#!/usr/bin/env python3
"""Group build 9: the former-word map of sf-input-image moves into the helpers block
(before the component.json comment) so the C94 test that evaluates the helpers and the
class body in a vm sees it; the test context gains registeredWord and noteDeprecated stubs."""
import pathlib, sys
root = pathlib.Path(__file__).resolve().parents[2]
src = root / 'src/smart/input-image/index.js'
t = src.read_text()
start = t.index('const FORMER_FILE_LEADS = {')
end = t.index('};\n', start) + 3
block = t[start:end]
t = t[:start] + t[end:].lstrip('\n') if False else t[:start] + t[end:]
# drop the blank line left behind
t = t.replace('\n\n\nclass SfImageField extends', '\n\nclass SfImageField extends', 1)
anchor = '// sf-input-image from its component.json'
assert t.count(anchor) == 1, 'anchor'
t = t.replace(anchor, block + '\n' + anchor, 1)
src.write_text(t)
test = root / 'tests/input-image-c94.contract.test.mjs'
s = test.read_text()
a = "    words: ru,\n    fill,\n  });"
assert s.count(a) == 1, 'test anchor'
s = s.replace(a, "    words: ru,\n    fill,\n    registeredWord: () => undefined,\n    noteDeprecated: () => {},\n  });", 1)
test.write_text(s)
print('ok')
