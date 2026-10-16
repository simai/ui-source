# Conformance kit — data view host port 1.12.0

The 43 case files of kit 1.11.0 are here. One changes its note:
`settings-personal-compare-and-set` said a reset writes the package layer; a
reset writes an empty object to the personal layer against its revision, and
the host's own layers show again. One case is added for the answer this
edition describes: `query-answer-names-its-sequence` (an answer to
query.change names the sequence it answers).

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
