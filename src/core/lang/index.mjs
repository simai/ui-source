// The languages the Framework has a pack of, for core (core/js/language-packs.js):
// index.json is written by scripts/build-language-packs.mjs. A module, as the
// components' lang/index.mjs, so the bundle and Node read the JSON alike.
import index from './index.json' with { type: 'json' };

export default index;
