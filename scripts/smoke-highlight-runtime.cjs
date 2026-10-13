const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/component/highlight/js/index.js'), 'utf8');
assert.match(source, /hljs-\$\{kind\}/);
assert.match(source, /escapeHtml/);
assert.match(source, /window\.SF\.Highlight/);
assert.doesNotMatch(source, /highlight\.js\/lib|node_modules/);
process.stdout.write(`${JSON.stringify({status: 'PASS', runtime: 'project-owned'})}\n`);
