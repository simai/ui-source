# Smart Avatar

`sf-avatar` is a light-DOM smart custom element powered by `lit`.

Loading model:

- detected by `tags: ['sf-avatar']` in `src/smart/avatar/rule.js`
- loaded as smart bundle `cl-avatar`
- base styles and base bundle are loaded through relation with `avatars`
- updates are batched through the shared `SfBaseElement`; by default `lit` patches the DOM, with optional direct node patching for simple attribute changes

## Attributes

- `template`: `default | label | card`
- `size`: `1/4 | 1/3 | 1/2 | 1 | 2 | 3`
- `shape`: `circle | square`
- `image-url`
- `image-alt`
- `text`
- `status`: `none | online | offline | company | verified`
- `aria-label`
- `title`
- `description`
- `meta`
- `meta-icon`
- `card-variant`: `square | portrait`
- `disabled`

The default and label templates intentionally render a native button. Its
`aria-label` must describe the action (for example, “Open Anna's profile”), not
the visual photograph. The card template is non-interactive. Images inside a
label or card use `alt=""` when the adjacent title already provides the same
identity; set `image-alt` only when the image contributes additional meaning.

Availability and verification badges are decorative projections. Include the
status in visible text or the native control's accessible name; color alone is
not a status contract.

## Lifecycle events

The host element dispatches bubbling custom events from `SfBaseElement`:

- `sf-connected`
- `sf-before-render`
- `sf-after-render`
- `sf-updated`
- `sf-disconnected`

`event.detail` includes:

- `component`
- `tagName`
- `template`
- `changedAttributes` (for render/update events)
- `updateMode` (for `sf-updated`)

## External project templates

`SfBaseElement` supports optional external project templates without framework rebuild.

Path format:

- `/local/smart/templates/avatar/<template>/index.js`
- `/local/smart/templates/avatar/<template>/index.css`

Example:

- `<sf-avatar template="custom"></sf-avatar>`

`index.js` should export `default` as a render function:

```js
export default function template({ html, nothing, context, component }) {
  return html`<div>${context.title || nothing}</div>`;
}
```

## Slot overrides

`sf-avatar` supports optional light-DOM slot overrides for badge parts.

Supported slot names:

- `company-badge`
- `verified-badge`
- `online-indicator`

Example:

```html
<sf-avatar status="company" text="AB">
  <span slot="company-badge">
    <img src="/local/badges/company.svg" alt="" />
  </span>
</sf-avatar>
```

Priority:

1. slot override
2. built-in badge/indicator
