import { act, render, waitFor } from "@testing-library/react"
import { system, type DesktopPreferences } from "@phreshos/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import SystemProvider, { useDesktopPreferences } from "../source/system-provider.js"

describe("SystemProvider Desktop preferences", function () {
  afterEach(() => vi.restoreAllMocks())

  it("renders null until selected preferences resolve without changing the document", async function () {
    const requested = deferred<DesktopPreferences>()
    let publish: ((preferences: DesktopPreferences) => void) | undefined

    vi.spyOn(system.desktopPreferences, "snapshot").mockImplementation(() => requested.promise)
    vi.spyOn(system.desktopPreferences, "subscribe").mockImplementation(((_event: string, listener: (preferences: DesktopPreferences) => void) => {
      publish = listener
      return () => undefined
    }) as typeof system.desktopPreferences.subscribe)

    const root = document.documentElement
    root.style.colorScheme = "light dark"

    const rendered = render(
      <SystemProvider provide={["desktopPreferences"]}>
        <Preferences />
      </SystemProvider>
    )

    expect(rendered.container.childElementCount).toBe(0)

    await act(async () => requested.resolve({ theme: "dark", animations: true }))
    await waitFor(() => expect(rendered.getByText("dark:true")).toBeTruthy())
    expect(root.style.colorScheme).toBe("light dark")

    act(() => publish?.({ theme: "light", animations: false }))
    expect(rendered.getByText("light:false")).toBeTruthy()
    expect(root.style.colorScheme).toBe("light dark")

    rendered.unmount()
    expect(root.style.colorScheme).toBe("light dark")
  })
})

function Preferences() {
  const preferences = useDesktopPreferences()
  return <span>{preferences.theme}:{String(preferences.animations)}</span>
}

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>(complete => { resolve = complete })
  return { promise, resolve }
}
