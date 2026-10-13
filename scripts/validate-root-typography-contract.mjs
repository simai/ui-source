import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const typographyPath = path.join(
    repositoryRoot,
    "src/core/scss/_sf_css__typograpy.scss",
);
const corePath = path.join(repositoryRoot, "src/core/scss/index.scss");
const textSizePath = path.join(
    repositoryRoot,
    "src/core/figma_variables/figma_text_text_size.scss",
);
const textHeightPath = path.join(
    repositoryRoot,
    "src/core/figma_variables/figma_text_body_text_height.scss",
);
const breakpointPath = path.join(
    repositoryRoot,
    "src/core/scss/vars/_sf_var__breakpoint.scss",
);

function read(relativePath)
{
    return fs.readFileSync(relativePath, "utf8");
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

const typography = read(typographyPath);
const core = read(corePath);
const rootLines = activeLines(selectorBlock(typography, ":root"));
const bodyLines = activeLines(selectorBlock(typography, "body"));
const defaultDeclarations = [
    "font-style: var(--sf-text--style);",
    "font-size: var(--sf-text--size);",
    "line-height: var(--sf-text--height);",
    "font-weight: var(--sf-text--weight);",
    "font-family: var(--sf-text--family);",
    "letter-spacing: var(--sf-text--tracking);",
    "text-decoration-color: var(--sf-outline);",
];

for (const declaration of defaultDeclarations)
{
    assert.equal(
        rootLines.includes(declaration),
        false,
        `root must not own ${declaration}`,
    );
    assert.equal(
        bodyLines.filter(line => line === declaration).length,
        1,
        `body must own ${declaration} exactly once`,
    );
}

for (const property of [
    "--sf-text--size: var(--sf-text--size-1);",
    "--sf-text--height: var(--sf-text--height-1);",
    "--sf-text--style: inherit;",
    "--sf-text--tracking: inherit;",
])
{
    assert.equal(rootLines.includes(property), true, `missing root token: ${property}`);
}

assert.doesNotMatch(
    typography,
    /(?:^|[}\n])\s*(?:html|:root\s*,\s*html)\s*{[^}]*\bfont-size\s*:/s,
    "Framework source must not assign an html font size",
);

const textSize = read(textSizePath);
const textHeight = read(textHeightPath);
const breakpoints = read(breakpointPath);

for (const source of [textSize, textHeight])
{
    assert.match(source, /@media \(min-width: 60rem\)/);
}

assert.match(textSize, /--sf-text--size-1:\s*var\(--sf-b4\);/);
assert.match(textSize, /--sf-text-size-1:\s*var\(--sf-text--size-1\);/);
assert.match(textSize, /@media \(min-width: 60rem\)[\s\S]*--sf-text--size-1:\s*var\(--sf-b6\);/);
assert.match(textHeight, /--sf-text--height-1:\s*var\(--sf-c0\);/);
assert.match(textHeight, /--sf-text-height-1:\s*var\(--sf-text--height-1\);/);
assert.match(textHeight, /@media \(min-width: 60rem\)[\s\S]*--sf-text--height-1:\s*var\(--sf-c2\);/);
assert.match(breakpoints, /lg:\s*60rem/);
assert.match(breakpoints, /desktop:\s*\$breakpoint-desktop/);

for (const familyToken of [
    "--sf-text--family",
    "--sf-heading--family",
    "--sf-display--family",
])
{
    assert.match(
        typography,
        new RegExp(`${familyToken}:\\s*\"Inter Variable\",\\s*\"Inter Fallback\",\\s*sans-serif;`),
        `missing metric-compatible fallback in ${familyToken}`,
    );
}

assert.match(core, /font-family:\s*['\"]Inter Fallback['\"]/);
assert.match(core, /src:\s*local\(['\"]Arial['\"]\)/);
assert.match(core, /ascent-override:\s*90\.2%/);
assert.match(core, /descent-override:\s*22\.48%/);
assert.match(core, /line-gap-override:\s*0%/);
assert.match(core, /size-adjust:\s*107\.4%/);

process.stdout.write(`${JSON.stringify({
    status: "PASS",
    rootOwnsDefaultTypography: false,
    bodyDefaultDeclarationCount: defaultDeclarations.length,
    breakpoint: "60rem",
    mobile: {
        textHeight: "var(--sf-c0)",
        textSize: "var(--sf-b4)",
    },
    desktop: {
        textHeight: "var(--sf-c2)",
        textSize: "var(--sf-b6)",
    },
    webfontFallback: "metric-compatible",
})}\n`);
