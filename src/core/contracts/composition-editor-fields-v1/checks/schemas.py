"""Independent Draft 2020-12 validation of the field-kind registry and editor
manifests. Requires: pip install jsonschema."""
import json
from pathlib import Path
from jsonschema import Draft202012Validator

bundle = Path(__file__).resolve().parent.parent
contracts = bundle.parent
load = lambda path: json.loads(path.read_text())
kind_schema = load(contracts / 'composition-editor-field-kind.v1.schema.json')
editor_schema = load(contracts / 'composition-editor-manifest.v1.schema.json')
for schema in (kind_schema, editor_schema):
    Draft202012Validator.check_schema(schema)
kinds = load(contracts / 'composition-editor-field-kinds.v1.json')
assert kinds['schema'] == 'simai.composition.editor-field-kind-registry.v1'
for entry in kinds['entries']:
    Draft202012Validator(kind_schema).validate(entry)
editor = load(contracts / 'composition-editor-manifests.v1.json')
for entry in editor['entries']:
    Draft202012Validator(editor_schema).validate(entry)
fixture = load(bundle / 'fixtures/field-kinds.json')
for case in fixture['manifests']:
    if case['expect'] == 'valid':
        Draft202012Validator(editor_schema).validate(case['manifest'])
print(json.dumps({'status': 'pass', 'kinds': len(kinds['entries']), 'editor_manifests': len(editor['entries'])}))
