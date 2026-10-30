// sf-avatar's tone from a name, without a document: a plain function of its
// argument, so tests/avatar-tones.contract.test.mjs runs it in Node and a server
// can print the same class in the first paint. docs/docs.md gives the algorithm
// for a server in another language.
//
// FNV-1a, 32 bits, over the UTF-8 bytes of the string exactly as given (no
// trimming, no case folding, no normalisation), its high half folded onto the
// low one, because the low bits of FNV-1a alone follow the low bits of the
// input; the remainder by the length of the list picks the tone.
//
// The list and its order are part of the algorithm: a name keeps its tone only
// while they stay. A later named tone does not join `auto`.
export const AVATAR_TONES = Object.freeze(['rose', 'amber', 'lime', 'green', 'teal', 'sky', 'indigo', 'violet']);

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function avatarToneHash(name) {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(String(name))) {
    hash = Math.imul(hash ^ byte, FNV_PRIME) >>> 0;
  }
  return (hash ^ (hash >>> 16)) >>> 0;
}

// No name, no tone: the neutral look.
export function avatarTone(name) {
  const text = name === undefined || name === null ? '' : String(name);
  return text ? AVATAR_TONES[avatarToneHash(text) % AVATAR_TONES.length] : '';
}

// The tone a setting asks for: a named one as it is, auto the one of the name,
// empty the neutral look.
export function resolveAvatarTone(setting, name) {
  return setting === 'auto' ? avatarTone(name) : setting || '';
}
