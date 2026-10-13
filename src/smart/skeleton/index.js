import SfBaseElement, { toAttributeName } from '../../core/js/smart-base';
import { renderSkeletonTemplate } from './js/templates/default';



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

function isSafeItemAttribute(name) {
  return /^(?:aria-[a-z0-9_-]+|data-[a-z0-9_-]+)$/i.test(name);
}

class SfSkeleton extends SfBaseElement {
  static get props() {
    return {
      size: { default: '1' },
      width: { default: '100%' },
      height: { default: '' },
      count: { type: Number, default: 1 },
      animation: { default: 'pulse' },
      // The axis is called kind, because that is the question it answers.
      // `variant` keeps working: see contracts/public-api-axes.json.
      kind: {default: 'text', values: ['text', 'circle', 'square', 'rounded'], aliases: ['variant']},
      type: { default: '' },
      items: { default: '' },
      rootClass: { default: '' },
    };
  }


  get size() {
    return this.getAttribute('size') || '1';
  }

  get width() {
    return this.getAttribute('width') || '100%';
  }

  get height() {
    return this.getAttribute('height') || '';
  }

  get count() {
    return this.getNumberAttr('count', 1);
  }

  get animation() {
    return this.getAttribute('animation') || 'pulse';
  }

  get kind() {
    return this.getProp('kind');
  }

  // The legacy name, kept so a consumer reading el.variant still gets an answer.
  get variant() {
    return this.kind;
  }

  get type() {
    return this.getAttribute('type') || '';
  }

  get items() {
    return this.getAttribute('items') || '';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      rootClass: this.getRootClass(),
      // Resolved names the template reads (contracts/template-context.json).
      variant: this.variant,
      type: this.type,
    });
  }

  template() {
    return renderSkeletonTemplate(this.templateContext());
  }

  afterRender() {
    const itemAttrs = parseItemAttrs(this.items);
    if (!itemAttrs.length) {
      return;
    }

    this.querySelectorAll('[data-sf-skeleton-item]').forEach((node, index) => {
      const attrs = itemAttrs[index % itemAttrs.length] || {};
      Object.entries(attrs).forEach(([attr, value]) => {
        if (!isSafeItemAttribute(attr)) {
          return;
        }
        if (value === undefined || value === null) {
          return;
        }

        if (value === true) {
          node.setAttribute(attr, '');
          return;
        }

        node.setAttribute(attr, String(value));
      });
    });
  }

  get state() {
    return {
      size: this.size,
      width: this.width,
      height: this.height,
      count: this.count,
      animation: this.animation,
      variant: this.variant,
      type: this.type,
      items: this.items,
      rootClass: this.getRootClass(),
    };
  }

  setState(nextState = {}) {
    Object.entries(nextState || {}).forEach(([key, value]) => {
      const attr = toAttributeName(key);
      if (!attr) {
        return;
      }

      if (value === false || value === null || value === undefined || value === '') {
        this.removeAttribute(attr);
        return;
      }

      if (value === true) {
        this.setAttribute(attr, '');
        return;
      }

      this.setAttribute(attr, String(value));
    });

    return this;
  }
}

SfSkeleton.define('sf-skeleton');
