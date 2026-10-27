# Smart Avatars

`sf-avatars` draws ready combinations of avatars from `sf-avatar`'s parts and
the avatars sheet: a person with a source, a stacked group with a remainder,
an avatar with two lines of label, and a profile avatar with a verified badge.
For a single avatar that is a control, with a name or a card, use `sf-avatar`.

The avatars are pictures beside visible text: each image has `alt=""` and is
hidden from assistive technology, and the printed name, label or remainder
names the person or the group. Nothing takes focus.

## Templates

- `default` — one avatar, `round-size` or `avatar-size`; `active` shows the
  online dot, `check` the verified badge;
- `user` — an avatar with `name` and `source` (a link icon before it);
- `group` — `avatars` stacked, `avatars-more` as the last one (`+5`), at
  `round-size` (1/2 by default);
- `label` — an avatar (`avatar-url`) with `label-text` and `label-second-text`,
  at `label-size` or `avatar-size`;
- `profile` — one avatar at `profile-size` (`small` 2, `big` 3) with the
  verified badge.

Sizes are the avatar ladder (`1/4`, `1/3`, `1/2`, `1`, `2`, `3`) or the old
names (`tiny`, `extra_small`, `small`, `big`, `extra_big`).

## Settings

- `image-url`, `avatar-url`, `avatar-size`, `name`, `source`, `label-text`,
  `label-second-text`, `avatars-more`, `round-size`, `label-size`,
  `profile-size`, `check`, `active`;
- `avatars` — a list of `{imageUrl, text}` (an image, else its initials); the
  attribute takes it as JSON text;
- `fields` — JSON text of the same fields in one attribute; an attribute of a
  field wins over it. Its old name `data` is a dated alias until 2026-12-01:
  `data` is a reserved name (standard simai.smart-component 1.3.8 §3.1);
- `property` — JSON text of the sizes (`round_size`, `label_size`,
  `profile_size`).

```html
<sf-avatars template="label" avatar-url="/img/team.png" label-text="Команда проекта"
  label-second-text="5 участников"></sf-avatars>

<sf-avatars template="group" round-size="1" avatars-more="5"
  avatars='[{"text": "АЗ"}, {"text": "БИ"}, {"imageUrl": "/img/v.png"}]'></sf-avatars>
```

The look is the avatar sheet's public variables: `--sf-avatar-background-color`,
`-color`, `-border-color`, `-border-width` and `-radius`.

The interface is `component.json`; examples are `examples.json`.
