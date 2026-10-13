import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const breakpoints = ['default', 'sm', 'md', 'lg', 'xl', 'xxl'];

for (const breakpoint of breakpoints) {
  test(`justify-content publishes canonical and compatibility names for ${breakpoint}`, () => {
    const directory = path.join(root, 'src', 'utility', 'justify-content', breakpoint);
    const stylesheet = fs.readFileSync(path.join(directory, 'scss', '_sf_css__justify_content.scss'), 'utf8');
    assert.match(stylesheet, /\.\#\{\$infix\}justify-\#\{\$flex-justify-content-name\},/);
    assert.match(stylesheet, /\.\#\{\$infix\}content-main-\#\{\$flex-justify-content-name\}/);

    const context = {SF: {RuleLoader: {}}};
    vm.runInNewContext(fs.readFileSync(path.join(directory, 'rule.js'), 'utf8'), context);
    const matcher = context.SF.RuleLoader[`justify-content/${breakpoint}`];
    const prefix = breakpoint === 'default' ? '' : `${breakpoint}:`;
    for (const family of ['justify', 'content-main']) {
      for (const value of ['start', 'end', 'center', 'between', 'around', 'evenly']) {
        const token = `${prefix}${family}-${value}`;
        assert.equal(matcher.test(token), true, token);
        assert.equal(matcher.test(`${token}-invalid`), false, token);
      }
    }
  });
}
