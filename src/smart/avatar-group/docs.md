# Smart Avatars

`sf-avatar-group` draws ready combinations of avatars from `sf-avatar`'s parts and
the avatars sheet: a person with a source, a stacked group with a remainder,
an avatar with two lines of label, and a profile avatar with a verified badge.
For a single avatar that is a control, with a name or a card, use `sf-avatar`.

In the `user`, `label`, `profile` and `default` templates the avatars are
pictures beside visible text: each image has `alt=""` and the printed name or
label names the person. The `group` template is described below.

## Templates

- `default` — one avatar, `round-size` or `avatar-size`; `active` shows the
  online dot, `check` the verified badge;
- `user` — an avatar with `name` and `source` (a link icon before it);
- `group` — `avatars` stacked at `round-size` (1/2 by default); see "Group";
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
- `avatars` — a list of `{imageUrl, text, name, status, hue}`: the photo (over
  its initials), the initials, the person's name (it names the avatar, gives
  the initials and the hue of the name, and shows in a tooltip), `online` or
  `away`, a named hue; the attribute takes it as JSON text;
- `fields` — JSON text of the same fields in one attribute; an attribute of a
  field wins over it. Its old name `data` is a dated alias until 2026-12-01:
  `data` is a reserved name (standard simai.smart-component 1.3.8 §3.1);
- `property` — JSON text of the sizes (`round_size`, `label_size`,
  `profile_size`).

```html
<sf-avatar-group template="label" avatar-url="/img/team.png" label-text="Команда проекта"
  label-second-text="5 участников"></sf-avatar-group>

<sf-avatar-group template="group" round-size="1" avatars-more="5"
  avatars='[{"name": "Анна Захарова"}, {"name": "Борис Ильин"}, {"text": "ВП"}]'></sf-avatar-group>
```

## Group

Owner decision C152 (6), (7), 2026-11-14:

- up to four people are shown; the fifth place is «+N», the exact number of
  the others;
- when `avatars` holds more than four people, «+N» is a button of the same
  size and shape («Ещё 5 участников») that opens the list of everyone in an
  sf-popover; with only `avatars-more` (no list) «+N» is text;
- the group is `role="group"` named «Участники: N» (N = everyone, the list
  and `avatars-more`);
- each avatar is a picture named by the person, in the hue of the name, with
  the name in a tooltip on hover;
- the avatars overlap by 4 px up to size 1 and 8 px at 2 and 3, so the
  letters stay whole; the cut-out is the presence point's ring, 2 px from 1/2.

```html
<sf-avatar-group template="group" round-size="1"
  avatars='[{"name": "Анна Белова"}, {"name": "Иван Петров"}, {"name": "Ольга Смирнова"},
    {"name": "Илья Орлов"}, {"name": "Мария Козлова"}, {"name": "Алина Ким"}]'></sf-avatar-group>
```

The look is the avatar sheet's public variables: `--sf-avatar-background-color`,
`-color`, `-border-color`, `-border-width` and `-radius`, and for the offline dot
`--sf-avatar-offline-background-color` (the dot's colour, the place's dim
ink by default) and `--sf-avatar-offline-overlay` (`none` by default, a layer
over it).

The interface is `component.json`; examples are `examples.json`.
