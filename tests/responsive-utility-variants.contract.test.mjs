import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { generateResponsiveUtilityVariants } from '../scripts/generate-responsive-utility-variants.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const utilityRoot = path.join(repositoryRoot, 'src', 'utility');

test('xxl variants match every existing responsive utility family', () => {
    const result = generateResponsiveUtilityVariants({
        check: true,
        repositoryRoot,
    });

    assert.equal(result.families.length, 87);

    const ruleRegistry = fs.readFileSync(
        path.join(repositoryRoot, 'src/core/js/rule.src.js'),
        'utf8',
    );
    const fullUtilityRegistry = fs.readFileSync(
        path.join(repositoryRoot, 'src/core/utility-full.js'),
        'utf8',
    );

    assert.equal((ruleRegistry.match(/utility\/.+\/xxl\/rule\.js/g) || []).length, 87);
    assert.equal((fullUtilityRegistry.match(/utility\/.+\/xxl\/index\.scss/g) || []).length, 86);

    const loader = fs.readFileSync(
        path.join(repositoryRoot, 'src/core/js/loader.js'),
        'utf8',
    );
    assert.match(loader, /'xl',\s*'xxl',\s*'hover'/);

    for (const family of result.families)
    {
        const rule = fs.readFileSync(
            path.join(utilityRoot, family, 'xxl', 'rule.js'),
            'utf8',
        );

        assert.match(rule, new RegExp(`RuleLoader\\[['"]${family}/xxl['"]\\]`));
        assert.match(rule, /xxl\\?:/);
        assert.doesNotMatch(rule, new RegExp(`RuleLoader\\[['"]${family}/xl['"]\\]`));
    }
});

test('xxl styles use the 1280px (80rem) breakpoint contract', () => {
    const breakpointSource = fs.readFileSync(
        path.join(repositoryRoot, 'src/core/scss/vars/_sf_var__breakpoint.scss'),
        'utf8',
    );

    const breakpoint = breakpointSource.match(/xxl:\s*(\d+(?:\.\d+)?)(px|rem)/);

    assert.ok(breakpoint);
    assert.equal(Number(breakpoint[1]) * (breakpoint[2] === 'rem' ? 16 : 1), 1280);

    for (const family of generateResponsiveUtilityVariants({
        check: true,
        repositoryRoot,
    }).families)
    {
        const scssRoot = path.join(utilityRoot, family, 'xxl', 'scss');
        const styles = fs.readdirSync(scssRoot)
            .filter(file => file.endsWith('.scss'))
            .map(file => fs.readFileSync(path.join(scssRoot, file), 'utf8'))
            .join('\n');

        assert.match(styles, /breakpoint-media\((?:xxl|\$(?:infix|mobile))\)/);
        assert.match(styles, /breakpoint-infix\((?:xxl|\$(?:infix|mobile)),/);
        if (!styles.includes('breakpoint-media(xxl)'))
        {
            assert.match(styles, /\$(?:infix|mobile):\s*xxl;/);
        }
        assert.doesNotMatch(styles, /breakpoint-media\(xl\)/);
        assert.doesNotMatch(styles, /breakpoint-infix\(xl,/);
    }
});
