import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import test from 'node:test';

// The public variables a component offers (src/core/contracts/public-variables.v1.json):
// each is read by the component's stylesheet, none is set by the Framework, and
// the list keeps to the small set the docs show under «Настройка».
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const contract = JSON.parse(await read('src/core/contracts/public-variables.v1.json'));
const FOLDERS = {badge: 'badges', button: 'buttons', input: 'inputs', alert: 'alerts'};

const scss = async (folder) => {
  const dir = `src/component/${folder}/scss`;
  const names = (await readdir(new URL(`../${dir}`, import.meta.url))).filter((name) => name.endsWith('.scss'));
  return (await Promise.all(names.map((name) => read(`${dir}/${name}`)))).join('\n');
};

const walk = async (dir) => (await Promise.all((await readdir(new URL(`../${dir}`, import.meta.url), {withFileTypes: true}))
  .map((entry) => (entry.isDirectory() ? walk(`${dir}/${entry.name}`) : /\.(s?css|js|mjs)$/u.test(entry.name) ? [`${dir}/${entry.name}`] : []))))
  .flat();

test('the contract names a pilot of four components, five to ten variables each', () => {
  assert.equal(contract.schema, 'simai.framework.public-variables.v1');
  assert.deepEqual(contract.components.map((entry) => entry.component).sort(), ['alert', 'badge', 'button', 'input']);
  for (const entry of contract.components) {
    assert.ok(entry.variables.length >= 5 && entry.variables.length <= 10, entry.component);
    for (const variable of entry.variables) {
      assert.match(variable.name, new RegExp(`^--sf-${entry.component}-[a-z]+(?:-[a-z]+)*$`, 'u'), variable.name);
      assert.doesNotMatch(variable.name.slice(2), /--/u, `${variable.name} has no double dash: that marks an internal one`);
    }
  }
});

test('every public variable is read by its component\'s stylesheet', async () => {
  for (const entry of contract.components) {
    const source = await scss(FOLDERS[entry.component]);
    for (const variable of entry.variables) {
      assert.ok(source.includes(`var(${variable.name},`), `${variable.name} is read in ${FOLDERS[entry.component]}`);
    }
  }
});

test('the Framework never sets a public variable', async () => {
  const names = contract.components.flatMap((entry) => entry.variables.map((variable) => variable.name));
  for (const file of await walk('src')) {
    const source = await read(file);
    for (const name of names) {
      assert.doesNotMatch(source, new RegExp(`(^|[;{\\s])${name}\\s*:`, 'mu'), `${file} sets ${name}`);
    }
  }
});
