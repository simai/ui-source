import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

// The theme as the tests that measure it read it: the source of
// _sf_css__theme.scss, and after it each former name of the C16 renames and
// of the C20 shadows (src/core/contracts/token-aliases.v1.json) with its new name's value. In the
// built sheet a former name is var() of the new one, so the value a test reads
// under either name is the value a page gets under it.
const root = resolve(import.meta.dirname, '..', '..');

export function themeSource() {
  const theme = readFileSync(resolve(root, 'src/core/scss/_sf_css__theme.scss'), 'utf8');
  const {tokens, shadows} = JSON.parse(readFileSync(resolve(root, 'src/core/contracts/token-aliases.v1.json'), 'utf8'));
  const lines = [];
  // The C20 former names (shadows) after the C16 ones: a former name of a
  // shadow is var() of its place on the theme root as well.
  for (const {from, to} of [...tokens, ...(shadows?.tokens ?? [])]) {
    const value = theme.match(new RegExp(`\\s${to}: ([^;]+);`, 'u'))?.[1];
    if (value) lines.push(`    ${from}: ${value};`);
  }
  return `${theme}\n/* former names (tests/support/theme-source.mjs) */\n${lines.join('\n')}\n`;
}
