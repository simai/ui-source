const spacingToTightness = Object.freeze({
  compact: 'low',
  normal: '',
  comfortable: 'high',
  spacious: 'highest',
});

const legacyToSpacing = Object.freeze({
  '': 'normal',
  default: 'normal',
  low: 'compact',
  high: 'comfortable',
  highest: 'spacious',
});

export function resolveControlSpacing({spacing, tightness} = {}) {
  const diagnostics = [];
  const canonicalPresent = spacing !== undefined && spacing !== null;
  const normalize = value => String(value ?? '').trim().toLowerCase();
  const legacy = normalize(tightness);
  let value;

  if (canonicalPresent) {
    const canonical = normalize(spacing);
    value = Object.hasOwn(spacingToTightness, canonical) ? canonical : 'normal';
    if (!Object.hasOwn(spacingToTightness, canonical)) diagnostics.push('invalid-spacing');
    if (
      tightness !== undefined &&
      tightness !== null &&
      Object.hasOwn(legacyToSpacing, legacy) &&
      legacyToSpacing[legacy] !== value
    ) {
      diagnostics.push('spacing-overrides-tightness');
    }
  } else {
    value = Object.hasOwn(legacyToSpacing, legacy) ? legacyToSpacing[legacy] : 'normal';
    if (!Object.hasOwn(legacyToSpacing, legacy)) diagnostics.push('invalid-tightness');
  }

  return {spacing: value, tightness: spacingToTightness[value], diagnostics};
}
