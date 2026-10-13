function mix(value, seed) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Stable non-cryptographic identifier for cache and DOM bookkeeping.
 * It is deliberately local: security decisions must use Web Crypto instead.
 */
export function stableHash(value) {
  const source = String(value ?? '');
  return `${mix(source, 0x811c9dc5)}${mix(source, 0x9e3779b9)}`;
}

export default stableHash;
