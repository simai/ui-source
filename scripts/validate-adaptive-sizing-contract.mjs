import assert from "node:assert/strict";
import fs from "node:fs";
import {
    computedControlHeights,
    contract,
    contractSha256,
    primitiveValues,
    repositoryPath,
    validateContract,
} from "./adaptive-sizing-contract-lib.mjs";
import { projections } from "./generate-adaptive-sizing-contract.mjs";

validateContract();

const sizeSource = fs.readFileSync(
    repositoryPath("src/core/scss/vars/_sf_var__size.scss"),
    "utf8",
);
for (const [alias, px] of primitiveValues())
{
    if (alias === "zero") continue;
    const range = alias[0];
    const index = alias.slice(1);
    const rem = px / contract.meta.nominalRootPx;
    const pattern = new RegExp(
        `${index}:\\s*${String(rem).replace(".", "\\.")}rem`,
    );
    assert.match(
        sizeSource.slice(sizeSource.indexOf(`${range}: (`)),
        pattern,
        `primitive ${alias}=${rem}rem missing from Sass source`,
    );
}

const breakpointSource = fs.readFileSync(
    repositoryPath("src/core/scss/vars/_sf_var__breakpoint.scss"),
    "utf8",
);
assert.match(
    breakpointSource,
    new RegExp(`lg:\\s*${contract.modes.desktop.minWidthPx}px`),
);
assert.match(
    breakpointSource,
    /desktop:\s*\$breakpoint-desktop/,
);

for (const [relativePath, expected] of projections())
{
    assert.equal(
        fs.readFileSync(repositoryPath(relativePath), "utf8"),
        expected,
        `stale projection: ${relativePath}`,
    );
}

const heights = computedControlHeights();
assert.deepEqual(heights.mobile.default, {
    "1/3": 24,
    "1/2": 28,
    "1": 36,
    "2": 44,
    "3": 52,
});
assert.deepEqual(heights.desktop.default, {
    "1/3": 24,
    "1/2": 32,
    "1": 40,
    "2": 48,
    "3": 56,
});

process.stdout.write(`${JSON.stringify({
    contract_id: contract.meta.contractId,
    contract_version: contract.meta.version,
    contract_sha256: contractSha256,
    breakpoint_px: contract.modes.desktop.minWidthPx,
    primitive_count: primitiveValues().size - 1,
    typography_size_roles: Object.keys(contract.typography.sizes).length,
    typography_line_height_roles:
        Object.keys(contract.typography.lineHeights).length,
    spacing_roles: Object.keys(contract.spacing).length,
    control_sizes: Object.keys(contract.controls.sizeRoles).length,
    tightness_modes: Object.keys(contract.controls.tightness).length,
    default_control_heights_px: {
        mobile: heights.mobile.default,
        desktop: heights.desktop.default,
    },
    horizontal_contract_fields: 0,
}, null, 2)}\n`);
