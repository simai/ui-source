import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    aliasPx,
    contract,
    contractSha256,
    repositoryPath,
    validateContract,
} from "./adaptive-sizing-contract-lib.mjs";

validateContract();

const escapedRole = role => role.replaceAll("/", "\\/");
const aliasValue = alias => alias === "zero" ? "0" : `var(--sf-${alias})`;
const roleNumber = role => {
    if (!role.includes("/")) return Number(role);
    const [numerator, denominator] = role.split("/").map(Number);
    return numerator / denominator;
};
const orderedEntries = aliases => Object.entries(aliases).sort(
    ([left], [right]) => roleNumber(left) - roleNumber(right),
);
const header = [
    "/*",
    " * Generated from src/core/contracts/adaptive-sizing.v1.json.",
    ` * contract-sha256: ${contractSha256}`,
    " * Do not edit semantic values in this file directly.",
    " */",
].join("\n");

function renderAliasProjection(variablePrefix, aliases, compatibilityPrefix = null)
{
    const declarations = (mode, indentation) => {
        const canonical = orderedEntries(aliases).map(
            ([role, value]) =>
                `${indentation}--sf-${variablePrefix}-${escapedRole(role)}: ${aliasValue(value[mode])};`,
        );
        const compatibility = compatibilityPrefix === null
            ? []
            : orderedEntries(aliases).map(([role]) => {
                const escaped = escapedRole(role);
                return `${indentation}--sf-${compatibilityPrefix}-${escaped}: var(--sf-${variablePrefix}-${escaped});`;
            });

        return [...canonical, ...compatibility].join("\n");
    };

    return `${header}
@layer sf.base {
  :root {
${declarations("mobile", "    ")}
  }

  @media (min-width: ${contract.modes.desktop.minWidthPx}px) {
    :root {
${declarations("desktop", "      ")}
    }
  }
}
`;
}

function renderSemanticRoles()
{
    const declarations = [];
    const roleTokenPrefix = {
        body: "text",
        display: "display",
        heading: "heading",
        label: "label",
    };

    for (const [group, definitions] of Object.entries(contract.typography.roles))
    {
        for (const [role, definition] of Object.entries(definitions))
        {
            const prefix = roleTokenPrefix[group];
            const heightFamily = ["heading", "display"].includes(group)
                ? "title--height"
                : "text--height";
            declarations.push(
                `    --sf-${prefix}-${role}--size: var(--sf-text--size-${escapedRole(definition.size)});`,
                `    --sf-${prefix}-${role}--height: var(--sf-${heightFamily}-${escapedRole(definition.height)});`,
            );
        }
    }

    const flow = contract.typography.flowSpacing;
    for (const [role, spacingRole] of Object.entries(flow.content))
    {
        declarations.push(
            `    --sf-content--space-${role}: var(--sf-space-${escapedRole(spacingRole)});`,
        );
    }
    declarations.push(
        "    --sf-text--space-bottom: var(--sf-content--space-text);",
        "    --sf-heading--space-top: var(--sf-content--space-section);",
        "    --sf-heading--space-bottom: var(--sf-content--space-text);",
        "    --sf-heading--margin: var(--sf-heading--space-top);",
    );

    return `${header}
@layer sf.base {
  :root {
${declarations.join("\n")}
  }
}
`;
}

function renderContentSpacingDocumentationProjection()
{
    const descriptions = {
        text: "ordinary text rhythm",
        related: "closely related elements inside one composition",
        block: "independent content blocks inside one section",
        section: "transition to a new content section",
    };
    const publicTokens = Object.entries(
        contract.typography.flowSpacing.content,
    ).map(([role, spacingRole]) => ({
        role,
        token: `--sf-content--space-${role}`,
        spacing_role: spacingRole,
        mobile_px: aliasPx(contract.spacing[spacingRole].mobile),
        desktop_px: aliasPx(contract.spacing[spacingRole].desktop),
        purpose: descriptions[role],
    }));

    return `${JSON.stringify({
        schema_version: "sf.content-spacing.docs.v1",
        source: {
            contract_id: contract.meta.contractId,
            contract_version: contract.meta.version,
            contract_sha256: contractSha256,
        },
        ownership: {
            token_values: "simai/ui-source",
            relationship_selection: "consumer parent flow",
            component_outer_margin: "none by default",
        },
        public_tokens: publicTokens,
        compatibility_bindings: {
            "--sf-text--space-bottom": "--sf-content--space-text",
            "--sf-heading--space-top": "--sf-content--space-section",
            "--sf-heading--space-bottom": "--sf-content--space-text",
            "--sf-heading--margin": "--sf-heading--space-top",
        },
    }, null, 2)}\n`;
}

