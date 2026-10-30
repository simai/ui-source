import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const run = (...args) => execFileSync(process.execPath, ["scripts/sf-contract.mjs", ...args], {cwd: root, encoding: "utf8"});

test("whole composite manifests are generated into the searchable registry", () => {
  run("build");
  const registry = JSON.parse(readFileSync(new URL("../contracts/generated/smart-component-contract-registry.json", import.meta.url), "utf8"));
  assert.equal(registry.schema, "simai.smart-component-contract-registry.v2");
  // Rises with each component the Framework publishes; sf-popover made it 51, and
  // the four components now in package larena leaving the free source made it 47,
  // and sf-page-header made it 48, and sf-resizer 49, and sf-profile-picker 50, and sf-empty-state 51, and sf-copy-button 52, and sf-help-mark 53, and sf-theme-generator 54, and sf-image-field 55, and sf-accordion 56, and sf-quantity 57, and sf-menu 58, and sf-code-input 59, and sf-progress-ring 60, and sf-site-header 61, and sf-rich-text 62, and sf-lookup 63.
  // The number is pinned so an addition is an edit somebody made rather than a
  // count that drifted -- a component appearing in the registry by accident is
  // exactly what this would otherwise miss.
  assert.equal(registry.entries.length, 63);
  for (const id of ["smart.sortable", "smart.composition-overlay", "smart.inline-editor"]) assert.ok(registry.entries.some((entry) => entry.id === id), id);
  // Larena's components are not part of the free registry (package larena).
  for (const id of ["smart.admin-menu", "smart.data-view", "smart.data-view-composite", "smart.property-view"]) {
    assert.ok(!registry.entries.some((entry) => entry.id === id), `${id} is in package larena`);
  }
  assert.ok(registry.entries.some(({id}) => id === "smart.button-group"));
  assert.ok(registry.entries.every(({reuse_mode}) => ["whole", "parts", "both"].includes(reuse_mode)));
  assert.ok(registry.entries.every(({contract_schema}) => contract_schema.version === 2));
});


test("CLI describes and verifies a free component", () => {
  const packet = JSON.parse(run("describe", "smart.button", "--format", "ai"));
  assert.equal(packet.public_abi.custom_element, "sf-button");
  assert.equal(packet.conformance.compatibility.contract_schema.version, 2);
  assert.deepEqual(JSON.parse(run("verify", "smart.button")), {ok: true, verified: ["smart.button"]});
});
