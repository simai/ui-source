import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';

class Fab extends ComponentObserver {
  static componentName = 'Fab';
  html = null;
  scrollHandler = this.scrollSetup.bind(this);

  constructor(props) {
    super(props);
    const {
      size = '1',
      type = 'default',
      scheme = 'primary',
      icon = 'chevron_left',
    } = this.params || {};
    const className = this.attrs.class || this.attrs.className;
    this.button = document.createElement('button');
    if (this.id) {
      this.button.id = this.id;
    }
    this.button.classList.add(
      'sf-fab',
      'flex',
      'flex-row',
      'flex-nowrap',
      'justify-center',
      'items-center',
      'rotate-90',
      'z-7',
      'cursor-pointer',
      'transition-bg',
      'fixed',
      'radius-rounded',
      'opacity-0',
      'invisible',
      'block-end-b6',
      'inline-end-b6',
      'md:block-end-c5',
      'md:inline-end-c5',
      `sf-fab--size-${size}`,
      `sf-fab--${type}`,
      `sf-fab--${scheme}`,
    );
    if (className) {
      this.button.classList.add(...`${className}`.split(' ').filter(Boolean));
    }
    Object.entries(this.attrs)
      .filter(([attr]) => !['class', 'className'].includes(attr))
      .forEach(([attr, value]) => {
        if (value === undefined || value === null) {
          return;
        }
        this.button.setAttribute(attr, value);
      });
    if (!this.button.hasAttribute('type')) {
      this.button.setAttribute('type', 'button');
    }
    this.icon = document.createElement('i');
    this.icon.classList.add(
      'sf-icon',
      'flex',
      'justify-center',
      'items-center',
    );
    this.icon.setAttribute('aria-hidden', 'true');
    this.icon.textContent = icon;
    this.button.append(this.icon);
    this.template = this.button;
  }

  top() {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  scrollSetup() {
    if (window.scrollY > 200) {
      this.button.classList.replace('opacity-0', 'opacity-full');
      this.button.classList.replace('invisible', 'visible');
    } else {
      this.button.classList.replace('opacity-full', 'opacity-0');
      this.button.classList.replace('visible', 'invisible');
    }
  }

  init() {
    this.button.addEventListener('click', this.top);
    window.addEventListener('scroll', this.scrollHandler);
    this.scrollSetup();
  }

  destroyInternal() {
    window.removeEventListener('scroll', this.scrollHandler);
    this.button.removeEventListener('click', this.top);
  }
}

registerComponent('Fab', Fab);