function renderTightnessProjection(tightness)
{
    const aliases = contract.controls.tightness[tightness];
    const declarations = (mode, indentation) => orderedEntries(aliases).map(
        ([size, value]) =>
            `${indentation}--sf-ui-${escapedRole(size)}--space-y-tightness-${tightness}: ${aliasValue(value[mode])};`,
    ).join("\n");

    return `${header}
@layer sf.base {
  :root {
${declarations("mobile", "    ")}
  }

  @media (min-width: ${contract.modes.desktop.minWidthPx}px) {
    :root {
${declarations("desktop", "      ")}
    }
  }
}
`;
}

function renderControlHeightProjection()
{
    const declarations = orderedEntries(contract.controls.sizeRoles).map(
        ([size, definition]) => {
            const escapedSize = escapedRole(size);
            const escapedLineHeight = escapedRole(definition.lineHeightRole);

            return `    --sf-ui-${escapedSize}--control-height: calc(var(--sf-text--height-${escapedLineHeight}) + 2 * var(--sf-ui-${escapedSize}--space-y-tightness-default));`;
        },
    ).join("\n");

    return `${header}
@layer sf.base {
  :root {
${declarations}
  }
}
`;
}

export function projections()
{
    const paths = contract.projections.scss;

    return new Map([
        [
            paths.typographySizes,
            renderAliasProjection(
                "text--size",
                contract.typography.sizes,
                "text-size",
            ),
        ],
        [
            paths.typographyLineHeights,
            renderAliasProjection(
                "text--height",
                contract.typography.lineHeights,
                "text-height",
            ),
        ],
        [
            paths.typographyTitleLineHeights,
            renderAliasProjection(
                "title--height",
                contract.typography.titleLineHeights,
                "title-height",
            ),
        ],
        [paths.typographyRoles, renderSemanticRoles()],
        [paths.spacing, renderAliasProjection("space", contract.spacing)],
        [paths.tightnessLow, renderTightnessProjection("low")],
        [paths.tightnessDefault, renderTightnessProjection("default")],
        [paths.tightnessHigh, renderTightnessProjection("high")],
        [paths.tightnessHighest, renderTightnessProjection("highest")],
        [paths.controlHeights, renderControlHeightProjection()],
        [
            contract.projections.documentationContentSpacing,
            renderContentSpacingDocumentationProjection(),
        ],
    ]);
}

if (process.argv[1]
    && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
{
    const argumentsReceived = new Set(process.argv.slice(2));
    const checkOnly = argumentsReceived.has("--check");
    const printHash = argumentsReceived.has("--print-hash");
    const unexpectedArguments = [...argumentsReceived].filter(
        argument => !["--check", "--print-hash"].includes(argument),
    );

    if (unexpectedArguments.length > 0)
    {
        throw new Error(
            `unexpected arguments: ${unexpectedArguments.join(", ")}`,
        );
    }

    const mismatches = [];
    for (const [relativePath, expected] of projections())
    {
        const outputPath = repositoryPath(relativePath);

        if (checkOnly)
        {
            const actual = fs.existsSync(outputPath)
                ? fs.readFileSync(outputPath, "utf8")
                : null;
            if (actual !== expected) mismatches.push(relativePath);
        }
        else
        {
            fs.writeFileSync(outputPath, expected);
        }
    }

    if (mismatches.length > 0)
    {
        process.stderr.write(
            `adaptive sizing projections are stale:\n${mismatches.join("\n")}\n`,
        );
        process.exitCode = 1;
    }
    else if (printHash || checkOnly)
    {
        process.stdout.write(`${contractSha256}\n`);
    }
}
