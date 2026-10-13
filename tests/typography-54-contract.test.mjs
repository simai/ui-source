import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
    aliasPx,
    contract,
    repositoryPath,
    validateContract,
} from "../scripts/adaptive-sizing-contract-lib.mjs";
import { projections } from "../scripts/generate-adaptive-sizing-contract.mjs";

const read = relativePath => fs.readFileSync(repositoryPath(relativePath), "utf8");

const expectedTitleHeights = {
    mobile: [16, 16, 20, 24, 24, 28, 32, 36, 40, 48, 52, 56],
    desktop: [16, 24, 28, 32, 36, 40, 48, 56, 64, 76, 80, 96],
};

test("5.4 title heights and semantic roles are canonical contract data", () => {
    assert.equal(validateContract(), contract);
    assert.equal(contract.meta.version, "1.3.0");

    for (const mode of ["mobile", "desktop"])
    {
        assert.deepEqual(
            Object.values(contract.typography.titleLineHeights).map(
                aliases => aliasPx(aliases[mode]),
            ),
            expectedTitleHeights[mode],
        );
    }

    assert.deepEqual(contract.typography.roles.heading["1"], {
        height: "6",
        size: "6",
    });
    assert.deepEqual(contract.typography.roles.display["1"], {
        height: "12",
        size: "12",
    });
    assert.deepEqual(contract.typography.flowSpacing, {
        content: {
            text: "1",
            related: "2",
            block: "3",
            section: "4",
        },
        headingBottom: "1",
        headingTop: "4",
        textBottom: "1",
    });
});

test("generated public tokens retain the single-delimiter compatibility layer", () => {
    const outputs = [...projections().values()].join("\n");

    for (const [canonical, legacy] of [
        ["--sf-text--size-1", "--sf-text-size-1"],
        ["--sf-text--height-1", "--sf-text-height-1"],
        ["--sf-title--height-1", "--sf-title-height-1"],
    ])
    {
        assert.match(outputs, new RegExp(`${canonical}: var\\(--sf-`));
        assert.match(
            outputs,
            new RegExp(`${legacy}: var\\(${canonical}\\);`),
        );
    }

    for (const role of ["label", "text", "heading", "display"])
    {
        assert.match(outputs, new RegExp(`--sf-${role}-[^:]+--size:`));
        assert.match(outputs, new RegExp(`--sf-${role}-[^:]+--height:`));
    }
});

test("Core typography and Utility headers consume one semantic heading contract", () => {
    const styles = read("src/core/figma_variables/figma_typography_styles.scss");
    const headers = read("src/utility/headers/default/scss/_css__headers.scss");

    for (let level = 1; level <= 6; level += 1)
    {
        const size = `var(--sf-heading-${level}--size)`;
        const height = `var(--sf-heading-${level}--height)`;
        assert.ok(styles.includes(size), `Core heading ${level} size`);
        assert.ok(styles.includes(height), `Core heading ${level} height`);
        assert.ok(headers.includes(size), `Utility heading ${level} size`);
        assert.ok(headers.includes(height), `Utility heading ${level} height`);
    }

    assert.doesNotMatch(headers, /--sf-text-height-/);
});

test("role selectors and heading flow spacing use public semantic variables", () => {
    const typography = read("src/core/scss/_sf_css__typograpy.scss");
    const styles = read("src/core/figma_variables/figma_typography_styles.scss");
    const fontSize = read(
        "src/utility/font-size/default/scss/_sf_css__font_size.scss",
    );

    assert.match(typography, /\.body-text-small[\s\S]*--sf-text-small--size/);
    assert.match(typography, /\.body-text(?:,|\s*\{)[\s\S]*--sf-text-medium--size/);
    assert.match(typography, /\.body-text-large[\s\S]*--sf-text-large--size/);
    assert.match(styles, /\.sf-body-large[\s\S]*--sf-text-large--size[\s\S]*--sf-text-large--height/);
    assert.match(styles, /\.sf-label-medium[\s\S]*--sf-label-medium--size[\s\S]*--sf-label-medium--height/);
    assert.match(styles, /margin-block-start:\s*var\(--sf-heading--space-top\)/);
    assert.match(styles, /margin-block-end:\s*var\(--sf-heading--space-bottom\)/);
    assert.doesNotMatch(styles.split("  .sf-body-large")[0], /&\s*\+\s*\*/);
    assert.match(fontSize, /\.heading[\s\S]*--sf-title--height-/);
});

test("first-party source contains no literal 13px typography value", () => {
    const roots = ["src/core", "src/utility", "src/component", "src/smart"];
    const matches = [];

    function visit(path)
    {
        for (const entry of fs.readdirSync(path, { withFileTypes: true }))
        {
            const absolute = `${path}/${entry.name}`;
            if (entry.isDirectory())
            {
                if (["vendor", "vendors"].includes(entry.name)) continue;
                visit(absolute);
            }
            else if (/\.(?:css|scss|sass|less|js|mjs|ts)$/.test(entry.name))
            {
                if (absolute.endsWith("src/core/scss/vars/_sf_var__size.scss"))
                {
                    continue;
                }
                const source = fs.readFileSync(absolute, "utf8");
                if (/(?:^|[^0-9.])13px(?:[^0-9.]|$)/.test(source))
                {
                    matches.push(absolute.replace(`${repositoryPath(".")}/`, ""));
                }
            }
        }
    }

    for (const root of roots) visit(repositoryPath(root));
    assert.deepEqual(matches, []);
});
