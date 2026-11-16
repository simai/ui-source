// Normative bundle inventory for Composition capability contracts.
import { BUILTIN_EDITOR_MANIFESTS, BUILTIN_PORT_MANIFESTS, BUILTIN_TYPE_MANIFESTS, PORT_MANIFEST_SF_TABLE_1_0_0 } from '../src/core/js/composition/builtins.mjs';
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
    version: '1.2.0',
    status: 'owner-accepted-candidate',
    compatibility: {
      recipe: 'simai.composition.recipe.v1@1.0.1 unchanged',
      document: 'simai.composition.document.v1 unchanged',
      type_manifest: 'simai.composition.type-manifest.v1 unchanged',
      registry: 'additive layout.scope entry in composition-types.v1.json',
      ports: 'new simai.composition.port-registry.v1 in composition-ports.v1.json',
      smart: 'smart.data-view 1.2.0 additive ports and query intent',
      value_types: 'bare names read beside the older .v1 labels (value-types-without-version); fixtures/routing.json and the sf-table manifest unchanged',
      port_element: 'the builtin list port is sf-view-table@1.1.0 (sf-view-table 1.14.0); sf-table@1.0.0 keeps its bytes and digest, and the name sf-table is read as sf-view-table until 2027-01-01 (port-element-sf-table-to-sf-view-table)',
    },
    schemas: [],
    entries: () => [
      ...types('layout.scope'),
      { key: `port:${PORT_MANIFEST_SF_TABLE_1_0_0.element}@${PORT_MANIFEST_SF_TABLE_1_0_0.version}`, value: PORT_MANIFEST_SF_TABLE_1_0_0 },
      ...ports('sf-view-table'),
    ],
  },
  {
    directory: 'composition-editor-fields-v1',
    capability: 'simai.composition.editor-fields',
    version: '1.4.0',
    status: 'owner-accepted-candidate',
    compatibility: {
      editor_manifest: 'simai.composition.editor-manifest.v1 unchanged',
      registry: 'additive layout.region entry in composition-editor-manifests.v1.json',
      field_kinds: 'new simai.composition.editor-field-kind-registry.v1 in composition-editor-field-kinds.v1.json',
      existing_fields: 'the layout.section surface field and the content.heading fields unchanged; the content.heading manifest follows its type to 1.1.0 (inline atoms), and to 1.3.0 (inline model 1.2.0: the break and the mark strike; 2026-11-10), its fields unchanged',
      layout_section: 'the layout.section manifest follows its type to 1.1.0: the surface field unchanged, the fields of its seven parameter sets added after it (choice, integer and toggle; boolean@1 is needed for the toggles); one block editor, 2026-11-03. It follows its type to 1.2.0: the width field defaults to normal and padding_y to 8, what the section prints unset (parameter_defaults); no field added or removed; visual parity, 2026-11-04. It follows its type to 1.3.0: the background field offers accent as well (the primary fill with on-primary text, as the accent variant sets it); no field added or removed; ui-editor host, 2026-11-04',
      layout_columns: 'the layout.columns manifest follows its type to 1.1.0: the columns field unchanged, an additive gap field (integer 0..8); dispatcher decision 2026-11-03 (one block editor, Part A)',
    },
    schemas: [],
    entries: () => [...kinds(), ...editors('layout.region', 'layout.section', 'layout.columns', 'content.heading')],
  },
]);

export default BUNDLES;
