// Normative bundle inventory for Composition capability contracts.
import { BUILTIN_EDITOR_MANIFESTS, BUILTIN_PORT_MANIFESTS, BUILTIN_TYPE_MANIFESTS } from '../src/core/js/composition/builtins.mjs';
import { BUILTIN_FIELD_KINDS } from '../src/core/js/composition/fields.mjs';

const ports = (...elements) => elements.map((element) => {
  const manifest = BUILTIN_PORT_MANIFESTS.find((entry) => entry.element === element);
  if (!manifest) throw new Error(`capability_bundle_port_missing:${element}`);
  return { key: `port:${manifest.element}@${manifest.version}`, value: manifest };
});

const kinds = () => BUILTIN_FIELD_KINDS.map((kind) => ({ key: `field-kind:${kind.kind}@${kind.version}`, value: kind }));
const editors = (...names) => names.map((name) => {
  const manifest = BUILTIN_EDITOR_MANIFESTS.find(({ type }) => type === name);
  if (!manifest) throw new Error(`capability_bundle_editor_missing:${name}`);
  return { key: `editor:${manifest.type}@${manifest.type_version}`, value: manifest };
});

const types = (...names) => names.map((name) => {
  const manifest = BUILTIN_TYPE_MANIFESTS.find(({ type }) => type === name);
  if (!manifest) throw new Error(`capability_bundle_type_missing:${name}`);
  return { key: `type:${manifest.type}@${manifest.version}`, value: manifest };
});

export const BUNDLES = Object.freeze([
  {
    directory: 'composition-regions-v1',
    capability: 'simai.composition.regions',
    version: '1.0.0',
    status: 'owner-accepted-candidate',
    compatibility: {
      recipe: 'simai.composition.recipe.v1@1.0.1 unchanged',
      document: 'simai.composition.document.v1 unchanged',
      type_manifest: 'simai.composition.type-manifest.v1 unchanged',
      registry: 'additive entries in composition-types.v1.json',
    },
    schemas: [],
    entries: () => types('layout.regions', 'layout.region'),
  },
  {
    directory: 'composition-routing-v1',
    capability: 'simai.composition.routing',
    version: '1.0.0',
    status: 'owner-accepted-candidate',
    compatibility: {
      recipe: 'simai.composition.recipe.v1@1.0.1 unchanged',
      document: 'simai.composition.document.v1 unchanged',
      type_manifest: 'simai.composition.type-manifest.v1 unchanged',
      registry: 'additive layout.scope entry in composition-types.v1.json',
      ports: 'new simai.composition.port-registry.v1 in composition-ports.v1.json',
      smart: 'smart.data-view 1.2.0 additive ports and query intent',
    },
    schemas: [],
    entries: () => [...types('layout.scope'), ...ports('sf-table')],
  },
  {
    directory: 'composition-editor-fields-v1',
    capability: 'simai.composition.editor-fields',
    version: '1.0.0',
    status: 'owner-accepted-candidate',
    compatibility: {
      editor_manifest: 'simai.composition.editor-manifest.v1 unchanged',
      registry: 'additive layout.region entry in composition-editor-manifests.v1.json',
      field_kinds: 'new simai.composition.editor-field-kind-registry.v1 in composition-editor-field-kinds.v1.json',
      existing_fields: 'layout.section, layout.columns and content.heading fields unchanged',
    },
    schemas: [],
    entries: () => [...kinds(), ...editors('layout.region', 'layout.section', 'layout.columns', 'content.heading')],
  },
]);

export default BUNDLES;
