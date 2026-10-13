import SfBaseElement, { toBoolean, parseJsonAttribute } from '../../core/js/smart-base';
import { renderAvatarsTemplate } from './js/templates/default';
import '../../component/avatars/scss/index.scss';




class SfAvatars extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      data: { default: '' },
      property: { default: '' },
      imageUrl: { default: '' },
      avatarUrl: { default: '' },
      avatarSize: { default: '' },
      active: { type: Boolean, default: false },
      check: { type: Boolean, default: false },
      name: { default: '' },
      source: { default: '' },
      labelText: { default: '' },
      labelSecondText: { default: '' },
      avatars: { type: Array, default: [] },
      avatarsMore: { default: '' },
      roundSize: { default: '' },
      labelSize: { default: '' },
      profileSize: { default: '' },
      rootClass: { default: '' },
    };
  }


  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get dataValue() {
    return parseJsonAttribute(this, 'data', {});
  }

  get propertyValue() {
    return parseJsonAttribute(this, 'property', {});
  }

  get imageUrl() {
    return (
      this.getAttribute('image-url') ||
      this.dataValue.imageUrl ||
      this.dataValue.image_url ||
      ''
    );
  }

  get avatarUrl() {
    return (
      this.getAttribute('avatar-url') ||
      this.dataValue.avatarUrl ||
      this.dataValue.avatar_url ||
      this.imageUrl
    );
  }

  get avatarSize() {
    return (
      this.getAttribute('avatar-size') ||
      this.dataValue.avatarSize ||
      this.dataValue.avatar_size ||
      this.roundSize
    );
  }

  get active() {
    return this.hasAttribute('active')
      ? this.getBooleanAttr('active', true)
      : toBoolean(this.dataValue.active, false);
  }

  get check() {
    return this.hasAttribute('check')
      ? this.getBooleanAttr('check', true)
      : toBoolean(this.dataValue.check, false);
  }

  get name() {
    return this.getAttribute('name') || this.dataValue.name || '';
  }

  get source() {
    return this.getAttribute('source') || this.dataValue.source || '';
  }

  get labelText() {
    return (
      this.getAttribute('label-text') ||
      this.dataValue.labelText ||
      this.dataValue.label_text ||
      ''
    );
  }

  get labelSecondText() {
    return (
      this.getAttribute('label-second-text') ||
      this.dataValue.labelSecondText ||
      this.dataValue.label_second_text ||
      ''
    );
  }

  get avatars() {
    const attrValue = this.getAttribute('avatars');
    if (attrValue) {
      try {
        return JSON.parse(attrValue);
      } catch (error) {
        console.warn('sf-avatars: invalid avatars JSON', error);
      }
    }

    return Array.isArray(this.dataValue.avatars) ? this.dataValue.avatars : [];
  }

  get avatarsMore() {
    return (
      this.getAttribute('avatars-more') ||
      this.dataValue.avatarsMore ||
      this.dataValue.avatars_more ||
      ''
    );
  }

  get roundSize() {
    return (
      this.getAttribute('round-size') ||
      this.propertyValue.round_size ||
      this.propertyValue.roundSize ||
      ''
    );
  }

  get labelSize() {
    return (
      this.getAttribute('label-size') ||
      this.propertyValue.label_size ||
      this.propertyValue.labelSize ||
      ''
    );
  }

  get profileSize() {
    return (
      this.getAttribute('profile-size') ||
      this.propertyValue.profile_size ||
      this.propertyValue.profileSize ||
      ''
    );
  }

  get rootClass() {
    return this.getAttribute('root-class') || '';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      imageUrl: this.imageUrl,
      avatarUrl: this.avatarUrl,
      avatarSize: this.avatarSize,
      active: this.active,
      check: this.check,
      name: this.name,
      source: this.source,
      labelText: this.labelText,
      labelSecondText: this.labelSecondText,
      avatars: this.avatars,
      avatarsMore: this.avatarsMore,
      roundSize: this.roundSize,
      labelSize: this.labelSize,
      profileSize: this.profileSize,
      rootClass: this.rootClass,
    });
  }

  hasBuiltInTemplate(templateName = this.templateName) {
    return ['default', 'user', 'group', 'label', 'profile'].includes(
      templateName,
    );
  }

  template() {
    return renderAvatarsTemplate(this.templateContext());
  }

  get value() {
    return this.templateContext();
  }

  set value(nextValue) {
    this.setValueAttributes(nextValue, { removeEmptyString: false });
  }
}

SfAvatars.define('sf-avatars');
