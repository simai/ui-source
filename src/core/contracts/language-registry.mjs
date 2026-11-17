// The SIMAI language registry (language-registry.v1.json beside it,
// C278), for core/js/language-packs.js: core reads its second names of each
// language (zh-CN for zh-Hans). A module, as core/lang/built-in.mjs, so the bundle and
// Node read the JSON alike.
import registry from './language-registry.v1.json' with { type: 'json' };

export default registry;
