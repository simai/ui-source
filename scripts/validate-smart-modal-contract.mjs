import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { stdout } from "node:process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

const [rawContract, source, template] = await Promise.all([
  read("src/smart/modal/contract.json"),
  read("src/smart/modal/index.js"),
  read("src/smart/modal/js/templates/default.js"),
]);
const contract = JSON.parse(rawContract);

assert.equal(contract.contract_id, "simai.framework.smart.modal");
assert.equal(contract.public_name, "SIMAI Framework Modal");
assert.equal(contract.technical_tag, "sf-modal");
assert.equal(contract.layer, "smart-component");
assert.equal(/sf5/i.test(rawContract), false, "new public contract must not use sf5 naming");

for (const section of [
  "parameters",
  "states",
  "events",
  "templates",
  "dependencies",
  "accessibility",
  "theme",
  "frontend_call",
  "backend_call",
  "compatibility",
]) {
  assert.ok(contract[section], `missing contract section: ${section}`);
}

const parameters = Object.values(contract.parameters).flat();
for (const parameter of ["modal-id", "title", "aria-label", "open", "mode", "display", "src", "blur-type"]) {
  assert.ok(parameters.includes(parameter), `missing parameter: ${parameter}`);
}

const events = Object.values(contract.events).flat();
for (const eventName of [
  "modal:ready",
  "modal:before-open",
  "modal:after-open",
  "modal:before-close",
  "modal:after-close",
  "modal:before-content-upload",
  "modal:after-content-upload",
]) {
  assert.ok(events.includes(eventName), `missing event: ${eventName}`);
  assert.ok(source.includes(`"${eventName}"`), `event not implemented: ${eventName}`);
}

assert.match(source, /ariaLabel:\s*\{\s*attribute:\s*"aria-label"/);
assert.match(source, /get ariaLabel\(\)/);
assert.match(source, /this\._lastActive = document\.activeElement/);
assert.match(source, /this\._lastActive\.focus\(\)/);
assert.match(source, /this\.trapFocus\(event\)/);
assert.match(source, /lifecycle:\s*this\.renderModalState/);
assert.match(source, /status:\s*this\._isLoadingRemote/);
assert.match(source, /if \(!aborted\) \{\s*this\.emitContentEvent\("modal:after-content-upload"\)/);
assert.match(source, /remote:\s*this\.state\.remote/);
assert.match(template, /aria-label=\$\{accessibleLabel \|\| nothing\}/);
assert.match(template, /aria-labelledby=\$\{accessibleLabel \? nothing : titleId\}/);
assert.match(template, /<h2 id=\$\{titleId\}/);
assert.equal(contract.compatibility.manual_generated_write_allowed, false);
assert.equal(contract.compatibility.moving_refs_allowed, false);

stdout.write(`${JSON.stringify({
  contract_id: contract.contract_id,
  event_count: new Set(events).size,
  parameter_count: new Set(parameters).size,
  status: "PASS",
}, null, 2)}\n`);
