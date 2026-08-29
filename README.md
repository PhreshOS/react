# `@phreshos/react`

The React SDK adapts `@phreshos/client` to React. It is not another domain
authority and does not define Program, Process, Endpoint, Client, Server, or
Window objects.

## Package status

This package is one component of a larger architecture that is still under
active testing. The architecture's components will be released in stages as
their contracts and integrations are verified.

`@phreshos/react` is not intended to be used on its own. It adapts the Client
SDK to React and therefore requires both `@phreshos/client` and React as peer
dependencies.

It provides two kinds of adapter:

- `CurrentProvider` resolves exactly the current values named by its required
  `provide` prop, then exposes them synchronously through `useProgram()`,
  `useProcess()`, and `useParent()`.
- `SystemProvider` subscribes before reading exactly the system values named by its
  required `provide` prop. `useSystemAppearance()`, `useDesktopPreferences()`,
  `useDesktopSize()`, and `usePointerPosition()` expose those values synchronously
  after resolution.
- `useSubscribe()` and `useObserve()` own persistent ordinary-event
  registrations for one mounted React consumer.
- `useProgramState(program)`, `useProcessState(process)`,
  `useServiceState(service)`, and `useWindowState(window)` explicitly compose
  existing reads with future live events for one mounted consumer. They add no
  state operation to another SDK.
- `useObserveAsks()` adapts an Endpoint traffic surface's question observation,
  while `useObserveAnswers()` adapts a Server traffic surface's answer
  observation.
- `useDocumentColorScheme(theme)` explicitly synchronizes the browser document
  with an effective Theme and restores the previous value on unmount.

Window needs no React resolution: `current.window` is already a synchronous,
silent capability object. `CurrentProvider` therefore has no `window` selection
and the React SDK exposes no pass-through `useWindow()` hook.

The domain state hooks return only mutable state; identity and immutable
metadata remain on the supplied handle:

```ts
useProgramState(program)
// { installed, processes } | undefined

useProcessState(process)
// { exited, serverExists, clientExists } | undefined

useServiceState(service)
// { enabled } | undefined

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

The ordinary-event and traffic hooks retain the latest value returned by their projector.
`useSubscribe()` may omit that callback; its default projector is
`message => message`, so the hook retains the latest message unchanged.

```tsx
import { system } from "@phreshos/client"
import { useSubscribe } from "@phreshos/react"

const desktop = useSubscribe(system.desktop, "resize")
```

System reads are asynchronous while subscriptions are live-only. `SystemProvider`
subscribes before requesting each selected snapshot and prevents an older read
from overwriting a newer event:

```tsx
import { SystemProvider, useDesktopPreferences, useDesktopSize, useSystemAppearance } from "@phreshos/react"

function Content() {
  const { theme } = useDesktopPreferences()
  const appearance = useSystemAppearance()
  const desktop = useDesktopSize()

  return <p style={{ color: appearance.foreground[theme] }}>{desktop.width} × {desktop.height}</p>
}

function App() {
  return <SystemProvider provide={["appearance", "desktopPreferences", "desktopSize"]} fallback={<p>Loading…</p>}>
    <Content />
  </SystemProvider>
}
```

The selection is required and non-empty. Nothing is read or subscribed merely
because either SDK was imported, and an unselected system value never enters the
Client. `pointerPosition` is permission-guarded: selecting it does not request
permission, and resolution fails unless the Program already holds `pointer`.
The provider renders its optional fallback, or `null`, until every selected
value resolves. `useDesktopPreferences()` is a pure state adapter; document
presentation remains explicit through `useDocumentColorScheme(theme)`, which
should be called once at the application root.

```tsx
import { current } from "@phreshos/client"
import {
  CurrentProvider,
  useProgram,
  useSubscribe
} from "@phreshos/react"

function Counter() {
  const program = useProgram()

  const count = useSubscribe(current, "count", message => {
    return Number(message.payload)
  })

  return <p>{program.name}: {count ?? 0}</p>
}

export default function App() {
  return (
    <CurrentProvider provide={["program"]} fallback={<p>Loading…</p>} waitServer>
      <Counter />
    </CurrentProvider>
  )
}
```

Using a current or system hook outside its provider, or without selecting its
value, throws a configuration error. Neither provider supplies an implicit
"everything" selection, so adding a future capability cannot make it enter an
existing application.

Each hook calls the registration's returned cleanup when the component no
longer consumes it. Projectors may return a value or Promise; only the latest
invocation may update the hook state. Projector failures are never converted
into communication, logged, or suppressed by the SDK; they remain local to the
React application.

React is a peer dependency, so this package never installs or bundles a second
copy into an application.
