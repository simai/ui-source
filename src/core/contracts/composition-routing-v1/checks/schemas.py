"""Independent Draft 2020-12 validation of the scope type, port registry and
fixture Documents. Requires: pip install jsonschema."""
import json
from pathlib import Path
from jsonschema import Draft202012Validator

bundle = Path(__file__).resolve().parent.parent
contracts = bundle.parent
load = lambda path: json.loads(path.read_text())
# Either form of a format name: the older 'simai.<name>.v<major>', or
# 'simai.<name>' with schema_version beside it (src/core/js/composition/schema-name.mjs).
def is_schema(document, name, version):
    label = document.get('schema')
    if label == f'{name}.v{version}':
        return document.get('schema_version', version) == version
    return label == name and document.get('schema_version') == version
type_schema = load(contracts / 'composition-type-manifest.v1.schema.json')
port_schema = load(contracts / 'composition-port-manifest.v1.schema.json')
document_schema = load(contracts / 'composition-document.v1.schema.json')
for schema in (type_schema, port_schema, document_schema):
    Draft202012Validator.check_schema(schema)
types = {entry['type']: entry for entry in load(contracts / 'composition-types.v1.json')['entries']}
Draft202012Validator(type_schema).validate(types['layout.scope'])
registry = load(contracts / 'composition-ports.v1.json')
assert is_schema(registry, 'simai.composition.port-registry', 1)
# A value type is read by its bare name or by the older label with the
# version (value-types-without-version); the registry keys keep the older labels
# and value_type_names maps each bare name to its key.
value_types = set(registry['value_types'])
names = registry['value_type_names']
assert {f'{name}.v1' for name in names} == value_types and all(names[name] == f'{name}.v1' for name in names), 'value type names drift'
assert value_types | set(names) == set(port_schema['$defs']['valueType']['enum']), 'value type vocabulary drift'
for entry in registry['entries']:
    Draft202012Validator(port_schema).validate(entry)
fixture = load(bundle / 'fixtures/routing.json')
for manifest in fixture['setup']['types']:
    Draft202012Validator(type_schema).validate(manifest)
documents = 0
for case in fixture['cases']:
    if case['expect'] == 'valid':
        Draft202012Validator(document_schema).validate(case['document'])
        documents += 1
names_fixture = load(bundle / 'fixtures/value-type-names.json')
assert names_fixture['value_type_names'] == names, 'fixture names drift'
fragment_schema = load(contracts / 'interface-fragment.v1.schema.json')
Draft202012Validator.check_schema(fragment_schema)
assert set(fragment_schema['$defs']['valueType']['enum']) == set(port_schema['$defs']['valueType']['enum']), 'descriptor vocabulary drift'
for manifest in names_fixture['setup']['types']:
    Draft202012Validator(type_schema).validate(manifest)
for manifest in names_fixture['setup']['port_manifests']:
    Draft202012Validator(port_schema).validate(manifest)
schemas = {'composition-port-manifest.v1.schema.json': port_schema, 'interface-fragment.v1.schema.json': fragment_schema}
schema_cases = 0
for case in names_fixture['schema_cases']:
    valid = Draft202012Validator(schemas[case['schema']]).is_valid(case['document'])
    assert valid == (case['expect'] == 'valid'), case['id']
    schema_cases += 1
for case in names_fixture['cases']:
    if case['expect'] == 'valid':
        Draft202012Validator(document_schema).validate(case['document'])
        documents += 1
print(json.dumps({'status': 'pass', 'ports': len(registry['entries']), 'documents': documents, 'schema_cases': schema_cases}))
