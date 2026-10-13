"""Independent Draft 2020-12 validation; pip install jsonschema in a test environment."""
from pathlib import Path
import json,copy
from jsonschema import Draft202012Validator
from referencing import Registry,Resource
b=Path(__file__).resolve().parent.parent
schemas=[json.loads(p.read_text()) for p in b.glob('*.schema.json')]
registry=Registry().with_resources((s['$id'],Resource.from_contents(s)) for s in schemas)
for s in schemas: Draft202012Validator.check_schema(s)
def validate(name,value):
    schema=json.loads((b/name).read_text());Draft202012Validator(schema,registry=registry).validate(value)
f=json.loads((b/'fixtures/header-switch.json').read_text())
validate('recipe.schema.json',f['recipe']);validate('manifest.schema.json',f['sources']['article'])
common=next(s for s in schemas if s['$id'].endswith('common.schema.json'))
for mode in ['compact','expanded']:
    validate('inputs.schema.json',f['inputs'][mode]);validate('dependencies.schema.json',f['expected'][mode]['dependencyReceipt'])
    Draft202012Validator(json.loads((b.parent/'composition-document.v1.schema.json').read_text())).validate(f['expected'][mode]['document'])
    Draft202012Validator({'$ref':common['$id']+'#/$defs/placement'},registry=registry).validate(f['sources']['header.'+mode])
negative=json.loads((b/'fixtures/schema-negative.json').read_text())['cases']
for case in negative:
    value=f
    for part in case['base'].split('.'):value=value[part]
    value=copy.deepcopy(value);op=case['operation'];target=value
    for part in op['path'][:-1]:target=target[part]
    if op['kind']=='set':target[op['path'][-1]]=op['value']
    else:del target[op['path'][-1]]
    from jsonschema.exceptions import ValidationError
    try:validate(case['schema'],value)
    except ValidationError:pass
    else:raise AssertionError('accepted '+case['id'])
print(json.dumps({'status':'pass','schemas':len(schemas),'expectedDocuments':2,'negativeSchemaCases':len(negative),'notVerified':['semantic resolver errors','limits enforced during expansion']}))
