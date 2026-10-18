import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { repositoryPath } from "../scripts/adaptive-sizing-contract-lib.mjs";

// The gate reads ui-doc's main, which holds the examples of the newest pinned
// release; UI_DOC_REF may name another branch or commit.
// The Docara revision the pinned ui-doc actually locks. It moves with the ui-doc
// pin above, because the two describe one accepted state: this Framework against
// that documentation built by that Docara.
const uiDocRoot = process.env.UI_DOC_ROOT;

test("Framework uses one validation-only GitHub Actions contour", () => {
    assert.equal(fs.existsSync(repositoryPath("bitbucket-pipelines.yml")), false);

    const workflow = fs.readFileSync(
        repositoryPath(".github/workflows/validation.yml"),
        "utf8",
    );
    assert.match(workflow, /pull_request:/u);
    assert.match(workflow, /push:\s*\n\s*branches:\s*\[main\]/u);
    assert.match(workflow, /workflow_dispatch:/u);
    assert.match(workflow, /node-version: "20\.19\.5"/u);
    assert.match(workflow, /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/u);
    assert.match(workflow, /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/u);
    assert.match(workflow, /bash scripts\/run-content-spacing-ci-gate\.sh/u);
    assert.doesNotMatch(workflow, /ssh|deploy|publish|release/iu);
});

test("ordinary Framework test entrypoint cannot bypass the exact public-doc gate", () => {
    const manifest = JSON.parse(fs.readFileSync(repositoryPath("package.json"), "utf8"));
    assert.equal(manifest.scripts.test, "bash scripts/run-content-spacing-ci-gate.sh");

    const gate = fs.readFileSync(
        repositoryPath("scripts/run-content-spacing-ci-gate.sh"),
        "utf8",
    );
    assert.match(gate, /readonly UI_DOC_REF="\$\{UI_DOC_REF:-main\}"/u);
    assert.match(gate, /git clone --quiet --no-checkout/u);
    assert.match(gate, /checkout --quiet --detach/u);
    assert.match(gate, /UI_DOC_ROOT="\$ui_doc_root" npm run test:unit/u);
    assert.match(gate, /UI_DOC_ROOT="\$ui_doc_root" npm run test:public-docs/u);
});

test("pinned ui-doc uses the exact accepted Docara commit in a validation-only contour", () => {
    assert.ok(uiDocRoot, "UI_DOC_ROOT is mandatory for the Framework unit suite");

    const quality = fs.readFileSync(
        path.join(uiDocRoot, ".github/workflows/quality.yml"),
        "utf8",
    );
    const uiDocManifest = JSON.parse(fs.readFileSync(
        path.join(uiDocRoot, "composer.json"),
        "utf8",
    ));
    const setupPhpCommit = "f3e473d116dcccaddc5834248c87452386958240";
    const checkoutCommit = "11d5960a326750d5838078e36cf38b85af677262";

    assert.match(quality, /pull_request:/u);
    assert.match(quality, /push:\s*\n\s*branches: \[main\]/u);
    assert.match(quality, new RegExp(`checkout@${checkoutCommit}`, "u"));
    assert.match(quality, new RegExp(`setup-php@${setupPhpCommit}`, "u"));
    assert.match(quality, /php-version: "8\.3"/u);
    assert.match(quality, /composer validate --no-check-publish/u);
    assert.match(quality, /composer install --no-interaction --prefer-source/u);
    assert.match(quality, /test-migrate-legacy-content\.php/u);
    assert.match(quality, /Build twice with identical output/u);
    assert.match(quality, /verify-static-build\.php/u);
    // The only way out is GitHub Pages (ui-doc ee87cd11, 2026-10-18): on main,
    // the verified site rebuilt under /ui-doc/ and published by
    // actions/deploy-pages. No ssh, no other deployment.
    assert.doesNotMatch(quality, /ssh/iu);
    const outward = quality.match(/^\s*uses:\s*\S*deploy\S*/gimu) ?? [];
    assert.ok(outward.every((line) => /actions\/deploy-pages@[0-9a-f]{40}/u.test(line)), `only a pinned actions/deploy-pages publishes: ${outward.join('; ')}`);
    assert.doesNotMatch(quality, /rsync|scp|sftp|ftp:/iu);
    assert.equal(fs.existsSync(path.join(uiDocRoot, ".github/workflows/deploy.yml")), false);
    // ui-doc may carry one npm tool for its build -- Shiki colours the code at
    // build time (owner, 2026-10-12) -- but its package is a build step, never
    // a way to publish: no deploy in its scripts.
    const npmManifest = path.join(uiDocRoot, "package.json");
    if (fs.existsSync(npmManifest)) {
        const npm = JSON.parse(fs.readFileSync(npmManifest, "utf8"));
        assert.doesNotMatch(JSON.stringify(npm.scripts ?? {}), /deploy|ssh|publish/iu);
    }
    // The claim is that the documentation is built from an exact commit of the
    // official repository, not from whatever a moving target happens to hold.
    // Which commit is ui-doc's own decision, and repeating it here only ever
    // meant one more constant to retype.
    //
    // This used to insist the constraint be the literal "dev-main", which was
    // true until 2026-10-04, when ui-doc moved onto Docara's tagged releases
    // and recorded why: 2.13.0 derives Smart requires from the registry, and
    // riding the branch had been breaking the lock's closure guard. The
    // assertion stayed behind and spent five days failing a suite over a
    // decision that had already been made and written down -- so it was the
    // stale side here, not ui-doc (owner, 2026-10-09).
    //
    // What matters is kept: the package comes from the official repository and
    // the lock names one exact commit. A branch and a release both satisfy
    // that; an unbounded "*" or "dev-" prefix riding someone's fork does not.
    const constraint = uiDocManifest.require["simai/docara"];
    assert.match(constraint, /^(dev-main|\^\d+\.\d+(\.\d+)?)$/u,
        `ui-doc must pin Docara to main or a release line, not ${constraint}`);
    const uiDocLock = JSON.parse(fs.readFileSync(path.join(uiDocRoot, "composer.lock"), "utf8"));
    const docara = uiDocLock.packages.find(pkg => pkg.name === "simai/docara");
    assert.match(docara?.source?.reference ?? "", /^[0-9a-f]{40}$/u);
    assert.equal(docara?.source?.url, "https://github.com/simai/docara.git");
});

test("operational source has no Bitbucket or Atlassian coupling", () => {
    const operational = [
        repositoryPath(".github/workflows/validation.yml"),
        repositoryPath("scripts/run-content-spacing-ci-gate.sh"),
        repositoryPath("package.json"),
    ].map(file => fs.readFileSync(file, "utf8")).join("\n");

    assert.doesNotMatch(operational, /bitbucket|atlassian|ssh-run/iu);
});
