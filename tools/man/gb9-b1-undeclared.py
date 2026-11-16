#!/usr/bin/env python3
"""Group build 9: the scrollbar tracks of C210 (fix/scrollbar-system-c210) read six tokens that
src/core/js/scrollbars.js writes on the track element's own style; no sheet declares them. They are
listed as a known group so the gate stays red for anything new; reported to the C210 owner."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
p = root / 'contracts/undeclared-tokens.json'
j = json.loads(p.read_text())
assert 'runtime-set-scrollbar' not in j['groups']
j['groups']['runtime-set-scrollbar'] = {
  'recorded': '2026-11-17',
  'why': 'C210 scrollbar tracks: src/core/js/scrollbars.js sets these on each track element (style.setProperty) from the area\'s --sf-scroll--gap-content, --sf-scroll--gap-edge, --sf-scroll--rest, --sf-scroll-bg-thumb, --sf-scroll--thumb-held and the measured room; the track is hidden until the script has set them. Open: declare defaults on .sf-scrollbar__track, or keep them runtime-only.',
  'tokens': ['--sf-scroll--edge', '--sf-scroll--gap', '--sf-scroll--held-colour', '--sf-scroll--rest-at', '--sf-scroll--rest-colour', '--sf-scroll--room'],
}
p.write_text(json.dumps(j, ensure_ascii=False, indent=2) + '\n')
print('ok')
