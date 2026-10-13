import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { repositoryPath } from "../scripts/adaptive-sizing-contract-lib.mjs";

const evidencePath = repositoryPath(
    "source/workflow/evidence/2026-08-08-sf5-content-spacing/human-centered-simplicity-pre-audit.json",
);
const evidenceAvailable = fs.existsSync(evidencePath);
const payload = evidenceAvailable ? JSON.parse(fs.readFileSync(evidencePath, "utf8")) : null;
const repoRoots = new Map([
    ["repo://simai/ui-loader", repositoryPath(".")],
    ["repo://simai/ui-doc", process.env.UI_DOC_ROOT],
]);

function git(root, args) {
    return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

function sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

// The audit binds commits of the private history (simai/ui-source-history):
// the public repository starts from a snapshot and holds none of them, so its
// CI has nothing to compare. Where the history is present -- a clone that
// fetched it -- the binding is checked as before.
function hasCommit(root, ref) {
    try {
        execFileSync("git", ["-C", root, "cat-file", "-e", `${ref}^{commit}`], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}
const historyAvailable = evidenceAvailable && payload.changed_surface_inventory.repositories.every((repository) => {
    const root = repoRoots.get(repository.repo_ref);
    return root && hasCommit(root, repository.baseline_ref) && hasCommit(root, repository.target_ref);
});

test("simplicity pre-audit binds exact multi-repo changed surfaces", {skip: !evidenceAvailable || !historyAvailable}, () => {
    assert.equal(payload.status, "PENDING_EXTERNAL_TESTER_REVIEW");
    assert.equal(payload.verdict, "PENDING_EXTERNAL_TESTER_REVIEW");
    assert.equal(payload.external_tester_boundary.status, "PENDING_EXTERNAL_REVIEW");
    assert.equal(payload.external_tester_boundary.verdict_ref, null);
    assert.equal(payload.external_tester_boundary.verdict_sha256, null);

    const combined = [];
    const inventoryPaths = new Set(payload.changed_surface_inventory.files.map(item => item.path));
    for (const repository of payload.changed_surface_inventory.repositories) {
        const root = repoRoots.get(repository.repo_ref);
        assert.ok(root, `missing local root for ${repository.repo_ref}`);

        const diff = git(root, ["diff", "--binary", `${repository.baseline_ref}..${repository.target_ref}`]);
        assert.equal(sha256(diff), repository.diff_sha256);
        combined.push(`${repository.repo_ref.replace("repo://", "")} ${repository.diff_sha256}`);

        const actualFiles = git(root, ["diff", "--name-only", `${repository.baseline_ref}..${repository.target_ref}`])
            .trim()
            .split("\n")
            .filter(Boolean)
            .sort();
        assert.deepEqual(actualFiles, [...repository.files].sort());
        for (const file of actualFiles) {
            assert.ok(inventoryPaths.has(`${repository.repo_ref}/${file}`), `unmapped changed file: ${repository.repo_ref}/${file}`);
        }
    }
    assert.equal(sha256(`${combined.join("\n")}\n`), payload.changed_surface_inventory.diff_sha256);

    const surfaceIds = new Set(payload.changed_surface_inventory.files.flatMap(item => item.surface_ids));
    const necessityIds = new Set(payload.necessity_map.map(item => item.id));
    assert.deepEqual([...surfaceIds].sort(), [...necessityIds].sort());
    assert.deepEqual(
        [...surfaceIds].sort(),
        [...payload.external_tester_boundary.reviewed_surface_ids_required].sort(),
    );
});

test("simplicity pre-audit does not self-issue external tester acceptance", {skip: !evidenceAvailable}, () => {
    assert.doesNotMatch(payload.verdict, /^PASS/u);
    assert.equal(payload.external_tester_boundary.verdict, "PENDING_EXTERNAL_TESTER_REVIEW");
});
