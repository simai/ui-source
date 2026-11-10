// sf-modal contract check: the legacy contract (src/smart/modal/contract.json)
// against the element's manifest (component.json, standard
// simai.smart-component 1.3.x), its dated alias table (aliases.json) and the
// code that carries them (index.js, js/templates/default.js and the shared
// class-modal helpers in src/component/modal/js).
//
// The contract still names the public surface as it stood before the
// standard: modal:* events, title, blur, hide, unclose. Since sf-modal 1.5
// those names live on as dated aliases of the manifest's settings and verbs,
// so every contract name must resolve through the alias table to something
// the manifest declares and the code sends or reads. The checks before
// 2026-11 matched the pre-standard source text (ariaLabel props, direct
// _lastActive.focus(), modal:* string emits) and failed on every head.
//
// Usage: node scripts/validate-smart-modal-contract.mjs [ui-source root]
// Exit 0 and a PASS summary, or exit 1 with every failed check listed.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { argv, exit, stdout, stderr } from "node:process";

const root = argv[2]
  ? path.resolve(argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

const [rawContract, rawManifest, rawAliases, source, template, base, focusHelpers, stackHelpers] = await Promise.all([
  read("src/smart/modal/contract.json"),
  read("src/smart/modal/component.json"),
  read("src/smart/modal/aliases.json"),
  read("src/smart/modal/index.js"),
  read("src/smart/modal/js/templates/default.js"),
  read("src/core/js/smart-base.js"),
  read("src/component/modal/js/_focus.js"),
  read("src/component/modal/js/_stack.js"),
]);
const contract = JSON.parse(rawContract);
const manifest = JSON.parse(rawManifest);
const aliasTable = JSON.parse(rawAliases);

const failures = [];
const checks = { count: 0 };
const check = (ok, message) => {
  checks.count += 1;
  if (!ok) failures.push(message);
  return Boolean(ok);
};
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sends = (pattern) => new RegExp(pattern).test(source);

// 1. Identity: the contract and the manifest name the same element.
check(contract.contract_id === "simai.framework.smart.modal", `contract_id is ${contract.contract_id}`);
check(contract.public_name === "SIMAI Framework Modal", `public_name is ${contract.public_name}`);
check(contract.technical_tag === "sf-modal", `technical_tag is ${contract.technical_tag}`);
check(contract.layer === "smart-component", `layer is ${contract.layer}`);
check(!/sf5/i.test(rawContract), "the contract uses sf5 naming");
check(manifest.tag === contract.technical_tag, `manifest tag ${manifest.tag} is not ${contract.technical_tag}`);
check(manifest.id === "smart.modal", `manifest id is ${manifest.id}`);
check(/^\d+\.\d+\.\d+$/.test(String(manifest.version || "")), `manifest version ${manifest.version} is not x.y.z`);
check(aliasTable.component === manifest.tag, `alias table belongs to ${aliasTable.component}`);
for (const section of [
  "parameters", "states", "events", "templates", "dependencies",
  "accessibility", "theme", "frontend_call", "backend_call", "compatibility",
]) {
  check(contract[section], `missing contract section: ${section}`);
}
for (const [key, file] of Object.entries(contract.source || {})) {
  check(typeof file === "string" && file.startsWith("src/smart/modal/"), `contract source.${key} is outside the element: ${file}`);
}
check(contract.compatibility?.manual_generated_write_allowed === false, "compatibility allows manual writes to the generated repository");
check(contract.compatibility?.moving_refs_allowed === false, "compatibility allows moving refs");

// 2. Parameters: each contract name is a manifest setting or value, a dated
// alias of one (or a host attribute the base reads), an attribute every Smart
// element observes (template, root-class), or the element's id.
const settings = manifest.settings || {};
const values = manifest.values || {};
const aliases = aliasTable.aliases || [];
const aliasOf = (from, kinds) => aliases.find((row) => row.from === from && kinds.includes(row.kind));
const baseAttributes = new Set(["template", "root-class", "root-style"]
  .filter((name) => new RegExp(`observedAttributes[\\s\\S]{0,400}"${escape(name)}"`).test(base)));
const parameters = [...new Set(Object.values(contract.parameters || {}).flat())];
for (const name of ["modal-id", "title", "aria-label", "open", "mode", "display", "src", "blur-type", "initial-focus", "size"]) {
  check(parameters.includes(name), `missing contract parameter: ${name}`);
}
for (const name of parameters) {
  if (name in settings || name in values) continue;
  if (name === "id") continue;
  if (baseAttributes.has(name)) continue;
  const row = aliasOf(name, ["setting", "attribute"]);
  if (!check(row, `contract parameter ${name} is no setting, value or dated alias`)) continue;
  check(row.since && row.remove_after, `alias ${name} carries no dates`);
  if (row.to === null) {
    check(row.mode === "host-attribute", `alias ${name} has no new name and is no host attribute`);
    continue;
  }
  check(row.to in settings || row.to in values, `alias ${name} -> ${row.to}: the manifest declares no ${row.to}`);
}
check(sends(/ariaLabel:\s*this\.getAttribute\("aria-label"\)/), "aria-label is not read from the host");
check(settings["initial-focus"]?.default === "auto", "initial-focus has no auto default");
const focusValues = settings["initial-focus"]?.values || [];
const helperValues = (focusHelpers.match(/const INITIAL_FOCUS = \[([^\]]*)\]/)?.[1] || "").match(/[a-z]+/g) || [];
check(focusValues.length && focusValues.join() === helperValues.join(),
  `initial-focus values [${focusValues}] differ from the shared helper's [${helperValues}]`);

