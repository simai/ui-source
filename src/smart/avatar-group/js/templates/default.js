import { html, nothing } from 'lit';
import { avatarClasses, avatarContent, statusBadge } from '../../../avatar/js/templates/shared';

// The combinations are drawn from the avatar's own parts -- sf-avatar,
// sf-avatar-group, sf-avatar-label-group, the online indicator and the verified
// badge -- the classes the avatars sheet styles. The templates wrote an older
// set (sf-avatar-round, sf-avatar--image, sf-avatar-cir, sf-avatar-check,
// sf-avatar-profile) that no sheet in the release answered: every avatar was
// drawn with no shape and no size. Each avatar was also a button with no name
// and nothing to do; an avatar here is a picture, and the visible text names the
// person.

const SIZES = ['1/4', '1/3', '1/2', '1', '2', '3'];

const SIZE_NAMES = {
  tiny: '1/4',
  extra_small: '1/3',
  extraSmall: '1/3',
  small: '1/2',
  default: '1',
  big: '2',
  extra_big: '3',
  extraBig: '3',
};

const PROFILE_SIZES = {
  small: '2',
  big: '3',
};

function step(value, fallback = '1') {
  const text = String(value ?? '').trim();
  const named = SIZE_NAMES[text] ?? text;
  return SIZES.includes(named) ? named : fallback;
}

// How far the avatars of a group overlap, by the size they are drawn at.
function groupStep(size) {
  if (size === '1/4' || size === '1/3') return 'xs';
  if (size === '1/2') return 'sm';
  return 'md';
}

function avatar(options) {
  const imageUrl = options.imageUrl || '';
  const context = {
    size: options.size,
    line: '',
    shape: 'circle',
    imageUrl,
    isImage: Boolean(imageUrl),
    text: options.text || '',
    isText: !imageUrl && Boolean(options.text),
    status: options.status || 'none',
    rootClass: options.rootClass || '',
    component: options.component,
  };
  return html`
    <span class=${avatarClasses(context)} style=${options.rootStyle || nothing}>
      ${avatarContent(context)} ${statusBadge(context)}
    </span>
  `;
}

function status(context) {
  if (context.check) return 'verified';
  if (context.active) return 'online';
  return 'none';
}

function renderDefaultTemplate(context) {
  return avatar({
    size: step(context.roundSize || context.avatarSize),
    imageUrl: context.imageUrl,
    status: status(context),
    rootClass: context.rootClass,
    rootStyle: context.rootStyle,
    component: context.component,
  });
}

function labelGroup(context, {size, imageUrl, title, text, icon}) {
  return html`
    <div class=${['sf-avatar-label-group', `sf-avatar-label-group--size-${size}`, 'flex', 'items-cross-center', context.rootClass]
      .filter(Boolean)
      .join(' ')} style=${context.rootStyle || nothing}>
      ${avatar({ size, imageUrl, component: context.component })}
      <div class="sf-avatar-label-group-container flex flex-col">
        ${title ? html`<div class="sf-avatar-label-group-title">${title}</div>` : nothing}
        ${text
          ? html`<div class="sf-avatar-label-group-text">
              ${icon ? html`<i class="sf-icon" aria-hidden="true">${icon}</i>` : nothing}
              <span>${text}</span>
            </div>`
          : nothing}
      </div>
    </div>
  `;
}

function renderUserTemplate(context) {
  return labelGroup(context, {
    size: step(context.avatarSize),
    imageUrl: context.imageUrl,
    title: context.name,
    text: context.source,
    icon: context.source ? 'link' : '',
  });
}

function renderLabelTemplate(context) {
  return labelGroup(context, {
    size: step(context.labelSize || context.avatarSize),
    imageUrl: context.avatarUrl,
    title: context.labelText,
    text: context.labelSecondText,
  });
}

function renderGroupTemplate(context) {
  const size = step(context.roundSize, '1/2');
  const more = String(context.avatarsMore ?? '').trim();
  return html`
    <div class=${['sf-avatar-group', `sf-avatar-group--size-${groupStep(size)}`, 'flex', 'items-cross-center', context.rootClass]
      .filter(Boolean)
      .join(' ')} style=${context.rootStyle || nothing}>
      <div class="sf-avatar-group-avatars flex">
        ${context.avatars.map((item) => avatar({
          size,
          imageUrl: item.imageUrl || item.image_url,
          text: item.text || item.initials,
          component: context.component,
        }))}
        ${more ? avatar({ size, text: /^\d+$/u.test(more) ? `+${more}` : more, component: context.component }) : nothing}
      </div>
    </div>
  `;
}

function renderProfileTemplate(context) {
  return avatar({
    size: PROFILE_SIZES[context.profileSize] || step(context.profileSize, '3'),
    imageUrl: context.imageUrl,
    status: 'verified',
    rootClass: context.rootClass,
    rootStyle: context.rootStyle,
    component: context.component,
  });
}

export function renderAvatarsTemplate(context) {
  switch (context.templateName) {
    case 'user':
      return renderUserTemplate(context);
    case 'group':
      return renderGroupTemplate(context);
    case 'label':
      return renderLabelTemplate(context);
    case 'profile':
      return renderProfileTemplate(context);
    default:
      return renderDefaultTemplate(context);
  }
}
