import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
    computedControlHeights,
    contract,
    contractSha256,
    primitiveValues,
    repositoryPath,
    validateContract,
} from "../scripts/adaptive-sizing-contract-lib.mjs";
import { projections } from "../scripts/generate-adaptive-sizing-contract.mjs";
import {withoutPublicVariables} from './support/public-variables.mjs';

const cloneContract = () => structuredClone(contract);

test("the canonical vertical sizing contract is valid", () => {
    assert.equal(validateContract(), contract);
    assert.match(contractSha256, /^[a-f0-9]{64}$/);
    assert.equal(primitiveValues().size, 91);
    assert.equal(projections().size, 11);
});

// The contract is the single source of the generated sheets: a hand edit to a
// sheet that is not carried into the contract (or the generator) would be
// reverted by the next regeneration. Run the generator for real in a scratch
// copy and require the tree it writes to equal the tree in the repository.
test("regeneration leaves the generated sheets unchanged", () => {
    const outputs = [...projections().keys()];
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "sf-adaptive-sizing-"));
    try
    {
        const copied = [
            "scripts/generate-adaptive-sizing-contract.mjs",
            "scripts/adaptive-sizing-contract-lib.mjs",
            "src/core/contracts/adaptive-sizing.v1.json",
            ...outputs,
        ];
        for (const relativePath of copied)
        {
            const target = path.join(scratch, relativePath);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(repositoryPath(relativePath), target);
        }

        const run = spawnSync(
            process.execPath,
            [path.join(scratch, "scripts/generate-adaptive-sizing-contract.mjs")],
            { encoding: "utf8" },
        );
        assert.equal(run.status, 0, run.stderr);

        for (const relativePath of outputs)
        {
            assert.equal(
                fs.readFileSync(path.join(scratch, relativePath), "utf8"),
                fs.readFileSync(repositoryPath(relativePath), "utf8"),
                `regeneration changes ${relativePath}`,
            );
        }

        const check = spawnSync(
            process.execPath,
            [repositoryPath("scripts/generate-adaptive-sizing-contract.mjs"), "--check"],
            { encoding: "utf8" },
        );
        assert.equal(check.status, 0, check.stderr);
    }
    finally
    {
        fs.rmSync(scratch, { recursive: true, force: true });
    }
});

test("the desktop threshold is written in rem, as the breakpoint ladder is", () => {
    const rem = contract.modes.desktop.minWidthPx / contract.meta.nominalRootPx;
    for (const [relativePath, output] of projections())
    {
        if (!relativePath.endsWith(".scss")) continue;
        assert.doesNotMatch(output, /@media \(min-width: \d+px\)/u, relativePath);
        if (output.includes("@media"))
        {
            assert.match(output, new RegExp(`@media \\(min-width: ${rem}rem\\)`, "u"));
        }
    }
});

test("a pinned label role stays on its primitives in both modes", () => {
    const output = projections().get(contract.projections.scss.typographyRoles);
    const large = contract.typography.roles.label.large;
    assert.match(output, new RegExp(`--sf-label-large--size: var\\(--sf-${large.fixedSize}\\);`, "u"));
    assert.match(output, new RegExp(`--sf-label-large--height: var\\(--sf-${large.fixedHeight}\\);`, "u"));

    const candidate = cloneContract();
    candidate.typography.roles.label.large.fixedSize = "z9";
    assert.throws(() => validateContract(candidate), /unknown primitive alias/u);
});

test("content spacing roles are generated from one semantic contract", () => {
    const output = projections().get(
        contract.projections.scss.typographyRoles,
    );
    assert.deepEqual(contract.typography.flowSpacing.content, {
        text: "1",
        related: "2",
        block: "3",
        section: "4",
    });
    for (const role of ["text", "related", "block", "section"])
    {
        assert.match(
            output,
            new RegExp(`--sf-content--space-${role}: var\\(--sf-space-`),
        );
    }
    assert.match(
        output,
        /--sf-text--space-bottom: var\(--sf-content--space-text\)/,
    );
    assert.match(
        output,
        /--sf-heading--space-top: var\(--sf-content--space-section\)/,
    );
    assert.match(
        output,
        /--sf-heading--space-bottom: var\(--sf-content--space-text\)/,
    );
});

