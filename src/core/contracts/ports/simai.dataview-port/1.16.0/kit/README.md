# Conformance kit — data view host port 1.16.0

The 47 case files of kit 1.15.0 are here, unchanged, and six more about the
levels of a saved view and the person's own view state (owner decision C298):

- `saved-views-name-their-level` -- each saved view names its level: `system`
  (the product's own), `shared` (for everyone) or `personal` (the person's).
  The views menu is grouped by them. `package`, the name 1.0.0 to 1.15.0 gave
  the system level, is read as `system` until 2027-01-01.
- `system-view-is-not-written` -- a system view is never written through the
  port: `view.save` on it is refused, and the person's change is saved as a
  new view of their own (or for everyone).
- `preferences-come-with-the-first-answer` -- with `personal-preferences` the
  first answer to `query.change` carries `data.preferences`: the page size,
  whether the view zone is open, the view opened last, and the revision.
- `preferences-save-merges-the-changed-fields` -- `preferences.save` names
  only what changed and is merged into the layer against its revision.
- `preferences-save-conflict` -- a save against an old revision is a conflict
  naming the current one; the view raises the same change again.
- `preferences-without-the-capability-stay-in-the-browser` -- a host that
  keeps no state for this person (a guest) is not asked; the view keeps it in
  the browser.

Every addition is optional, so a host that passes kit 1.15.0 passes this one:
a host that names no level and does not announce `personal-preferences` passes
the new cases by never receiving `preferences.save` and by refusing a write to
a view it ships itself.

A host claims this port only after it passes every case here and records the
kit version, its own revision and the result.

Each case is a plain document: `given` is the state the host is put in, `when`
is the intent the component raises with its payload, `then` is the answer the
host owes and what that answer must carry. Nothing here names an address, a
format, a framework or a language, so a host on any transport can pass it.

## How a host runs the kit

1. Put the store in the state `given` describes. Anything the case does not
   name is the host's own choice.
2. Deliver the payload of `when` as the named intent. A host may call its own
   handler directly; the browser is not required.
3. Compare the answer with `then`:
   - `answer` — one of `applied`, `conflict`, `refused`, `unavailable`;
   - `answer_must_include` — fields the answer carries, such as the current
     revision of a conflict or the reason of a refusal;
   - `data_must_include` — keys of the port's data the answer supplies;
   - `echo_must_equal` / `echo_must_include` — the request the answer repeats;
   - `note` — what else the case checks, in words.
4. A case with a `capability` applies only to a host that announces it. A host
   that does not announce it passes the case by never receiving the intent.

## Digest

`sha256` in `port.json` is over the listing of this directory: for every file,
sorted by path, the line `<path relative to the kit> <sha256 of the bytes>\n`,
then the sha256 of that listing.
