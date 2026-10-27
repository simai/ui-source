import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// A studio fixture is the example a person and ui-studio open first, so a prop
// it gives has to be one the manifest allows: a value outside the declared
// enum, or a JSON string where the manifest declares an array, either draws a
// fallback nobody chose or is skipped by ui-studio's check. ui-studio found
// five such fixtures at 51002278751d (badge type «fill», drawer size
// «medium», range-slider label «both», accordion and menu items as a string).
const root = resolve(import.meta.dirname, '..');
const kind = (value) => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);

test('every studio fixture prop matches the type and enum its manifest declares', () => {
  const problems = [];
  let checked = 0;
  for (const name of readdirSync(resolve(root, 'src/smart'))) {
    const fixturePath = resolve(root, 'src/smart', name, 'studio.fixture.json');
    const manifestPath = resolve(root, 'src/smart', name, 'smart.manifest.json');
    if (!existsSync(fixturePath) || !existsSync(manifestPath)) continue;
    const props = JSON.parse(readFileSync(fixturePath, 'utf8')).props ?? {};
    const declared = JSON.parse(readFileSync(manifestPath, 'utf8')).inputs?.properties ?? {};
    for (const [key, value] of Object.entries(props)) {
      const spec = declared[key];
      if (!spec) continue;
      checked += 1;
      const types = [spec.type].flat().filter(Boolean);
      // An attribute is a string on the page; a fixture may give a number or
      // a boolean as the string a page would write. An array or an object is
      // given as one, never as its JSON text.
      const loose = (type) => type === kind(value)
        || (type === 'number' && typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)))
        || (type === 'boolean' && (value === 'true' || value === 'false'))
        || (type === 'integer' && Number.isInteger(Number(value)))
        || (type === 'string' && (typeof value === 'number' || typeof value === 'boolean'));
      if (types.length && !types.some(loose)) problems.push(`${name}.${key}: ${JSON.stringify(value).slice(0, 60)} is not ${types.join('|')}`);
      if (Array.isArray(spec.enum) && !spec.enum.includes(value)) problems.push(`${name}.${key}: ${JSON.stringify(value)} is not one of ${spec.enum.join(', ')}`);
    }
  }
  assert.ok(checked > 50, `only ${checked} fixture props were checked`);
  assert.deepEqual(problems, []);
});
