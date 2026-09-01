# Contributing

React adapts explicit PhreshOS contracts to React lifecycles. A
change belongs here when it owns React resolution, subscription, cleanup, or
derivation without redefining domain objects or moving system authority into a
component or hook.

## Development

Install the pinned toolchain and verify the complete repository:

```sh
bun install --frozen-lockfile
bun run verify
```

`verify` type-checks the source and tests, runs the hook suite, rebuilds the
package, packs the actual publication artifact, installs it in a temporary
consumer, and checks its runtime and TypeScript entry points.

Providers must resolve only their explicitly supplied values. Importing the
package must not request host state or establish live registrations. Keep
shared contracts in `@phreshos/core` and runtime integrations outside this
package. React must not depend on an environment SDK or global runtime object.

Changes should include focused verification for public React behavior and
must preserve the built-only package boundary. Consumers must never import
repository source paths.

## Pull requests

Explain the React lifecycle or capability the change serves, update public
documentation when its contract changes, and keep each pull request focused
on one coherent change.
