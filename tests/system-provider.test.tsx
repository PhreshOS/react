import { act, render, waitFor } from "@testing-library/react"
import { defaultAppearance, type Appearance, type Connection, type Desktop, type DesktopPreferences, type DesktopViewportSnapshot, type System } from "@phreshos/core"
import { describe, expect, it } from "vitest"
import SystemProvider, { useSystem, useSystemAppearance } from "../source/system-provider.js"
import DesktopProvider, { useDesktop, useDesktopConnection, useDesktopPreferences, useDesktopViewport } from "../source/desktop-provider.js"

describe("runtime providers", function () {
  it("provides the complete System and follows Appearance", async function () {
    const requested = deferred<Appearance>()
    const changes = new Subject<Appearance>()
    const system = {
      appearance: { snapshot: () => requested.promise, subscribe: changes.subscribe }
    } as unknown as System

    const rendered = render(
      <SystemProvider system={system} fallback={<span>loading</span>}>
        <SystemValue />
      </SystemProvider>
    )

    expect(rendered.getByText("loading")).toBeTruthy()
    await act(async () => requested.resolve(defaultAppearance))
    await waitFor(() => expect(rendered.getByText(`${defaultAppearance.colors.light.foreground}:true`)).toBeTruthy())

    act(() => changes.emit({
      ...defaultAppearance,
      colors: {
        ...defaultAppearance.colors,
        light: { ...defaultAppearance.colors.light, foreground: "#000000" }
      }
    }))
    expect(rendered.getByText("#000000:true")).toBeTruthy()
  })

  it("provides one Desktop and follows its viewport and preferences", async function () {
    const viewportChanges = new Subject<DesktopViewportSnapshot>()
    const preferenceChanges = new Subject<DesktopPreferences>()
    const desktop = {
      viewport: {
        snapshot: async () => ({ size: { width: 800, height: 600 } }),
        subscribe: viewportChanges.subscribe
      },
      preferences: {
        snapshot: async () => ({ theme: "dark", animations: true, scale: 1 }),
        subscribe: preferenceChanges.subscribe
      }
    } as unknown as Desktop

    const rendered = render(
      <DesktopProvider desktop={desktop}>
        <DesktopValue />
      </DesktopProvider>
    )

    await waitFor(() => expect(rendered.getByText("800×600:dark:1:true")).toBeTruthy())
    act(() => viewportChanges.emit({ size: { width: 1024, height: 768 } }))
    act(() => preferenceChanges.emit({ theme: "light", animations: false, scale: 1.25 }))
    expect(rendered.getByText("1024×768:light:1.25:true")).toBeTruthy()

    rendered.unmount()
    expect(viewportChanges.listenerCount).toBe(0)
    expect(preferenceChanges.listenerCount).toBe(0)
  })

  it("resolves the Desktop Connection only when its hook is used", async function () {
    const connection = { identity: "connection-one" } as Connection
    let reads = 0
    const desktop = {
      connection: async () => {
        reads += 1
        return connection
      },
      viewport: {
        snapshot: async () => ({ size: { width: 800, height: 600 } }),
        subscribe: () => () => undefined
      },
      preferences: {
        snapshot: async () => ({ theme: "dark", animations: true, scale: 1 }),
        subscribe: () => () => undefined
      }
    } as unknown as Desktop
    const rendered = render(
      <DesktopProvider desktop={desktop}>
        <DesktopConnection />
      </DesktopProvider>
    )

    await waitFor(() => expect(rendered.getByText("connection-one")).toBeTruthy())
    expect(reads).toBe(1)
  })
})

function SystemValue() {
  const system = useSystem()
  const appearance = useSystemAppearance()
  return <span>{appearance.colors.light.foreground}:{String(Boolean(system))}</span>
}

function DesktopValue() {
  const desktop = useDesktop()
  const { size } = useDesktopViewport()
  const preferences = useDesktopPreferences()
  return <span>{size.width}×{size.height}:{preferences.theme}:{preferences.scale}:{String(Boolean(desktop))}</span>
}

function DesktopConnection() {
  return <span>{useDesktopConnection()?.identity ?? "loading"}</span>
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
