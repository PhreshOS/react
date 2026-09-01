import { act, render, waitFor } from "@testing-library/react"
import type {
  DesktopPreferences,
  DesktopPreferencesSource,
  DesktopSurfaceSnapshot,
  DesktopSurfaceSource
} from "@phreshos/core"
import { describe, expect, it } from "vitest"
import SystemProvider, {
  useDesktopPreferences,
  useDesktopSurface
} from "../source/system-provider.js"

describe("SystemProvider", function () {
  it("renders the fallback until an injected source resolves and follows updates", async function () {
    const requested = deferred<DesktopPreferences>()
    const changes = new Subject<DesktopPreferences>()
    const source = {
      snapshot: () => requested.promise,
      subscribe: changes.subscribe
    } as unknown as DesktopPreferencesSource

    const rendered = render(
      <SystemProvider desktopPreferences={source} fallback={<span>loading</span>}>
        <Preferences />
      </SystemProvider>
    )

    expect(rendered.getByText("loading")).toBeTruthy()

    await act(async () => requested.resolve({ theme: "dark", animations: true }))
    await waitFor(() => expect(rendered.getByText("dark:true")).toBeTruthy())

    act(() => changes.emit({ theme: "light", animations: false }))
    expect(rendered.getByText("light:false")).toBeTruthy()

    rendered.unmount()
    expect(changes.listenerCount).toBe(0)
  })

  it("keeps independently supplied Desktop capabilities separate", async function () {
    const changes = new Subject<DesktopSurfaceSnapshot>()
    const source = {
      snapshot: async () => ({ size: { width: 800, height: 600 } }),
      subscribe: changes.subscribe
    } as unknown as DesktopSurfaceSource

    const rendered = render(
      <SystemProvider desktopSurface={source}>
        <Surface />
      </SystemProvider>
    )

    await waitFor(() => expect(rendered.getByText("800×600")).toBeTruthy())

    act(() => changes.emit({ size: { width: 1024, height: 768 } }))
    expect(rendered.getByText("1024×768")).toBeTruthy()
  })
})

function Preferences() {
  const preferences = useDesktopPreferences()
  return <span>{preferences.theme}:{String(preferences.animations)}</span>
}

function Surface() {
  const { size } = useDesktopSurface()
  return <span>{size.width}×{size.height}</span>
}

class Subject<Value> {
  private readonly listeners = new Set<(value: Value) => unknown>()

  public readonly subscribe = (_event: string, listener: (value: Value) => unknown) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  public emit(value: Value) {
    for (const listener of this.listeners) listener(value)
  }

  public get listenerCount() {
    return this.listeners.size
  }
}

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>(complete => { resolve = complete })
  return { promise, resolve }
}