test("content spacing documentation projection is content-addressed", () => {
    const projection = JSON.parse(projections().get(
        contract.projections.documentationContentSpacing,
    ));
    assert.equal(projection.source.contract_sha256, contractSha256);
    assert.deepEqual(
        projection.public_tokens.map(({ role, mobile_px, desktop_px }) => ({
            role,
            mobile_px,
            desktop_px,
        })),
        [
            { role: "text", mobile_px: 12, desktop_px: 16 },
            { role: "related", mobile_px: 16, desktop_px: 20 },
            { role: "block", mobile_px: 16, desktop_px: 24 },
            { role: "section", mobile_px: 24, desktop_px: 32 },
        ],
    );
    assert.equal(
        projection.ownership.component_outer_margin,
        "none by default",
    );
});

test("control height projection is derived from adaptive vertical aliases", () => {
    const output = projections().get(
        contract.projections.scss.controlHeights,
    );
    for (const size of ["1/3", "1/2", "1", "2", "3"])
    {
        assert.match(
            output,
            new RegExp(
                `--sf-ui-${size.replace("/", "\\\\/")}--control-height: calc\\(`,
            ),
        );
    }
    assert.doesNotMatch(output, /padding-inline|space-x|menu|container/);
});

test("default control geometry preserves the accepted vertical matrix", () => {
    const heights = computedControlHeights();
    assert.deepEqual(heights.mobile.default, {
        "1/3": 24,
        "1/2": 28,
        "1": 36,
        "2": 44,
        "3": 52,
    });
    // Owner decision C27 (2026-11-09): desktop 1/3 default is 28 (a6), low 24.
    assert.deepEqual(heights.desktop.default, {
        "1/3": 28,
        "1/2": 32,
        "1": 40,
        "2": 48,
        "3": 56,
    });
});

test("representative controls bind to the vertical height contract", () => {
    const inputs = fs.readFileSync(repositoryPath(
        "src/component/inputs/scss/_css__inputs.scss",
    ), "utf8");
    const dropdown = fs.readFileSync(repositoryPath(
        "src/component/dropdown/scss/_css__dropdown.scss",
    ), "utf8");
    const textarea = withoutPublicVariables(fs.readFileSync(repositoryPath(
        "src/component/textarea/scss/_css__textarea.scss",
    ), "utf8"));
    const iconButtons = withoutPublicVariables(fs.readFileSync(repositoryPath(
        "src/component/icon-buttons/scss/_css_icon_buttons.scss",
    ), "utf8"));
    const smartIconButtonTemplate = fs.readFileSync(repositoryPath(
        "src/smart/button-icon/js/templates/default.js",
    ), "utf8");

    // Form fields have three sizes; icon buttons keep the whole scale because
    // they live outside fields too.
    for (const size of ["1/3", "1/2", "1", "2", "3"])
    {
        const escapedSize = size.replace("/", "\\/");
        const heightToken = `var(--sf-ui-${escapedSize}--control-height)`;
        const lineHeightToken = `var(--sf-text-height-${escapedSize})`;
        assert.ok(
            iconButtons.includes(lineHeightToken),
            `IconButton size ${size}`,
        );
        if (size === "1/3" || size === "3") continue;
        assert.ok(inputs.includes(heightToken), `Input size ${size}`);
        assert.ok(dropdown.includes(heightToken), `Dropdown size ${size}`);
        assert.ok(
            textarea.includes(
                `.sf-textarea.sf-textarea--size-${escapedSize} textarea[rows="1"] {\n  block-size: ${heightToken};`,
            ),
            `Textarea size ${size}`,
        );
    }

    assert.match(
        textarea,
        /padding-(?:top|bottom): calc\(var\(--sf-ui-[^)]+--space-y-tightness-default\) - var\(--sf-px\)\)/,
    );
    assert.match(
        smartIconButtonTemplate,
        /'flex',\s*'items-cross-center'/,
        "Smart IconButton must use the same vertical flex box model as Button",
    );
});

test("unknown primitive aliases fail closed", () => {
    const candidate = cloneContract();
    candidate.typography.sizes["1"].mobile = "z9";
    assert.throws(() => validateContract(candidate), /unknown primitive alias/);
});

test("incomplete typography pairs fail closed", () => {
    const candidate = cloneContract();
    delete candidate.typography.lineHeights["12"];
    assert.throws(() => validateContract(candidate), /missing line-height role 12/);
});

test("horizontal relation fields are rejected", () => {
    const candidate = cloneContract();
    candidate.controls.menuIndentation = {
        mobile: "c3",
        desktop: "c6",
    };
    assert.throws(() => validateContract(candidate), /horizontal field is forbidden/);
});
