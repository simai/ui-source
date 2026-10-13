/* Renders the human-readable notice from the bundle that ships with the
   distribution, so the two cannot drift: the JSON is the source, the Markdown
   is a view of it. Usage: node scripts/render-third-party-notices.mjs <repo-root> */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const source = new URL('../src/core/contracts/third-party-notices.v1.json', import.meta.url);
const bundle = JSON.parse(await readFile(source, 'utf8'));
const target = process.argv[2];
if (!target) {
  console.error('usage: node scripts/render-third-party-notices.mjs <repo-root>');
  process.exit(2);
}

const lines = [
  '# Third-party notices',
  '',
  'This distribution contains the code and fonts listed below. Their licences',
  'require these notices to travel with the files, so the same list ships inside',
  'the distribution as `core/contracts/third-party-notices.v1.json`; this file is',
  'rendered from it.',
  '',
  `The distribution itself is ${bundle.project.spdx}. ${bundle.project.copyright}. See LICENSE.`,
  '',
  '| Component | Version | Licence | Where it lands |',
  '| --- | --- | --- | --- |',
];
for (const entry of bundle.entries) {
  const versions = entry.packages.map((p) => `${p.name} ${p.version}`).join(', ');
  lines.push(`| ${entry.name} | ${versions} | ${entry.spdx} | ${entry.ships_in.join(', ')} |`);
}
for (const entry of bundle.entries) {
  lines.push('', `## ${entry.name}`, '', entry.used_for + '.', '', entry.copyright, '', '```', entry.license_text, '```');
}
await writeFile(path.join(target, 'THIRD-PARTY-NOTICES.md'), lines.join('\n') + '\n');
/* The distribution is what people copy into a project, so it states its own
   terms beside the ones it borrows. */
await writeFile(path.join(target, 'LICENSE'), bundle.project.license_text + '\n');
console.log(`written: ${path.join(target, 'THIRD-PARTY-NOTICES.md')} and LICENSE`);
