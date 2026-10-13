import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';

class Skeleton extends ComponentObserver {
  static componentName = 'Skeleton';
  constructor(props) {
    super(props);
    const {
      size = '1',
      width = '100%',
      height = null,
      count = 1,
      animation = 'pulse',
      variant = 'text',
      type = null,
      items = null,
    } = this.params || {};
    const className = this.attrs.class || this.attrs.className;

    const sizeValue = normalizeChoice(
      size,
      ['1/7', '1/6', '1/5', '1/4', '1/3', '1/2', '1', '2', '3', '4', '5', '6', '7'],
      '1',
    );
    const animationValue = normalizeChoice(
      animation,
      ['pulse', 'wave', 'none'],
      'pulse',
    );
    const variantValue = normalizeChoice(
      variant,
      ['text', 'circle', 'square', 'rounded'],
      'text',
    );
    const typeValue = type === 'icon' ? 'icon' : null;
    const widths = normalizeList(width, ['100%']);
    const heights = normalizeList(height);
    const perItemAttrs = parseItemAttrs(items);

    this.container = document.createElement('div');
    this.container.classList.add('sf-skeleton', 'flex');
    this.container.setAttribute('aria-hidden', 'true');
    if (typeValue !== 'icon') {
      this.container.classList.add('flex-1');
      if (widths.length) {
        this.container.style.inlineSize = resolveSize(widths[0]);
      }
    }
    if (animationValue) {
      this.container.classList.add(`sf-skeleton--animation-${animationValue}`);
    }
    if (className) {
      this.container.classList.add(
        ...`${className}`.split(' ').filter(Boolean),
      );
    }

    const total = Number(count);
    const itemsCount = Number.isFinite(total)
      ? Math.min(20, Math.max(1, Math.trunc(total)))
      : 1;

    for (let i = 0; i < itemsCount; i++) {
      const item = document.createElement('div');
      item.classList.add('sf-skeleton-text', `sf-skeleton-text--size-${sizeValue}`);
      if (variantValue !== 'text') {
        item.classList.add(`sf-skeleton-${variantValue}`);
      }
      if (typeValue) {
        item.classList.add(`sf-skeleton-${typeValue}`);
      }
      const resolvedWidth = widths[i % widths.length] || '';
      const resolvedHeight = heights[i % heights.length] || '';
      if (typeValue !== 'icon') {
        item.style.inlineSize = resolveSize(resolvedWidth || '100%');
        if (resolvedHeight) {
          item.style.blockSize = resolveSize(resolvedHeight);
        }
      }
      const specificAttrs = perItemAttrs[i % perItemAttrs.length] || {};
      const mergedAttrs = { ...this.attrs, ...specificAttrs };
      Object.entries(mergedAttrs || {})
        .filter(([attr]) => isSafeItemAttribute(attr))
        .forEach(([attr, value]) => {
          if (value === undefined || value === null) {
            return;
          }
          item.setAttribute(attr, value);
        });
      this.container.append(item);
    }
    this.template = this.container;
  }
}

function normalizeList(value, fallback = []) {
  if (value == null || value === '') return [...fallback];
  if (Array.isArray(value)) return value;
  return `${value}`
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((v) => v.trim())
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

function normalizeChoice(value, allowed, fallback) {
  const normalized = `${value ?? ''}`;
  return allowed.includes(normalized) ? normalized : fallback;
}

function isSafeItemAttribute(name) {
  return /^(?:aria-[a-z0-9_-]+|data-[a-z0-9_-]+)$/i.test(name);
}

function parseItemAttrs(items) {
  if (!items) return [];
  const list = Array.isArray(items) ? items : `${items}`.split('|');
  return list
    .map((entry) => {
      if (!entry) return null;
      const obj = {};
      `${entry}`
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((pair) => {
          const [k, ...rest] = pair.split('=');
          const key = k?.trim();
          const value = rest.join('=').trim();
          if (key) {
            obj[key] = value || true;
          }
        });
      return obj;
    })
    .filter(Boolean);
}

registerComponent('Skeleton', Skeleton);
