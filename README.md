# `@phreshos/react`

Runtime-neutral React adapters for PhreshOS contracts.

[Documentation](https://docs.phreshos.com/sdks/react) ·
[Runtime model](https://docs.phreshos.com/runtime) ·
[Source](https://github.com/PhreshOS/react)

## Role

The React SDK adapts explicitly supplied Core contracts and live sources to
React providers and hooks. It does not initialize a transport, import the
Client SDK, access the browser, define domain state, or render visual language.

`SystemProvider`, `ContextProvider`, and `DesktopProvider` preserve the
separation between the global System, current Client Context, and containing
Desktop. State and subscription hooks preserve unresolved state and own only
their React lifecycle.

## Installation

| Package manager | Command |
| --- | --- |
| npm | `npm install @phreshos/react` |
| pnpm | `pnpm add @phreshos/react` |
| Bun | `bun add @phreshos/react` |
| Yarn | `yarn add @phreshos/react` |

`@phreshos/core` and React are peer dependencies.

```tsx
import {
  ContextProvider,
  DesktopProvider,
  SystemProvider,
} from "@phreshos/react"

<SystemProvider system={system}>
  <DesktopProvider desktop={desktop}>
    <ContextProvider context={context}>{children}</ContextProvider>
  </DesktopProvider>
</SystemProvider>
```

See [React SDK](https://docs.phreshos.com/sdks/react) for providers, state
hooks, and subscription hooks.

## Development

```sh
bun install --frozen-lockfile
bun run verify
```

`verify` checks the contracts, tests the adapters, builds the package, and
validates its published shape.

## Related repositories

- [`@phreshos/core`](https://github.com/PhreshOS/core) owns every contract
  accepted by these adapters.
- [`@phreshos/client`](https://github.com/PhreshOS/client) supplies Client
  runtime values without becoming a dependency of this package.
- [`@phreshos/react-ui`](https://github.com/PhreshOS/react-ui) owns reusable
  visual components and Appearance interpretation.
- [PhreshOS System](https://github.com/PhreshOS/system) composes these adapters
  in the Desktop.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the repository workflow and
[SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

Licensed under the [MIT License](LICENSE). Copyright © 2026 Zohayr SLILEH.
