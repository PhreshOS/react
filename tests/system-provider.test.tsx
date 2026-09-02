import { act, render, waitFor } from "@testing-library/react"
import { standardAppearance, type Appearance, type Desktop, type DesktopPreferences, type DesktopSurfaceSnapshot, type System } from "@phreshos/core"
import { describe, expect, it } from "vitest"
import SystemProvider, { useSystem, useSystemAppearance } from "../source/system-provider.js"
import DesktopProvider, { useDesktop, useDesktopPreferences, useDesktopSurface } from "../source/desktop-provider.js"

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
    await act(async () => requested.resolve(standardAppearance))
    await waitFor(() => expect(rendered.getByText(`${standardAppearance.foreground.light}:true`)).toBeTruthy())

    act(() => changes.emit({ ...standardAppearance, foreground: { ...standardAppearance.foreground, light: "#000000" } }))
    expect(rendered.getByText("#000000:true")).toBeTruthy()
  })

  it("provides one Desktop and follows its surface and preferences", async function () {
    const surfaceChanges = new Subject<DesktopSurfaceSnapshot>()
    const preferenceChanges = new Subject<DesktopPreferences>()
    const desktop = {
      surface: {
        snapshot: async () => ({ size: { width: 800, height: 600 } }),
        subscribe: surfaceChanges.subscribe
      },
      preferences: {
        snapshot: async () => ({ theme: "dark", animations: true }),
        subscribe: preferenceChanges.subscribe
      }
    } as unknown as Desktop

    const rendered = render(
      <DesktopProvider desktop={desktop}>
        <DesktopValue />
      </DesktopProvider>
    )

    await waitFor(() => expect(rendered.getByText("800×600:dark:true")).toBeTruthy())
    act(() => surfaceChanges.emit({ size: { width: 1024, height: 768 } }))
    act(() => preferenceChanges.emit({ theme: "light", animations: false }))
    expect(rendered.getByText("1024×768:light:true")).toBeTruthy()

    rendered.unmount()
    expect(surfaceChanges.listenerCount).toBe(0)
    expect(preferenceChanges.listenerCount).toBe(0)
  })
})

function SystemValue() {
  const system = useSystem()
  const appearance = useSystemAppearance()
  return <span>{appearance.foreground.light}:{String(Boolean(system))}</span>
}

function DesktopValue() {
  const desktop = useDesktop()
  const { size } = useDesktopSurface()
  const preferences = useDesktopPreferences()
  return <span>{size.width}×{size.height}:{preferences.theme}:{String(Boolean(desktop))}</span>
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
