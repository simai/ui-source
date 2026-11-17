// Written by scripts/build-language-packs.mjs from src/core/lang/built-in.json
// (owner decision C282); do not edit. The words this bundle carries: the
// built-in languages' (en); every other language comes from
// a language file (core/lang/<code>.js or its parts).
import en from './en.json' with { type: 'json' };

export const files = { en: { runtime: en.runtime } };

export default { en: en.runtime };
