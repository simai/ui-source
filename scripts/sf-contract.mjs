#!/usr/bin/env node

import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from "node:fs";
import {dirname, join, relative, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {validateWithSchema} from "./manifest-schema.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(root, "contracts/schema/smart-component-manifest.v2.schema.json");
const registryPath = join(root, "contracts/generated/smart-component-contract-registry.json");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function walk(directory, name, found = []) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, name, found);
    else if (entry.name === name) found.push(path);
  }
  return found;
}

function requireKeys(value, keys, label) {
  for (const key of keys) {
    if (!(key in value)) throw new Error(`manifest_field_missing:${label}.${key}`);
  }
}

let manifestSchema = null;

// The schema itself, strictly: the checks below were written before the schema
// was, and a manifest that passed them could still break every validator that
// reads the schema (ui-studio's did, on 21 manifests).
function schemaErrors(manifest) {
  if (manifest.schema_version !== 2) return [];
  manifestSchema ??= readJson(schemaPath);
  return validateWithSchema(manifestSchema, manifest);
}

function validateManifest(manifest, path) {
  const errors = schemaErrors(manifest);
  if (errors.length > 0) {
    throw new Error(`manifest_schema_invalid:${manifest.id ?? relative(root, path)} ${errors.map(({path: at, message}) => `${at || "/"} ${message}`).join("; ")}`);
  }
  requireKeys(manifest, [
    "schema_version", "id", "version", "title", "summary", "kind", "reuse_mode",
    "lifecycle", "tags", "capabilities", "custom_element", "composition", "inputs",
    "methods", "events", "state", "persistence", "ownership", "security",
    "accessibility", "presentation", "compatibility", "provenance", "ai_guidance",
  ], "root");
  if (![1, 2].includes(manifest.schema_version)) throw new Error("manifest_schema_version_unknown");
  if (!/^(smart|component|utility|template)\.[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(manifest.id)) throw new Error("manifest_id_invalid");
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error("manifest_version_invalid");
  if (!["primitive", "component", "smart", "composite", "template"].includes(manifest.kind)) throw new Error("manifest_kind_invalid");
  if (!["whole", "parts", "both"].includes(manifest.reuse_mode)) throw new Error("manifest_reuse_mode_invalid");
  // Any custom element name the schema accepts: a component package names its
  // elements with its owner's prefix. That the Framework's own are sf- names is
  // an owner rule, tests/component-naming.contract.test.mjs.
  if (!/^[a-z][a-z0-9]*-[a-z0-9-]+$/.test(manifest.custom_element)) throw new Error("manifest_custom_element_invalid");
  if (manifest.reuse_mode === "whole" && manifest.composition.public_parts.length !== 0) throw new Error("manifest_whole_public_parts_forbidden");
  if (manifest.inputs.type !== "object" || typeof manifest.inputs.properties !== "object") throw new Error("manifest_inputs_schema_invalid");
  const compatibility = manifest.compatibility;
  requireKeys(compatibility, ["contract_schema", "runtime_pair", "aliases", "deprecations", "replacement", "migrations"], "compatibility");
  if (compatibility.contract_schema?.id !== `https://simai.io/contracts/smart-component-manifest.v${manifest.schema_version}.schema.json` || compatibility.contract_schema?.version !== manifest.schema_version) throw new Error("manifest_contract_schema_invalid");
  if (!/^[0-9a-f]{40}$/.test(compatibility.runtime_pair?.ui_revision || "") || !/^[0-9a-f]{40}$/.test(compatibility.runtime_pair?.ui_smart_revision || "")) throw new Error("manifest_runtime_pair_invalid");
  if (!Array.isArray(compatibility.aliases) || !Array.isArray(compatibility.deprecations) || !Array.isArray(compatibility.migrations)) throw new Error("manifest_compatibility_lists_invalid");
  for (const migration of compatibility.migrations) {
    requireKeys(migration, ["from", "to", "changes"], "compatibility.migrations");
    if (!/^\d+\.\d+\.\d+$/.test(migration.from) || !/^\d+\.\d+\.\d+$/.test(migration.to) || !Array.isArray(migration.changes) || migration.changes.length === 0) throw new Error("manifest_migration_invalid");
  }
  const scenarioIds = new Set();
  for (const scenario of manifest.scenarios ?? []) {
    requireKeys(scenario, ["id", "fixture", "viewport", "assertions"], `scenario`);
    if (scenarioIds.has(scenario.id)) throw new Error(`manifest_scenario_duplicate:${scenario.id}`);
    scenarioIds.add(scenario.id);
  }
  for (const [name, event] of Object.entries(manifest.events)) {
    if (manifest.schema_version === 1 && !/^sf-[a-z0-9-]+$/.test(name)) throw new Error(`manifest_event_name_invalid:${name}`);
    requireKeys(event, ["summary", "payload"], `events.${name}`);
    if (event.alias_of !== undefined) {
      if (event.canonical) throw new Error(`manifest_event_alias_canonical:${name}`);
      if (manifest.events[event.alias_of]?.canonical !== true) throw new Error(`manifest_event_alias_target_invalid:${name}->${event.alias_of}`);
    }
  }
  for (const artifact of manifest.provenance.source_artifacts || []) {
    if (!artifact.path || !/^[a-f0-9]{64}$/.test(artifact.sha256 || "")) throw new Error("manifest_source_artifact_invalid");
    const absolute = resolve(root, artifact.path);
    if (!absolute.startsWith(`${root}${sep}`) || !existsSync(absolute) || !statSync(absolute).isFile()) throw new Error(`manifest_source_artifact_missing:${artifact.path}`);
    if (hashFile(absolute) !== artifact.sha256) throw new Error(`manifest_source_artifact_drift:${artifact.path}`);
  }
  if (relative(root, path).startsWith("..")) throw new Error("manifest_path_outside_root");
  return manifest;
}

function loadManifests() {
  return walk(join(root, "src"), "smart.manifest.json")
    .sort()
    .map((path) => ({path, manifest: validateManifest(readJson(path), path)}));
}

function buildRegistry() {
  const schema = readJson(schemaPath);
  const entries = loadManifests().map(({path, manifest}) => ({
    id: manifest.id,
    kind: manifest.kind,
    title: manifest.title,
    summary: manifest.summary,
    lifecycle: manifest.lifecycle,
    reuse_mode: manifest.reuse_mode,
    custom_element: manifest.custom_element,
    tags: manifest.tags,
    capabilities: manifest.capabilities,
    composition: manifest.composition,
    backend_adapters: manifest.backend?.adapters ?? [],
    runtime_pair: manifest.compatibility.runtime_pair,
    contract_schema: {
      id: "https://simai.io/contracts/smart-component-manifest.v2.schema.json",
      version: 2,
    },
    manifest_path: relative(root, path).split(sep).join("/"),
    manifest_sha256: hashFile(path),
  })).sort((left, right) => left.id.localeCompare(right.id));
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.id)) throw new Error(`registry_id_duplicate:${entry.id}`);
    seen.add(entry.id);
  }
  return {
    schema: "simai.smart-component-contract-registry.v2",
    schema_path: relative(root, schemaPath).split(sep).join("/"),
    schema_sha256: hashFile(schemaPath),
    schema_id: schema.$id,
    entries,
  };
}

