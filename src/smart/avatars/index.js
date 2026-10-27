import SfBaseElement, { toBoolean, parseJsonAttribute } from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderAvatarsTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import '../../component/avatars/scss/index.scss';

// sf-avatars from its component.json (standard simai.smart-component 1.3.8 §3,
// §4): the settings are the attributes and properties
// core/js/element-manifest.js makes from the manifest. Each also falls back
// to its field in the JSON text of fields (data until 2026-12-01: data is a
// reserved name, §3.1) or, for the sizes, of property; the getters below say
// that.
const AvatarsElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfAvatars extends AvatarsElement {
  static get props() {
    return {
      ...super.props,
      templateName: { attribute: 'template', default: 'default' },
      // The list also arrives as JSON text in the attribute, as it always did.
      avatars: { type: Array, default: [], attribute: 'avatars' },
    };
  }


  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get dataValue() {
    return parseJsonAttribute(this, 'fields', {});
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

  set imageUrl(value) {
    super.imageUrl = value;
  }

  get avatarUrl() {
    return (
      this.getAttribute('avatar-url') ||
      this.dataValue.avatarUrl ||
      this.dataValue.avatar_url ||
      this.imageUrl
    );
  }

  set avatarUrl(value) {
    super.avatarUrl = value;
  }

  get avatarSize() {
    return (
      this.getAttribute('avatar-size') ||
      this.dataValue.avatarSize ||
      this.dataValue.avatar_size ||
      this.roundSize
    );
  }

  set avatarSize(value) {
    super.avatarSize = value;
  }

  get active() {
    return this.hasAttribute('active')
      ? this.getBooleanAttr('active', true)
      : toBoolean(this.dataValue.active, false);
  }

  set active(value) {
    super.active = value;
  }

  get check() {
    return this.hasAttribute('check')
      ? this.getBooleanAttr('check', true)
      : toBoolean(this.dataValue.check, false);
  }

  set check(value) {
    super.check = value;
  }

  get name() {
    return this.getAttribute('name') || this.dataValue.name || '';
  }

  set name(value) {
    super.name = value;
  }

  get source() {
    return this.getAttribute('source') || this.dataValue.source || '';
  }

  set source(value) {
    super.source = value;
  }

  get labelText() {
    return (
      this.getAttribute('label-text') ||
      this.dataValue.labelText ||
      this.dataValue.label_text ||
      ''
    );
  }

  set labelText(value) {
    super.labelText = value;
  }

  get labelSecondText() {
    return (
      this.getAttribute('label-second-text') ||
      this.dataValue.labelSecondText ||
      this.dataValue.label_second_text ||
      ''
    );
  }

  set labelSecondText(value) {
    super.labelSecondText = value;
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
    const own = super.avatars;
    if (Array.isArray(own) && own.length) return own;

    return Array.isArray(this.dataValue.avatars) ? this.dataValue.avatars : [];
  }

  set avatars(value) {
    super.avatars = value;
  }

  get avatarsMore() {
    return (
      this.getAttribute('avatars-more') ||
      this.dataValue.avatarsMore ||
      this.dataValue.avatars_more ||
      ''
    );
  }

  set avatarsMore(value) {
    super.avatarsMore = value;
  }

  get roundSize() {
    return (
      this.getAttribute('round-size') ||
      this.propertyValue.round_size ||
      this.propertyValue.roundSize ||
      ''
    );
  }

  set roundSize(value) {
    super.roundSize = value;
  }

  get labelSize() {
    return (
      this.getAttribute('label-size') ||
      this.propertyValue.label_size ||
      this.propertyValue.labelSize ||
      ''
    );
  }

  set labelSize(value) {
    super.labelSize = value;
  }

  get profileSize() {
    return (
      this.getAttribute('profile-size') ||
      this.propertyValue.profile_size ||
      this.propertyValue.profileSize ||
      ''
    );
  }

  set profileSize(value) {
    super.profileSize = value;
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
