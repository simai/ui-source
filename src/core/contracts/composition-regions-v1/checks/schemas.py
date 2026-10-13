"""Independent Draft 2020-12 validation of region types and fixture Documents.
Requires: pip install jsonschema. Not a substitute for the owner validator."""
import json
from pathlib import Path
from jsonschema import Draft202012Validator

bundle = Path(__file__).resolve().parent.parent
contracts = bundle.parent
load = lambda path: json.loads(path.read_text())
type_schema = load(contracts / 'composition-type-manifest.v1.schema.json')
document_schema = load(contracts / 'composition-document.v1.schema.json')
for schema in (type_schema, document_schema):
    Draft202012Validator.check_schema(schema)
types = {entry['type']: entry for entry in load(contracts / 'composition-types.v1.json')['entries']}
checked_types = 0
for name in ('layout.regions', 'layout.region'):
    Draft202012Validator(type_schema).validate(types[name])
    checked_types += 1
documents = 0
for case in load(bundle / 'fixtures/regions.json')['cases']:
    if case['expect'] == 'valid':
        Draft202012Validator(document_schema).validate(case['document'])
        documents += 1
print(json.dumps({'status': 'pass', 'types': checked_types, 'documents': documents}))