function aiPacket(manifest) {
  return {
    schema: "simai.smart-component-technology-packet.v1",
    identity: {id: manifest.id, version: manifest.version, kind: manifest.kind, lifecycle: manifest.lifecycle},
    decision: {reuse_mode: manifest.reuse_mode, guidance: manifest.ai_guidance},
    public_abi: {custom_element: manifest.custom_element, inputs: manifest.inputs, methods: manifest.methods, events: manifest.events},
    boundaries: {persistence: manifest.persistence, ownership: manifest.ownership, security: manifest.security},
    host_port: manifest.composition?.declarative?.host_port ?? null,
    backend: manifest.backend ?? null,
    conformance: {scenarios: manifest.scenarios ?? [], compatibility: manifest.compatibility, provenance: manifest.provenance},
  };
}

function select(entries, options) {
  return entries.filter((entry) =>
    (!options.kind || entry.kind === options.kind || (options.kind === "smart" && ["smart", "composite"].includes(entry.kind))) &&
    (!options.capability || entry.capabilities.includes(options.capability)) &&
    (!options.tag || entry.custom_element === options.tag) &&
    (!options.backend || entry.backend_adapters.includes(options.backend))
  );
}

function options(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index].startsWith("--")) result[args[index].slice(2)] = args[index + 1] && !args[index + 1].startsWith("--") ? args[++index] : true;
  }
  return result;
}

try {
  const [command = "help", subject, ...rest] = process.argv.slice(2);
  const flags = options(rest);
  if (command === "build") {
    const registry = buildRegistry();
    mkdirSync(dirname(registryPath), {recursive: true});
    writeFileSync(registryPath, stableJson(registry));
    process.stdout.write(`${registryPath}\n`);
  } else if (command === "list") {
    const registry = existsSync(registryPath) ? readJson(registryPath) : buildRegistry();
    process.stdout.write(`${JSON.stringify(select(registry.entries, flags), null, 2)}\n`);
  } else if (command === "describe") {
    const match = loadManifests().find(({manifest}) => manifest.id === subject);
    if (!match) throw new Error(`contract_unknown:${subject}`);
    process.stdout.write(`${JSON.stringify(flags.format === "ai" ? aiPacket(match.manifest) : match.manifest, null, 2)}\n`);
  } else if (command === "verify") {
    const matches = loadManifests().filter(({manifest}) => !subject || manifest.id === subject);
    if (subject && matches.length === 0) throw new Error(`contract_unknown:${subject}`);
    const generated = buildRegistry();
    if (!existsSync(registryPath) || stableJson(readJson(registryPath)) !== stableJson(generated)) throw new Error("contract_registry_drift");
    process.stdout.write(`${JSON.stringify({ok: true, verified: matches.map(({manifest}) => manifest.id)}, null, 2)}\n`);
  } else {
    process.stdout.write("sf-contract build | list [--kind smart] [--capability navigation] | describe <id> [--format ai] | verify [id]\n");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
