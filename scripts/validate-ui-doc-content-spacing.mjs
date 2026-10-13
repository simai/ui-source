import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    contract,
    repositoryPath,
} from "./adaptive-sizing-contract-lib.mjs";

const expectedProjectionPath = repositoryPath(
    contract.projections.documentationContentSpacing,
);
const expectedProjection = fs.readFileSync(expectedProjectionPath);
const expected = JSON.parse(expectedProjection.toString("utf8"));

const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");

export class UiDocContentSpacingError extends Error
{
    constructor(code, sourcePath, expectedValue = null, actualValue = null)
    {
        super(code);
        this.name = "UiDocContentSpacingError";
        this.code = code;
        this.sourcePath = sourcePath;
        this.expected = expectedValue;
        this.actual = actualValue;
    }

    diagnostic()
    {
        return {
            code: this.code,
            path: this.sourcePath,
            expected: this.expected,
            actual: this.actual,
        };
    }
}

function fail(code, sourcePath, expectedValue = null, actualValue = null)
{
    throw new UiDocContentSpacingError(
        code,
        sourcePath,
        expectedValue,
        actualValue,
    );
}

function requireFile(filePath, root)
{
    if (!fs.existsSync(filePath))
    {
        fail(
            "UI_DOC_REQUIRED_FILE_MISSING",
            path.relative(root, filePath),
            "existing file",
            "missing",
        );
    }
}

function documentedTuples(guide)
{
    const rows = new Map();
    for (const line of guide.split(/\r?\n/u))
    {
        const cells = line.split("|").slice(1, -1).map(cell => cell.trim());
        if (cells.length !== 5)
        {
            continue;
        }
        const tokenMatch = cells[0].match(/^`([^`]+)`$/u);
        const roleMatch = cells[1].match(/^`([^`]+)`$/u);
        const mobileMatch = cells[3].match(/^(\d+)px$/u);
        const desktopMatch = cells[4].match(/^(\d+)px$/u);
        if (!tokenMatch || !roleMatch || !mobileMatch || !desktopMatch)
        {
            continue;
        }
        const tuple = {
            token: tokenMatch[1],
            role: roleMatch[1],
            mobile_px: Number(mobileMatch[1]),
            desktop_px: Number(desktopMatch[1]),
        };
        const tokenRows = rows.get(tuple.token) ?? [];
        tokenRows.push(tuple);
        rows.set(tuple.token, tokenRows);
    }
    return rows;
}

export function validateUiDocRoot(uiDocRoot)
{
    let root;
    try
    {
        root = fs.realpathSync(uiDocRoot);
    }
    catch
    {
        fail("UI_DOC_ROOT_INVALID", "ui-doc-root", "existing directory", uiDocRoot);
    }
    // «Интервалы» became a section on 2026-10-09 -- a rule with its table of
    // values beside it -- so the page moved from spacing.md to spacing/index.md.
    // Both spellings are accepted rather than one being chosen, because this
    // validator runs against a PINNED ui-doc revision: pick one and the gate
    // breaks on every checkout from the other side of the move, which is how it
    // went red this morning (owner, 2026-10-09).
    // The single guide tree (2026-10-13) moved it again, to size-and-type/.
    const guidePath = [
        "content/ru/guide/size-and-type/spacing.md",
        "content/ru/guide/fundamentals/spacing/index.md",
        "content/ru/guide/fundamentals/spacing.md",
    ]
        .map((candidate) => path.join(root, candidate))
        .find((candidate) => fs.existsSync(candidate))
        ?? path.join(root, "content/ru/guide/fundamentals/spacing/index.md");

    requireFile(guidePath, root);

    const guide = fs.readFileSync(guidePath, "utf8");
    const rows = documentedTuples(guide);
    for (const token of expected.public_tokens)
    {
        const expectedTuple = {
            token: token.token,
            role: token.role,
            mobile_px: token.mobile_px,
            desktop_px: token.desktop_px,
        };
        const actualRows = rows.get(token.token) ?? [];
        if (actualRows.length === 0)
        {
            fail(
                "UI_DOC_TUPLE_MISSING",
                path.relative(root, guidePath),
                expectedTuple,
                null,
            );
        }
        if (actualRows.length !== 1)
        {
            fail(
                "UI_DOC_TUPLE_DUPLICATE",
                path.relative(root, guidePath),
                expectedTuple,
                actualRows,
            );
        }
        if (JSON.stringify(actualRows[0]) !== JSON.stringify(expectedTuple))
        {
            fail(
                "UI_DOC_TUPLE_MISMATCH",
                path.relative(root, guidePath),
                expectedTuple,
                actualRows[0],
            );
        }
    }

    return {
        status: "pass",
        contract_id: expected.source.contract_id,
        contract_version: expected.source.contract_version,
        contract_sha256: expected.source.contract_sha256,
        projection_sha256: sha256(expectedProjection),
        validated_tuple_count: expected.public_tokens.length,
        guide: path.relative(root, guidePath),
    };
}

if (process.argv[1]
    && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
{
    const args = process.argv.slice(2);
    const rootIndex = args.indexOf("--ui-doc-root");
    const root = rootIndex >= 0 ? args[rootIndex + 1] : process.env.UI_DOC_ROOT;
    if (!root)
    {
        process.stderr.write(`${JSON.stringify({
            status: "fail",
            diagnostic: {
                code: "UI_DOC_ROOT_REQUIRED",
                path: "ui-doc-root",
                expected: "--ui-doc-root or UI_DOC_ROOT",
                actual: null,
            },
        })}\n`);
        process.exit(2);
    }
    try
    {
        process.stdout.write(`${JSON.stringify(validateUiDocRoot(root), null, 2)}\n`);
    }
    catch (error)
    {
        const diagnostic = error instanceof UiDocContentSpacingError
            ? error.diagnostic()
            : {
                code: "UI_DOC_VALIDATION_FAILED",
                path: "ui-doc-root",
                expected: "valid documentation contract",
                actual: error.message,
            };
        process.stderr.write(`${JSON.stringify({ status: "fail", diagnostic })}\n`);
        process.exit(1);
    }
}
