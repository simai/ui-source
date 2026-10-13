const FORMAT_PREFIX = 'sf-json-v1:';

export function encodeCacheValue(value) {
  return `${FORMAT_PREFIX}${String(value ?? '')}`;
}

export function decodeCacheValue(value) {
  if (typeof value !== 'string') return 'null';
  if (value.startsWith(FORMAT_PREFIX)) return value.slice(FORMAT_PREFIX.length);

  // Values written before the pure-JavaScript cache format cannot be decoded
  // without the retired compression library. Ignore them and rebuild cache.
  const trimmed = value.trim();
  if (/^(?:\{|\[|"|null|true|false|-?\d)/.test(trimmed)) return value;
  return 'null';
}
