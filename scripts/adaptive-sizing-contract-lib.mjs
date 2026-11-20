import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
export const contractPath = path.join(
    repositoryRoot,
    "src/core/contracts/adaptive-sizing.v1.json",
);
export const schemaPath = path.join(
    repositoryRoot,
    "src/core/contracts/adaptive-sizing.schema.json",
);
export const rawContract = fs.readFileSync(contractPath);
export const contract = JSON.parse(rawContract.toString("utf8"));
export const contractSha256 = crypto
    .createHash("sha256")
    .update(rawContract)
    .digest("hex");

const expectedTopLevel = [
    "$schema",
    "controls",
    "invariants",
    "measure",
    "meta",
    "modes",
    "primitives",
    "projections",
    "scope",
    "spacing",
    "typography",
];
const expectedRanges = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
// Title line steps named for the one title that reads them, after rungs 1..12.
// They have no 5.x compatibility alias (--sf-title-height-*).
export const namedTitleSteps = ["card"];
const forbiddenContractKeys = new Set([
    "containerGutter",
    "containerWidth",
    "inlinePadding",
    "leadingSlot",
    "menuIndentation",
    "nestedMenuStep",
]);

export function primitiveValues(candidate = contract)
{
    const values = new Map([["zero", 0]]);

    for (const [rangeName, range] of Object.entries(candidate.primitives))
    {
        for (let index = 0; index < range.count; index += 1)
        {
            values.set(
                `${rangeName}${index}`,
                range.startPx + range.stepPx * index,
            );
        }
    }

    return values;
}

export function aliasPx(alias, candidate = contract)
{
    const value = primitiveValues(candidate).get(alias);
    assert.notEqual(value, undefined, `unknown primitive alias: ${alias}`);
    return value;
}

function validateAliasMap(aliasMap, label, candidate)
{
    for (const [role, aliases] of Object.entries(aliasMap))
    {
        assert.deepEqual(
            Object.keys(aliases).sort(),
            ["desktop", "mobile"],
            `${label}.${role} must define mobile and desktop only`,
        );
        aliasPx(aliases.mobile, candidate);
        aliasPx(aliases.desktop, candidate);
    }
}

// The width ladder in characters (owner decision C396): a step is N times
// half the body text size. The steps grow, every step at the desktop's text
// (the nominal 16) is a point of the base ladder, and a role names a step.
export function measurePx(steps, candidate = contract, mode = "desktop")
{
    const measure = candidate.measure;
    const text = aliasPx(candidate.typography.sizes[measure.char.textSize][mode], candidate);
    return steps.map(step => step * text / measure.char.divisor);
}

function validateMeasure(candidate)
{
    const measure = candidate.measure;
    assert.ok(measure && Array.isArray(measure.steps), "measure.steps is required");
    assert.ok(
        candidate.typography.sizes[measure.char.textSize],
        `measure.char.textSize ${measure.char.textSize} is not a text size`,
    );
    assert.ok(Number.isInteger(measure.char.divisor) && measure.char.divisor > 0);
    measure.steps.forEach((step, index) => {
        assert.ok(Number.isInteger(step) && step > 0, `measure step ${step}`);
        if (index > 0) assert.ok(step > measure.steps[index - 1], "measure steps must grow");
    });
    const points = new Set(primitiveValues(candidate).values());
    measurePx(measure.steps, candidate).forEach((px, index) => assert.ok(
        points.has(px),
        `measure step ${measure.steps[index]} is ${px}px at the desktop text, not a point of the base ladder`,
    ));
    for (const [role, step] of Object.entries(measure.roles))
    {
        assert.ok(measure.steps.includes(step), `measure role ${role} names ${step}, not a step`);
    }
}

function rejectForbiddenKeys(value, trail = [])
{
    if (!value || typeof value !== "object") return;

    for (const [key, child] of Object.entries(value))
    {
        assert.equal(
            forbiddenContractKeys.has(key),
            false,
            `horizontal field is forbidden: ${[...trail, key].join(".")}`,
        );
        rejectForbiddenKeys(child, [...trail, key]);
    }
}