// 3. Events: each contract name is a dated alias; a renamed one points at
// sf-modal-<verb>, a verb the manifest declares and the element sends, with
// the same cancelable flag everywhere; a retired one is still sent until its
// date. The element's own map of old names agrees with the alias table.
const events = manifest.events || {};
const contractEvents = [...new Set(Object.entries(contract.events || {})
  .filter(([group]) => group !== "cancelable")
  .flatMap(([, names]) => names))];
const contractCancelable = new Set(contract.events?.cancelable || []);
const oldNames = Object.fromEntries([...source.matchAll(/"(modal:[a-z-]+)":\s*"([a-z-]+)"/g)].map((m) => [m[1], m[2]]));
for (const name of ["modal:before-open", "modal:after-open", "modal:before-close", "modal:after-close",
  "modal:before-content-upload", "modal:after-content-upload"]) {
  check(contractEvents.includes(name), `missing contract event: ${name}`);
}
for (const name of contractCancelable) {
  check(contractEvents.includes(name), `cancelable ${name} is no contract event`);
}
const sentVerbs = new Set([...source.matchAll(/this\.(?:emitModalEvent|emitContentEvent)\("([a-z-]+)"/g)].map((m) => m[1]));
for (const name of contractEvents) {
  const row = aliasOf(name, ["event"]);
  if (!check(row, `contract event ${name} has no dated alias`)) continue;
  check(row.since && row.remove_after, `event alias ${name} carries no dates`);
  if (row.to === null) {
    check(row.mode === "retired", `event alias ${name} has no new name and is not retired`);
    check(sends(`retiredEvent\\("${escape(name)}"`), `retired event ${name} is no longer sent before its date`);
    continue;
  }
  const verb = row.to.startsWith(`${manifest.tag}-`) ? row.to.slice(manifest.tag.length + 1) : null;
  if (!check(verb && events[verb], `event alias ${name} -> ${row.to}: the manifest declares no such verb`)) continue;
  check(oldNames[name] === verb, `the element maps ${name} to ${oldNames[name]}, the alias table to ${verb}`);
  check(sentVerbs.has(verb), `verb ${verb} (${name}) is never sent`);
  const cancelable = contractCancelable.has(name);
  check(Boolean(events[verb].cancelable) === cancelable, `${verb}: manifest cancelable ${Boolean(events[verb].cancelable)}, contract ${cancelable}`);
  check(Boolean(row.cancelable) === cancelable, `${name}: alias cancelable ${Boolean(row.cancelable)}, contract ${cancelable}`);
}
for (const verb of Object.keys(events)) {
  check(sentVerbs.has(verb), `manifest event ${verb} is never sent`);
}
check(sends(/emitModalEvent\(verb,[^)]*\)\s*\{\s*return this\.sfEmit\(verb,[^;]*\{\s*cancelable\s*\}\)/),
  "emitModalEvent does not hand cancelable to sfEmit");
check(sends(/emitContentEvent\(verb\)\s*\{\s*this\.sfEmit\(verb,\s*\{[^}]*remote:\s*this\.state\.remote/),
  "content events do not carry the remote state");
// Completion is sent for success and error, never for an aborted request.
check(sends(/if \(!aborted\) \{\s*this\.emitContentEvent\("content-uploaded"\)/),
  "content-uploaded is not guarded by the aborted flag");
check(/abort/i.test(contract.event_semantics?.content_completion || ""), "event_semantics no longer says aborted requests do not complete");

// 4. State the template reads.
check(sends(/lifecycle:\s*this\.renderModalState/), "the render state has no lifecycle");
check(sends(/status:\s*this\._isLoadingRemote/), "the remote state has no status");

// 5. Slots and templates.
const slots = Object.keys(manifest.slots || {});
for (const slot of contract.templates?.slots || []) {
  check(slots.includes(slot), `contract slot ${slot} is not in the manifest`);
}
check(manifest.templates?.[contract.templates?.default], `contract default template ${contract.templates?.default} is not in the manifest`);

// 6. Accessibility: the name, the roles, focus capture, trap and return.
const nameFrom = manifest.accessibility?.name?.from || [];
check(nameFrom.includes("aria-label") && nameFrom.includes("heading"), `accessible name from [${nameFrom}]`);
check(manifest.accessibility?.role === contract.accessibility?.roles?.modal, "manifest role differs from the contract's modal role");
check(/aria-label=\$\{accessibleLabel \|\| nothing\}/.test(template), "the template no longer names the window by aria-label");
check(/aria-labelledby=\$\{accessibleLabel \? nothing : titleId\}/.test(template), "the template no longer links the title when there is no aria-label");
check(/<h2 id=\$\{titleId\}/.test(template), "the default title is no h2 with the title id");
const roles = template.match(/role=\$\{isInline \? '([a-z]+)' : '([a-z]+)'\}/);
check(roles && roles[1] === contract.accessibility?.roles?.inline && roles[2] === contract.accessibility?.roles?.modal,
  `the template's roles ${roles ? roles.slice(1).join("/") : "none"} differ from the contract's inline/modal roles`);
check(sends(/this\._lastActive = document\.activeElement/), "the focus before opening is not captured");
check(sends(/restoreModalLayerFocus\(wasTop, this\._lastActive/), "the focus does not return to the element that had it");
check(/function restoreModalLayerFocus\(wasTop, lastActive[^)]*\)\s*\{\s*returnLayerFocus\(wasTop, lastActive/.test(stackHelpers),
  "the shared helper no longer returns the focus");
check(sends(/this\.trapFocus\(event\)/) && sends(/trapModalFocus\(panel, event\)/), "Tab is not kept inside the window");
check(sends(/focusModalInitial\(panel, this\.initialFocus\)/), "the first focus does not follow initial-focus");

const summary = {
  contract_id: contract.contract_id,
  manifest: `${manifest.id} ${manifest.version}`,
  parameter_count: parameters.length,
  event_count: contractEvents.length,
  verb_count: Object.keys(events).length,
  checks: checks.count,
  failures,
  status: failures.length ? "FAIL" : "PASS",
};
(failures.length ? stderr : stdout).write(`${JSON.stringify(summary, null, 2)}\n`);
exit(failures.length ? 1 : 0);
