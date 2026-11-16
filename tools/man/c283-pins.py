#!/usr/bin/env python3
"""C283: inherited-reset-c123 pins sf-input-quantity's current number 1.11.0."""
import pathlib
p = pathlib.Path(__file__).resolve().parents[2] / 'tests/inherited-reset-c123.contract.test.mjs'
s = p.read_text(); old = "'input-quantity': ['1.9.0', '1.10.0']"; assert s.count(old) == 1
p.write_text(s.replace(old, "'input-quantity': ['1.9.0', '1.11.0']")); print('ok')
