import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
    contract,
    repositoryPath,
} from "../scripts/adaptive-sizing-contract-lib.mjs";
import {
    UiDocContentSpacingError,
    validateUiDocRoot,
} from "../scripts/validate-ui-doc-content-spacing.mjs";

const validator = repositoryPath("scripts/validate-ui-doc-content-spacing.mjs");

function fixture()
{
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sf-ui-doc-spacing-"));
    const docs = path.join(root, "content/ru/guide/fundamentals");
    fs.mkdirSync(docs, { recursive: true });
    const projectionPath = repositoryPath(
        contract.projections.documentationContentSpacing,
    );
    const projection = fs.readFileSync(projectionPath, "utf8");
    const parsed = JSON.parse(projection);
    fs.writeFileSync(
        path.join(docs, "spacing.md"),
        [
            "| Токен | Роль | Отношение | До 960px | От 960px |",
            "|:---|:---|:---|---:|---:|",
            ...parsed.public_tokens.map(token =>
                `| \`${token.token}\` | \`${token.role}\` | ${token.purpose} | ${token.mobile_px}px | ${token.desktop_px}px |`),
        ].join("\n"),
    );
    return root;
}

function mutateGuide(root, mutate)
{
    const guide = path.join(root, "content/ru/guide/fundamentals/spacing.md");
    fs.writeFileSync(guide, mutate(fs.readFileSync(guide, "utf8")));
}

function expectCode(root, code)
{
    assert.throws(
        () => validateUiDocRoot(root),
        error => error instanceof UiDocContentSpacingError
            && error.code === code
            && error.expected !== undefined
            && error.actual !== undefined,
    );
}

function withFixture(run)
{
    const root = fixture();
    try
    {
        run(root);
    }
    finally
    {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

test("ui-doc copy and exact documented tuples are bound to owner projection", () => {
    withFixture(root => {
        const report = validateUiDocRoot(root);
        assert.equal(report.status, "pass");
        assert.equal(report.validated_tuple_count, 4);
    });
});

test("ui-doc synchronization fails closed when the canonical guide is missing", () => {
    withFixture(root => {
        fs.unlinkSync(path.join(root, "content/ru/guide/fundamentals/spacing.md"));
        expectCode(root, "UI_DOC_REQUIRED_FILE_MISSING");
    });
});

test("ui-doc synchronization rejects missing tuple row", () => {
    withFixture(root => {
        mutateGuide(root, guide => guide.replace(
            /^.*`--sf-content--space-block`.*\n?/mu,
            "",
        ));
        expectCode(root, "UI_DOC_TUPLE_MISSING");
    });
});

test("ui-doc synchronization rejects a stale tuple value", () => {
    withFixture(root => {
        mutateGuide(root, guide => guide.replace(
            /(`--sf-content--space-related`[^\n]+\| )20px( \|)/u,
            "$121px$2",
        ));
        expectCode(root, "UI_DOC_TUPLE_MISMATCH");
    });
});

test("ui-doc synchronization rejects swapped related and block values", () => {
    withFixture(root => {
        mutateGuide(root, guide => guide
            .replace(
                /(`--sf-content--space-related`[^\n]+\| )16px \| 20px/u,
                "$1__RELATED__",
            )
            .replace(
                /(`--sf-content--space-block`[^\n]+\| )16px \| 24px/u,
                "$116px | 20px",
            )
            .replace("__RELATED__", "16px | 24px"));
        expectCode(root, "UI_DOC_TUPLE_MISMATCH");
    });
});

test("ui-doc synchronization rejects values present only in another row or prose", () => {
    withFixture(root => {
        mutateGuide(root, guide => `${guide.replace(
            /(`--sf-content--space-related`[^\n]+\| )16px \| 20px/u,
            "$116px | 24px",
        )}\nElsewhere: | 16px | 20px |\n`);
        expectCode(root, "UI_DOC_TUPLE_MISMATCH");
    });
});

test("validator CLI returns a stable machine-readable tuple diagnostic", () => {
    withFixture(root => {
        mutateGuide(root, guide => guide.replace(
            /(`--sf-content--space-block`[^\n]+\| )16px \| 24px/u,
            "$116px | 20px",
        ));
        const result = spawnSync(process.execPath, [validator, "--ui-doc-root", root], {
            encoding: "utf8",
        });
        assert.equal(result.status, 1);
        const envelope = JSON.parse(result.stderr);
        assert.equal(envelope.status, "fail");
        assert.equal(envelope.diagnostic.code, "UI_DOC_TUPLE_MISMATCH");
        assert.equal(envelope.diagnostic.expected.token, "--sf-content--space-block");
        assert.equal(envelope.diagnostic.actual.desktop_px, 20);
    });
});

test("the table is read from the single guide tree too", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sf-ui-doc-spacing-tree-"));
    try {
        const old = fixture();
        const from = path.join(old, "content/ru/guide/fundamentals/spacing.md");
        const moved = path.join(root, "content/ru/guide/size-and-type");
        fs.mkdirSync(moved, { recursive: true });
        fs.copyFileSync(from, path.join(moved, "spacing.md"));
        fs.rmSync(old, { recursive: true, force: true });
        assert.doesNotThrow(() => validateUiDocRoot(root));
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
