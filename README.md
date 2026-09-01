# `@phreshos/react`

Runtime-neutral React adapters for PhreshOS contracts.

The React SDK receives explicit Core handles and live sources. It does not
initialize transport, import the Client SDK, access the browser, or define
domain state.

## Installation

| Package manager | Command |
| --- | --- |
| npm | `npm install @phreshos/react` |
| pnpm | `pnpm add @phreshos/react` |
| Bun | `bun add @phreshos/react` |
| Yarn | `yarn add @phreshos/react` |

`@phreshos/core` and React are peer dependencies.

## Providers

```tsx
import { ContextProvider, SystemProvider } from "@phreshos/react"

<SystemProvider
  appearance={system.appearance}
  desktopSurface={system.desktop.surface}
  desktopPointer={system.desktop.pointer}
  desktopPreferences={system.desktop.preferences}
>
  <ContextProvider
    program={() => context.program()}
    process={() => context.process()}
    parent={() => context.process().then(process => process.parent())}
  >
    {children}
  </ContextProvider>
</SystemProvider>
```

Each provider accepts explicitly selected sources and resolves only those
values. A provider requires at least one source; mounting it does not fetch an
entire runtime implicitly.

## Hooks

Context hooks expose the supplied handles:

- `useProgram()`
- `useProcess()`
- `useParent()`

System hooks expose the supplied live snapshots:

- `useSystemAppearance()`
- `useDesktopSurface()`
- `useDesktopPointer()`
- `useDesktopPreferences()`

State hooks compose one explicit read with future events:

- `useProgramState()`
- `useProcessState()`
- `useServiceState()`
- `useWindowState()`

`useSubscribe()`, `useSubscribeAsks()`, and `useSubscribeAnswers()` own
their mounted registrations and clean them up on unmount. Unresolved initial
reads remain `undefined`; the adapters do not invent fallback domain state.

## Development

```sh
bun install --frozen-lockfile
bun run verify
```

`verify` checks the contracts, tests the adapters in React, builds the package,
and validates its public artifact.

## Repository boundary

This repository owns React lifecycle adaptation only. Core owns the contracts,
runtime SDKs provide the sources, and React UI owns visual components.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the repository workflow and
[SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

Licensed under the [MIT License](LICENSE). Copyright © 2026 Zohayr SLILEH.
