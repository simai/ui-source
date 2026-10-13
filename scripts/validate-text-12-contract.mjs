import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);

function read(relativePath)
{
    return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function selectorBlock(source, selector)
{
    const marker = `\n  ${selector} {`;
    const markerIndex = source.indexOf(marker);

    assert.notEqual(markerIndex, -1, `missing selector: ${selector}`);
    assert.equal(
        source.indexOf(marker, markerIndex + marker.length),
        -1,
        `duplicate selector: ${selector}`,
    );

    const openIndex = source.indexOf("{", markerIndex);
    let depth = 0;

    for (let index = openIndex; index < source.length; index += 1)
    {
        if (source[index] === "{")
        {
            depth += 1;
        }
        else if (source[index] === "}")
        {
            depth -= 1;

            if (depth === 0)
            {
                return source.slice(openIndex + 1, index);
            }
        }
    }

    assert.fail(`unterminated selector: ${selector}`);
}

function activeLines(block)
{
    return block
        .split("\n")
        .map(line => line.replace(/\/\/.*$/, "").trim())
        .filter(Boolean);
}

const typography = read("src/core/figma_variables/figma_typography_styles.scss");
const textSize = read("src/core/figma_variables/figma_text_text_size.scss");
const textHeight = read("src/core/figma_variables/figma_text_body_text_height.scss");
const primitiveSize = read("src/core/scss/vars/_sf_var__size.scss");
const suffixes = [
    "1\\/4",
    "1\\/3",
    "1\\/2",
    ...Array.from({ length: 12 }, (_, index) => String(index + 1)),
];

for (const suffix of suffixes)
{
    const lines = activeLines(selectorBlock(typography, `.sf-text-${suffix}`));

    assert.equal(
        lines.filter(line => line === `font-size: var(--sf-text-size-${suffix});`).length,
        1,
        `.sf-text-${suffix} must own its matching size token exactly once`,
    );
    assert.equal(
        lines.filter(line => line === `line-height: var(--sf-text-height-${suffix});`).length,
        1,
        `.sf-text-${suffix} must own its matching height token exactly once`,
    );
}

assert.doesNotMatch(
    selectorBlock(typography, ".sf-text-12"),
    /line-height:\s*var\(--sf-text-size-12\)/,
    ".sf-text-12 must not use its size token as line-height",
);

assert.match(textSize, /--sf-text--size-12:\s*var\(--sf-d2\);/);
assert.match(textSize, /--sf-text-size-12:\s*var\(--sf-text--size-12\);/);
assert.match(
    textSize,
    /@media \(min-width: 60rem\)[\s\S]*--sf-text--size-12:\s*var\(--sf-e0\);/,
);
assert.match(textHeight, /--sf-text--height-12:\s*var\(--sf-d8\);/);
assert.match(textHeight, /--sf-text-height-12:\s*var\(--sf-text--height-12\);/);
assert.match(
    textHeight,
    /@media \(min-width: 60rem\)[\s\S]*--sf-text--height-12:\s*var\(--sf-e5\);/,
);

for (const primitive of [
    /2:\s*3rem,\s*\/\/ 48px/,
    /8:\s*4\.5rem,\s*\/\/ 72px/,
    /0:\s*5rem,\s*\/\/ 80px/,
    /5:\s*7\.5rem,\s*\/\/ 120px/,
])
{
    assert.match(primitiveSize, primitive);
}

process.stdout.write(`${JSON.stringify({
    status: "PASS",
    selector: ".sf-text-12",
    textSelectorsChecked: suffixes.length,
    binding: {
        fontSize: "var(--sf-text-size-12)",
        lineHeight: "var(--sf-text-height-12)",
    },
    breakpoint: "60rem",
    mobilePx: {
        fontSize: 48,
        lineHeight: 72,
    },
    desktopPx: {
        fontSize: 80,
        lineHeight: 120,
    },
})}\n`);
