import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import test from "node:test";

const root = new URL("..", import.meta.url);
const registryPath = "contracts/generated/smart-component-contract-registry.json";

// The committed file, not the one on disk. tests/smart-contract-registry.test.mjs
// asserts the registry by running `sf-contract build` first, so it reads what the
// generator just produced and can never notice that the *committed* registry had
// gone stale. That is not a hypothetical: ui-source c405fc34 was published with
// manifests naming ca7d4ab7/752d09af and a registry still naming
// f7e3dcd1/81f95401, two pairs behind, and the whole suite stayed green. The
// provenance refresh writes the manifests; a separate script writes the registry;
// nothing held the two together.
const committed = () => JSON.parse(
  execFileSync("git", ["show", `HEAD:${registryPath}`], {cwd: root, encoding: "utf8"}),
);

// The manifests come out of the same commit as the registry. Reading them from
// the working tree instead compares a refreshed manifest with a registry that
// has not been rebuilt yet, which is the normal state of the tree between the
// provenance refresh and the commit that carries both -- so the check would
// fail once per release, at a known step, for no defect. A check that always
// cries wolf at a known point is one people learn to step over, and the defect
// it exists for is about what was *published*: a commit whose registry and
// manifests name different pairs. HEAD against HEAD says exactly that.
const manifests = () => execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "src/smart/"], {cwd: root, encoding: "utf8"})
  .split("\n")
  .filter((path) => path.endsWith("/smart.manifest.json"))
  .map((path) => {
    try {
      return {
        directory: path.split("/").at(-2),
        manifest: JSON.parse(execFileSync("git", ["show", `HEAD:${path}`], {cwd: root, encoding: "utf8"})),
      };
    } catch {
      return null;
    }
  })
  .filter(Boolean);

test("the committed registry names the same runtime pair as the manifests it is generated from", () => {
  const registry = committed();
  const byId = new Map(registry.entries.map((entry) => [entry.id, entry]));
  const checked = [];

  for (const {directory, manifest} of manifests()) {
    const entry = byId.get(manifest.id);
    if (!entry) continue;
    const expected = manifest.compatibility?.runtime_pair;
    if (!expected) continue;
    assert.deepEqual(
      entry.runtime_pair,
      expected,
      `${directory}: the committed registry names ${JSON.stringify(entry.runtime_pair)} `
      + `where its manifest names ${JSON.stringify(expected)}. Run \`npm run contract:build\` `
      + `and commit the result in the same commit as the provenance refresh.`,
    );
    checked.push(directory);
  }

  // A guard that silently checks nothing is worse than no guard.
  assert.ok(checked.length >= 40, `only ${checked.length} manifests were compared`);
});

test("every manifest the registry claims is one that exists", () => {
  const registry = committed();
  const known = new Set(manifests().map(({manifest}) => manifest.id));

  for (const entry of registry.entries) {
    assert.ok(known.has(entry.id), `the registry carries ${entry.id}, which no manifest declares`);
  }
});
