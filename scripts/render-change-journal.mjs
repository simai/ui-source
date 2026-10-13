#!/usr/bin/env node
// Usage: node scripts/render-change-journal.mjs [--stage compat|removed]
// Renders contracts/changes/journal.json as a Markdown table for the
// documentation site, so the page shows the journal rather than a copy of it.
// The output is plain Markdown and nothing else: it goes under the «Журнал
// изменений» heading on the page and is regenerated at each sweep. No marker
// comments and no <br> -- the site refuses raw HTML in Markdown, and both were
// refused (owner, 2026-10-09).
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const journal = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'contracts', 'changes', 'journal.json'), 'utf8'));
const stage = process.argv.includes('--stage') ? process.argv[process.argv.indexOf('--stage') + 1] : null;
const cell = (text) => String(text ?? '—').replace(/\|/gu, '\\|').replace(/\n/gu, ' ');
const forms = (record) => {
  const pairs = [...new Set(record.items.map((item) => `\`${item.from}\` → ${item.to ? `\`${item.to}\`` : '—'}`))];
  return pairs.slice(0, 4).join('; ') + (pairs.length > 4 ? `; и ещё ${pairs.length - 4}` : '');
};
const where = (record) => [...new Set(record.items.map((item) => item.component).filter(Boolean))].slice(0, 4).join(', ') || '—';
const rows = journal.records.filter((record) => !stage || record.stage === stage);
console.log('| Запись | Где | Было → стало | Устарело | Удаляется | Этап |');
console.log('|:---|:---|:---|:---|:---|:---|');
for (const record of rows) {
  const due = record.stage === 'removed' ? `удалено ${record.removed_on}` : (record.extended_to || record.remove_after);
  console.log(`| \`${record.id}\` | ${cell(where(record))} | ${forms(record)} | ${record.deprecated_on} | ${due} | ${record.stage === 'compat' ? 'совместимость' : 'удалено'} |`);
}
