import { html } from 'lit';

function normalizeList(value, fallback = []) {
  if (value == null || value === '') return [...fallback];
  if (Array.isArray(value)) return value;
  return `${value}`
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveSize(value) {
  if (value == null || value === '') return '';
  const token = `${value}`.trim().replace(/^\[|\]$/g, '');
  if (/^[a-g][0-9]+(?:\/[0-9]+)?$/i.test(token)) {
    return `var(--sf-${token.toLowerCase()})`;
  }
  if (/^var\(--sf-[a-z0-9_-]+\)$/i.test(token)) {
    return token;
  }
  if (/^(?:100|[0-9]{1,2}(?:\.[0-9]+)?)%$/.test(token)) {
    return token;
  }
  return '';
}

function styleMap(style = {}) {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}

// True for a circle, square or rounded skeleton given no width (other than
// the default 100 %) and no height: the sheet draws it as the square box of
// its step (C130 (1)).
function isShapeBox(variant, type, widths, heights) {
  if (type === 'icon' || !['circle', 'square', 'rounded'].includes(variant)) return false;
  const ownWidth = widths.some((value) => {
    const resolved = resolveSize(value);
    return resolved && resolved !== '100%';
  });
  const ownHeight = heights.some((value) => resolveSize(value));
  return !ownWidth && !ownHeight;
}

export function renderSkeletonTemplate(context) {
  const {
    size,
    width,
    height,
    count,
    animation: rawAnimation,
    kind: rawKind,
    variant: rawVariant,
    type: rawType,
    rootClass,
  } = context;

  const sizes = [
    '1/7', '1/6', '1/5', '1/4', '1/3', '1/2',
    '1', '2', '3', '4', '5', '6', '7',
  ];
  const sizeValue = sizes.includes(`${size}`) ? `${size}` : '1';
  const animation = ['pulse', 'wave', 'none'].includes(`${rawAnimation}`)
    ? `${rawAnimation}`
    : 'pulse';
  const requestedShape = rawKind ?? rawVariant;
  const variant = ['text', 'circle', 'square', 'rounded'].includes(`${requestedShape}`)
    ? `${requestedShape}`
    : 'text';
  const type = rawType === 'icon' ? 'icon' : '';
  const widths = normalizeList(width, ['100%']);
  const heights = normalizeList(height);
  // A shape with no size of its own is the square box of its step (owner
  // decision C130 (1)): the sheet sizes it, so it is written with no width
  // and its root does not stretch. "Of its own" is a width other than the
  // setting's default 100 % or any height.
  const box = isShapeBox(variant, type, widths, heights);
  const rootClasses = ['sf-skeleton', 'flex'];
  if (type !== 'icon' && !box) {
    rootClasses.push('flex-1');
  }
  if (animation) {
    rootClasses.push(`sf-skeleton--animation-${animation}`);
  }
  if (rootClass) {
    rootClasses.push(...String(rootClass).split(/\s+/).filter(Boolean));
  }

  const rootStyle =
    type !== 'icon' && !box && widths.length
      ? styleMap({
          'inline-size': resolveSize(widths[0]),
        })
      : '';

  const countValue = Number(count);
  const itemsCount = Number.isFinite(countValue)
    ? Math.min(20, Math.max(1, Math.trunc(countValue)))
    : 1;

  return html`
    <div class=${rootClasses.join(' ')} style=${rootStyle} aria-hidden="true">
      ${Array.from({ length: itemsCount }, (_, index) => {
        const itemClasses = [
          'sf-skeleton-text',
          `sf-skeleton-text--size-${sizeValue}`,
        ];
        if (variant && variant !== 'text') {
          itemClasses.push(`sf-skeleton-${variant}`);
        }
        if (type) {
          itemClasses.push(`sf-skeleton-${type}`);
        }

        const resolvedWidth = widths[index % widths.length] || '';
        const resolvedHeight = heights[index % heights.length] || '';
        const itemStyle =
          type !== 'icon' && !box
            ? styleMap({
                'inline-size': resolveSize(resolvedWidth || '100%'),
                'block-size': resolvedHeight ? resolveSize(resolvedHeight) : '',
              })
            : '';

        return html`
          <div
            class=${itemClasses.join(' ')}
            style=${itemStyle}
            data-sf-skeleton-item=${String(index)}
          ></div>
        `;
      })}
    </div>
  `;
}