export function validateContract(candidate = contract)
{
    assert.deepEqual(
        Object.keys(candidate).sort(),
        expectedTopLevel,
        "unexpected top-level contract fields",
    );
    assert.equal(candidate.meta.contractId, "simai.vertical-sizing");
    assert.match(candidate.meta.version, /^\d+\.\d+\.\d+$/);
    assert.equal(candidate.meta.unit, "rem");
    assert.equal(candidate.meta.nominalRootPx, 16);
    assert.equal(candidate.meta.rootPolicy, "preserve-user-agent-default");
    assert.equal(candidate.modes.mobile.minWidthPx, 0);
    assert.equal(candidate.modes.desktop.minWidthPx, 960);
    assert.deepEqual(Object.keys(candidate.primitives), expectedRanges);

    let previousEnd = -1;
    for (const rangeName of expectedRanges)
    {
        const range = candidate.primitives[rangeName];
        assert.equal(range.count, 10);
        assert.ok(Number.isInteger(range.startPx) && range.startPx >= 0);
        assert.ok(Number.isInteger(range.stepPx) && range.stepPx > 0);
        assert.ok(
            range.startPx > previousEnd,
            `primitive range ${rangeName} must not overlap previous range`,
        );
        previousEnd = range.startPx + range.stepPx * (range.count - 1);
    }

    validateAliasMap(candidate.typography.sizes, "typography.sizes", candidate);
    validateAliasMap(
        candidate.typography.lineHeights,
        "typography.lineHeights",
        candidate,
    );
    validateAliasMap(
        candidate.typography.titleLineHeights,
        "typography.titleLineHeights",
        candidate,
    );
    validateAliasMap(candidate.spacing, "spacing", candidate);
    validateMeasure(candidate);

    const titleRoles = Array.from({ length: 12 }, (_, index) => String(index + 1));
    assert.deepEqual(
        Object.keys(candidate.typography.titleLineHeights),
        [...titleRoles, ...namedTitleSteps],
        "title line heights must cover roles 1..12 in order, then the named steps",
    );
    // The card title line (owner decision C89, 2026-11-12): 24 on a desktop as
    // rung 2, 20 on a phone as rung 3 -- the line of 14 px text on a phone,
    // where rung 2 gives 18. It stands between the two rungs in both modes.
    const titleLine = (step, mode) => aliasPx(
        candidate.typography.titleLineHeights[step][mode],
        candidate,
    );
    for (const mode of ["mobile", "desktop"])
    {
        assert.ok(
            titleLine("2", mode) <= titleLine("card", mode)
            && titleLine("card", mode) <= titleLine("3", mode),
            `title line card must stand between rungs 2 and 3 (${mode})`,
        );
    }

    for (const role of candidate.typography.pairedRoles)
    {
        assert.ok(candidate.typography.sizes[role], `missing size role ${role}`);
        assert.ok(
            candidate.typography.lineHeights[role],
            `missing line-height role ${role}`,
        );
    }
    for (const role of candidate.typography.unpairedSizeRoles)
    {
        assert.ok(candidate.typography.sizes[role]);
        assert.equal(candidate.typography.lineHeights[role], undefined);
    }

    const expectedSemanticRoles = {
        body: ["small", "medium", "large"],
        display: ["1", "2", "3", "4", "5", "6"],
        heading: ["1", "2", "3", "4", "5", "6"],
        label: ["small", "medium", "large"],
    };
    assert.deepEqual(
        Object.keys(candidate.typography.roles).sort(),
        Object.keys(expectedSemanticRoles).sort(),
        "semantic typography role groups must be exact",
    );
    for (const [group, expectedRoles] of Object.entries(expectedSemanticRoles))
    {
        const definitions = candidate.typography.roles[group];
        assert.deepEqual(
            Object.keys(definitions),
            expectedRoles,
            `semantic typography ${group} roles must be exact and ordered`,
        );
        for (const [role, definition] of Object.entries(definitions))
        {
            if ("fixedSize" in definition)
            {
                // Pinned to primitives, the same value in both modes.
                assert.deepEqual(
                    Object.keys(definition).filter(key => key !== "note").sort(),
                    ["fixedHeight", "fixedSize"],
                    `semantic typography ${group}.${role} must pin size and height`,
                );
                aliasPx(definition.fixedSize, candidate);
                aliasPx(definition.fixedHeight, candidate);
                if ("note" in definition)
                {
                    assert.ok(
                        Array.isArray(definition.note)
                        && definition.note.every(line => typeof line === "string"),
                        `semantic typography ${group}.${role} note must be lines`,
                    );
                }
                continue;
            }
            // A role may take another line on a phone (mobileHeight, owner
            // decision C186 (13): h3 18/24 on a phone, 24/28 on a desktop).
            assert.deepEqual(
                Object.keys(definition).filter(key => !["mobileHeight", "note"].includes(key)).sort(),
                ["height", "size"],
                `semantic typography ${group}.${role} must bind size and height`,
            );
            if ("note" in definition)
            {
                assert.ok(
                    Array.isArray(definition.note)
                    && definition.note.every(line => typeof line === "string"),
                    `semantic typography ${group}.${role} note must be lines`,
                );
            }
            assert.ok(
                candidate.typography.sizes[definition.size],
                `semantic typography ${group}.${role} has unknown size`,
            );
            const heightMap = ["heading", "display"].includes(group)
                ? candidate.typography.titleLineHeights
                : candidate.typography.lineHeights;
            assert.ok(
                heightMap[definition.height],
                `semantic typography ${group}.${role} has unknown height`,
            );
            if ("mobileHeight" in definition)
            {
                assert.ok(
                    heightMap[definition.mobileHeight],
                    `semantic typography ${group}.${role} has unknown mobile height`,
                );
            }
        }
    }

    assert.deepEqual(
        Object.keys(candidate.typography.flowSpacing).sort(),
        ["content", "headingBottom", "headingTop", "textBottom"],
        "typography flow spacing keys must be exact",
    );
    const contentSpacing = candidate.typography.flowSpacing.content;
    assert.deepEqual(
        Object.keys(contentSpacing),
        ["text", "related", "block", "section"],
        "content flow spacing roles must be exact and ordered",
    );
    for (const [name, spacingRole] of Object.entries(contentSpacing))
    {
        assert.ok(
            candidate.spacing[spacingRole],
            `unknown content.${name} spacing role`,
        );
    }
    assert.equal(candidate.typography.flowSpacing.textBottom, contentSpacing.text);
    assert.equal(candidate.typography.flowSpacing.headingTop, contentSpacing.section);
    assert.equal(candidate.typography.flowSpacing.headingBottom, contentSpacing.text);

    const controlSizes = Object.keys(candidate.controls.sizeRoles);
    for (const [size, definition] of Object.entries(
        candidate.controls.sizeRoles,
    ))
    {
        assert.ok(
            candidate.typography.lineHeights[definition.lineHeightRole],
            `control ${size} has unknown line-height role`,
        );
    }
    for (const [tightness, aliases] of Object.entries(
        candidate.controls.tightness,
    ))
    {
        assert.deepEqual(
            Object.keys(aliases),
            controlSizes,
            `tightness ${tightness} must cover every control size`,
        );
        validateAliasMap(aliases, `controls.tightness.${tightness}`, candidate);
    }

    assert.equal(candidate.invariants.browserRemStableAcrossModes, true);
    assert.equal(candidate.invariants.modeSwitchCount, 1);
    assert.equal(
        candidate.invariants.controlHeightFormula,
        "lineHeight + 2 * blockPadding",
    );
    assert.equal(
        candidate.invariants.structuralBorderAccounting,
        "inside-control-height",
    );
    assert.equal(candidate.invariants.maxCrossControlErrorCssPx, 0.5);

    const requiredExclusions = [
        "menu-indentation",
        "leading-slot-alignment",
        "inline-padding-parity",
        "container-gutters",
        "container-width",
        "cross-component-horizontal-relations",
    ];
    for (const exclusion of requiredExclusions)
    {
        assert.ok(candidate.scope.excluded.includes(exclusion));
        assert.equal(candidate.scope.included.includes(exclusion), false);
    }

    rejectForbiddenKeys(candidate);
    return candidate;
}

export function computedControlHeights(candidate = contract)
{
    const result = {};

    for (const mode of ["mobile", "desktop"])
    {
        result[mode] = {};
        for (const [tightness, paddings] of Object.entries(
            candidate.controls.tightness,
        ))
        {
            result[mode][tightness] = {};
            for (const [size, sizeDefinition] of Object.entries(
                candidate.controls.sizeRoles,
            ))
            {
                const lineHeight = aliasPx(
                    candidate.typography.lineHeights[
                        sizeDefinition.lineHeightRole
                    ][mode],
                    candidate,
                );
                const padding = aliasPx(paddings[size][mode], candidate);
                result[mode][tightness][size] = lineHeight + 2 * padding;
            }
        }
    }

    return result;
}

export function repositoryPath(relativePath)
{
    return path.join(repositoryRoot, relativePath);
}
