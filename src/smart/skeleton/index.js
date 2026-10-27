import SfBaseElement, { toAttributeName } from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderSkeletonTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';



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

// sf-skeleton from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §5.4): its settings are attributes and properties made by
// core/js/element-manifest.js; variant is a dated alias of kind (aliases.json).
// The bars are CSS only and aria-hidden: the region that waits names itself.
const SkeletonElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfSkeleton extends SkeletonElement {
  static get props() {
    return {
      ...super.props,
      // The axis is called kind, because that is the question it answers.
      // `variant` keeps working: see contracts/public-api-axes.json.
      kind: {default: 'text', values: ['text', 'circle', 'square', 'rounded'], aliases: ['variant']},
      rootClass: { default: '' },
    };
  }

  get kind() {
    return this.getProp('kind');
  }

  set kind(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('kind');
    else this.setAttribute('kind', String(value));
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      rootClass: this.getRootClass(),
      // Resolved names the template reads (contracts/template-context.json).
      variant: this.kind,
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
      kind: this.kind,
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
