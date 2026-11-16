#!/usr/bin/env python3
"""Group build 9: the version pins fix-pins9.py could not move (several literals on one line), and
CORE_RUNTIME to the core.runtime passport (1.58.1, pro-admin-menu-relations)."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parents[2]
def sub(path, old, new):
    p = root / path; s = p.read_text(); assert s.count(old) == 1, (path, old); p.write_text(s.replace(old, new))
sub('src/core/js/sets.js', "export const CORE_RUNTIME = '1.58.0';", "export const CORE_RUNTIME = '1.58.1';")
sub('tests/inherited-reset-c123.contract.test.mjs', "dropdown: ['1.16.0', '1.18.0'], 'input-color': ['1.13.0', '1.18.0'], switch: ['1.7.0', '1.7.2'], 'input-quantity': ['1.9.0', '1.9.2']};",
    "dropdown: ['1.16.0', '1.18.1'], 'input-color': ['1.13.0', '1.18.1'], switch: ['1.7.0', '1.7.2'], 'input-quantity': ['1.9.0', '1.10.0']}; // group build 9: the merged branches' numbers")
sub('tests/list.contract.test.mjs', "[['list', 'sf-list', '1.20.0'], ['list-feed', 'sf-list-feed', '1.4.0']]", "[['list', 'sf-list', '1.20.2'], ['list-feed', 'sf-list-feed', '1.4.1']]")
print('ok')
