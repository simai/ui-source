#!/usr/bin/env python3
"""Group build 9: second pass of pins with several literals on a line; the C181 test reads the
sheet without comments, so it names the C236 card rule by its selector."""
import pathlib
root = pathlib.Path(__file__).resolve().parents[2]
def sub(path, old, new):
    p = root / path; s = p.read_text(); assert s.count(old) == 1, (path, old); p.write_text(s.replace(old, new))
sub('tests/field-action-gaps-c123.contract.test.mjs', "[['input-color', '1.13.1', '1.18.0'], ['input-lookup', '1.15.1', '1.15.3']]",
    "[['input-color', '1.13.1', '1.18.1'], ['input-lookup', '1.15.1', '1.15.3']] /* group build 9: input-color 1.18.1 */")
sub('tests/menu-doc-tree-m1.contract.test.mjs', """  for (const [name, version] of [['menu', '1.11.2'], ['contents', '1.7.4']]) {
    const component = json(`src/smart/${name}/component.json`);
    assert.equal(component.version, version);
    assert.equal(json(`src/smart/${name}/smart.manifest.json`).version, version);""",
"""  // group build 9: the current numbers moved on (menu 1.13.5, contents 1.7.7); the notes stay.
  for (const [name, version, current] of [['menu', '1.11.2', '1.13.5'], ['contents', '1.7.4', '1.7.7']]) {
    const component = json(`src/smart/${name}/component.json`);
    assert.equal(component.version, current);
    assert.equal(json(`src/smart/${name}/smart.manifest.json`).version, current);""")
sub('tests/container-ladder-c181.contract.test.mjs', "  assert.match(sheet, /owner decision C236, variant B[\\s\\S]*?flex-direction: column;/u);",
    "  assert.match(sheet, /\\.sf-reference-link:not\\(\\[class\\*=\"sf-reference-link--size-\"\\]\\):not\\(\\[class\\*=\"sf-reference-link--line-\"\\]\\):not\\(\\.sf-reference-link--plain\\):where\\(:not\\(\\.sf-reference-link--inline\\)\\) \\{\\s*flex-direction: column;/u);")
print('ok')
