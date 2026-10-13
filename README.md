# Simai Framework source

`ui-source` is the editable source repository for SIMAI Framework. It owns Core,
the Loader, utilities, components, Smart Components, their contracts, and source
tests.

Most projects should install a fixed release from [`simai/ui`](https://github.com/simai/ui),
which carries Core, rules, components, utilities and Smart Components
(`distr/smart`). [`simai/ui-smart`](https://github.com/simai/ui-smart) was a
byte-identical mirror of `distr/smart` while consumers moved; it is archived,
read-only, with its history kept. `simai/ui` holds generated output and is not
edited directly.

The Framework is extended through component packages: a component lives with
its owner. Larena's components (`sf-table`, `sf-data-view`, `sf-property-view`,
`sf-admin-menu`) are the package `larena`, built from the component folder of
`simai/larena-ui` against a pinned revision of this repository and delivered
inside Larena's distribution; see
[docs/developer/component-packages.md](docs/developer/component-packages.md)
and the standard `simai.component-package`.

## Repository roles

- `simai/ui-source` — editable Framework source;
- `simai/ui-builder` — deterministic build system;
- `simai/ui` — generated Framework distribution (Core, utilities, components, Smart Components);
- `simai/ui-smart` — archived: it mirrored `ui/distr/smart` while consumers moved;
- `simai/larena-ui` — Larena's UI, whose component folder is the package `larena` (Apache-2.0); `simai/ui-source-pro` and `simai/ui-pro` are archived;
- `simai/ui-doc` — public documentation.

The Loader is one module inside this repository. The previous repository name
`simai/ui-loader` is retained by GitHub redirects for compatibility.

## Local checks

Use the Node.js version accepted by the current build contract, install the
locked dependencies, and run:

```bash
yarn install --frozen-lockfile
yarn test:unit
```

Build release artifacts through `simai/ui-builder`; do not commit generated
`ui` output here.

## License

Project-owned SIMAI Framework source is available under the
[Apache License 2.0](LICENSE); see also [NOTICE](NOTICE). Code published before
the change was released under the MIT License, and copies taken under it keep
those terms. Bundled third-party code and fonts remain under their original
licences; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## Smart component terminology

[Composite Smart Component / составной смарт-компонент](docs/developer/smart-component-terminology.md) describes components that coordinate their children. Public identifiers and schemas are unchanged.
