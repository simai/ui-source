import registerComponent from '../../register-helper';

const ROOT_SELECTOR = '.sf-hide-show';
const ACTION_SELECTOR = '[data-action], .sf-show, .sf-hide';
const CONTENT_SELECTOR = '[data-content], .sf-hide-show-content, .hide-show-block';
const LEGACY_HIDDEN_CLASSES = ['hidden', 'hidden>block', 'block>hidden'];
const instances = new WeakMap();
let contentId = 0;

function ownedNodes(root, selector) {
  return [...root.querySelectorAll(selector)]
    .filter((node) => node.closest(ROOT_SELECTOR) === root);
}

function actionName(control) {
  const explicit = control.getAttribute('data-action');
  if (['show', 'hide', 'toggle'].includes(explicit)) return explicit;
  if (control.classList.contains('sf-show')) return 'show';
  if (control.classList.contains('sf-hide')) return 'hide';
  return '';
}

class HideShow {
  static componentName = 'HideShow';

  constructor(root) {
    this.root = root;
    this.actions = [];
    this.contents = [];
    this.hidden = false;
    this.onClick = this.handleClick.bind(this);
  }

  init() {
    if (!(this.root instanceof HTMLElement) || this.root.dataset.hideShowInit === '1') return this;

    this.actions = ownedNodes(this.root, ACTION_SELECTOR)
      .filter((control) => actionName(control));
    this.contents = ownedNodes(this.root, CONTENT_SELECTOR);

    if (this.contents.length === 0) {
      const actionSet = new Set(this.actions);
      this.contents = [...this.root.children]
        .filter((node) => !actionSet.has(node) && !node.matches(ACTION_SELECTOR));
    }
    if (this.contents.length === 0 || this.actions.length === 0) return this;

    this.hidden = this.initialHiddenState();
    LEGACY_HIDDEN_CLASSES.forEach((className) => this.root.classList.remove(className));
    this.contents.forEach((content) => content.classList.remove('hidden'));
    this.bindRelationships();
    this.root.addEventListener('click', this.onClick);
    this.root.dataset.hideShowInit = '1';
    instances.set(this.root, this);
    this.sync();
    return this;
  }

  destroy() {
    this.root?.removeEventListener('click', this.onClick);
    if (this.root) delete this.root.dataset.hideShowInit;
    instances.delete(this.root);
  }

  initialHiddenState() {
    if (this.root.dataset.state === 'hidden') return true;
    if (LEGACY_HIDDEN_CLASSES.some((className) => this.root.classList.contains(className))) return true;
    const first = this.contents[0];
    return first.hidden || first.classList.contains('hidden');
  }

  bindRelationships() {
    const ids = this.contents.map((content) => {
      if (!content.id) {
        contentId += 1;
        content.id = `sf-hide-show-content-${contentId}`;
      }
      return content.id;
    });

    this.actions.forEach((control) => {
      control.setAttribute('aria-controls', ids.join(' '));
    });
  }

  sync() {
    this.contents.forEach((content) => {
      content.hidden = this.hidden;
    });
    this.actions.forEach((control) => {
      const action = actionName(control);
      control.setAttribute('aria-expanded', this.hidden ? 'false' : 'true');
      if (action === 'show') control.hidden = !this.hidden;
      if (action === 'hide') control.hidden = this.hidden;
    });
    this.root.dataset.state = this.hidden ? 'hidden' : 'shown';
  }

  requestState(hidden, action = hidden ? 'hide' : 'show', source = null) {
    const nextHidden = Boolean(hidden);
    if (nextHidden === this.hidden) return true;

    const accepted = this.root.dispatchEvent(new CustomEvent('sf-hide-show:change', {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail: {action, hidden: nextHidden, shown: !nextHidden},
    }));
    if (!accepted) return false;

    const transferFocus = source === document.activeElement;
    this.hidden = nextHidden;
    this.sync();

    if (transferFocus && source.hidden) {
      const counterpart = this.actions.find((control) => !control.hidden && !control.disabled);
      counterpart?.focus({preventScroll: true});
    }
    return true;
  }

  show(source = null) {
    return this.requestState(false, 'show', source);
  }

  hide(source = null) {
    return this.requestState(true, 'hide', source);
  }

  toggle(source = null) {
    return this.requestState(!this.hidden, 'toggle', source);
  }

  handleClick(event) {
    const control = event.target.closest(ACTION_SELECTOR);
    if (!control || control.closest(ROOT_SELECTOR) !== this.root || control.disabled) return;

    const action = actionName(control);
    if (action === 'show') this.show(control);
    if (action === 'hide') this.hide(control);
    if (action === 'toggle') this.toggle(control);
  }
}

function initRoot(root) {
  if (!(root instanceof HTMLElement) || !root.matches(ROOT_SELECTOR)) return;
  const instance = instances.get(root) || new HideShow(root);
  instance.init();
}

function initTree(target = document) {
  if (target instanceof HTMLElement && target.matches(ROOT_SELECTOR)) initRoot(target);
  target.querySelectorAll?.(ROOT_SELECTOR).forEach(initRoot);
}

function destroyTree(target) {
  if (!(target instanceof HTMLElement)) return;
  if (target.matches(ROOT_SELECTOR)) instances.get(target)?.destroy();
  target.querySelectorAll?.(ROOT_SELECTOR).forEach((root) => instances.get(root)?.destroy());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initTree(), {once: true});
} else {
  initTree();
}

if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => initTree(node));
      mutation.removedNodes.forEach((node) => destroyTree(node));
    });
  });
  observer.observe(document.documentElement, {childList: true, subtree: true});
}

registerComponent('HideShow', HideShow);

export default HideShow;
