# `@phreshos/react`

The React SDK adapts explicitly supplied PhreshOS contracts to React. It is
runtime-neutral and does not define Program, Process, Endpoint, Client, Server,
or Window objects.

## Package status

This package is one component of a larger architecture that is still under
active testing. The architecture's components will be released in stages as
their contracts and integrations are verified.

`@phreshos/react` depends on `@phreshos/core` and React. It does not import a
Client singleton, initialize transport, access `window`, or require a DOM.
Browser Clients, Node renderers, tests, and other runtimes supply the handles
and live sources they own.

It provides two kinds of adapter:

- `ContextProvider` resolves exactly the runtime handles supplied through its
  `program`, `process`, and `parent` props, then exposes them through `useProgram()`,
  `useProcess()`, and `useParent()`.
- `SystemProvider` subscribes before reading the sources supplied through its
  `appearance`, `desktopSurface`, `desktopPointer`, and `desktopPreferences`
  props. Their hooks expose the resulting snapshots synchronously after resolution.
- `useSubscribe()` owns named or all-event registrations for one mounted React
  consumer.
- `useProgramState(program)`, `useProcessState(process)`,
  `useServiceState(service)`, and `useWindowState(window)` explicitly compose
  existing reads with future live events for one mounted consumer. They add no
  state operation to another SDK.
- `useSubscribeAsks()` adapts an Endpoint traffic surface's question
  subscription, while `useSubscribeAnswers()` adapts a Server traffic
  surface's answer subscription.

Window needs no React resolution: `context.window` is already a synchronous,
silent capability object. `ContextProvider` therefore has no `window` prop
and the React SDK exposes no pass-through `useWindow()` hook.

Context hooks return the Core handle contract by default. A runtime-specific
consumer that needs capabilities added by its environment selects its supplied
handle type explicitly, such as `useProcess<ClientProcess>()`; React still has
no dependency on that environment SDK.

The domain state hooks return only mutable state; identity and immutable
metadata remain on the supplied handle:

```ts
useProgramState(program)
// { installed, processes } | undefined

useProcessState(process)
// { exited, serverExists, clientExists } | undefined

useServiceState(service)
// { exists } | undefined

useWindowState(window)
// WindowState | undefined
```

`WindowState` contains the observable Window properties only. The command-only
`window.surface` capability is intentionally absent: Program code may replace
or remove its target but cannot read or subscribe to it.

`undefined` means only that the initial explicit reads are pending. Each hook
opens its live subscriptions before those reads, then applies any intervening
events so an older result cannot overwrite newer state. If an initial read
rejects, the hook throws that original value during render for the nearest
React error boundary. It does not invent a fallback, retry, wait for a stopped
Client, or use an old Window snapshot as the fallback for that rejection. State
exists only while the hook is mounted and every registration is cleaned up on
unmount.

The Window capability outlives a stopped Client, but live Window state does
not. A component that spans Client lifecycle should use `useProcessState()` to
mount its `useWindowState()` child only while `clientExists` is true. Calling
the Window hook while the Client is absent lets the existing Window reads
reject normally.

The ordinary-event and traffic hooks retain the latest value returned by their
projector. A named `useSubscribe()` may omit that callback; its default
projector is `message => message`, so the hook retains the latest message
unchanged. The all-event form receives a correlated capture:

```tsx
import { system } from "@phreshos/client"
import { useSubscribe } from "@phreshos/react"

const desktop = useSubscribe(system.desktop.surface, "resize")

const latest = useSubscribe(system.desktop.surface, capture => {
  if (capture.event === "resize") return capture.message
})
```

System reads are asynchronous while subscriptions are live-only. `SystemProvider`
subscribes before requesting each selected snapshot and prevents an older read
from overwriting a newer event:

```tsx
import { system } from "@phreshos/client"
import { SystemProvider, useDesktopPreferences, useDesktopSurface, useSystemAppearance } from "@phreshos/react"

function Content() {
  const { theme } = useDesktopPreferences()
  const appearance = useSystemAppearance()
  const surface = useDesktopSurface()

  return <p style={{ color: appearance.foreground[theme] }}>{surface.size.width} × {surface.size.height}</p>
}

function App() {
  return <SystemProvider
    appearance={system.appearance}
    desktopPreferences={system.desktop.preferences}
    desktopSurface={system.desktop.surface}
    fallback={<p>Loading…</p>}
  >
    <Content />
  </SystemProvider>
}
```

At least one source is required. Nothing is read or subscribed merely because
the package was imported, and an omitted System value remains unavailable.
`desktopPointer` is permission-guarded: supplying it does not request permission,
and resolution fails unless the Program already holds `pointer`.
The provider renders its optional fallback, or `null`, until every supplied
value resolves. `useDesktopPreferences()` is a pure state adapter. The System
communicates its effective scheme through the Client iframe, while each Client
HTML document declares which schemes it supports.

```tsx
import { context } from "@phreshos/client"
import {
  ContextProvider,
  useProgram,
  useSubscribe
} from "@phreshos/react"

function Counter() {
  const program = useProgram()

  const count = useSubscribe(context, "count", message => {
    return Number(message.payload)
  })

  return <p>{program.name}: {count ?? 0}</p>
}

export default function App() {
  return (
    <ContextProvider program={() => context.program()} fallback={<p>Loading…</p>}>
      <Counter />
    </ContextProvider>
  )
}
```

Using a context or system hook outside its provider, or without supplying its
value, throws a configuration error. Neither provider supplies implicit
capabilities, so adding a future capability cannot make it enter an existing
application.

Each hook calls the registration's returned cleanup when the component no
longer consumes it. Projectors may return a value or Promise; only the latest
invocation may update the hook state. Projector failures are never converted
into communication, logged, or suppressed by the SDK; they remain local to the
React application.

React is a peer dependency, so this package never installs or bundles a second
copy into an application.
