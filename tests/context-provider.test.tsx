import { act, render, waitFor } from "@testing-library/react"
import type { ClientContext, ClientMemory, Process } from "@phreshos/core"
import { describe, expect, it } from "vitest"
import ContextProvider, { useProcess } from "../source/context-provider.js"
import useClientMemory from "../source/use-client-memory.js"

describe("ContextProvider", function () {
  it("provides one Client Context and resolves its current Process", async function () {
    const requested = deferred<Process>()
    const process = { identity: "process-one" } as Process
    const rendered = render(
      <ContextProvider context={{
        process: () => requested.promise,
        program: async () => ({}),
        parent: async () => null
      } as ClientContext} fallback={<span>loading</span>}>
        <CurrentProcess />
      </ContextProvider>
    )

    expect(rendered.getByText("loading")).toBeTruthy()

    await act(async () => requested.resolve(process))
    await waitFor(() => expect(rendered.getByText("process-one")).toBeTruthy())
  })

  it("seeds and follows Client memory through one hook subscription", async function () {
    let value: string | undefined
    let subscriptions = 0
    const listeners = new Set<(value: string | undefined) => unknown>()
    const memory = {
      async get() { return value },
      async set(_key: string, next: string) { value = next; for (const listener of listeners) listener(value) },
      async update(_key: string, change: (current: string | undefined) => string) {
        value = change(value)
        for (const listener of listeners) listener(value)
        return value
      },
      async delete() { value = undefined; for (const listener of listeners) listener(value); return true },
      async entries() { return value === undefined ? [] : [["tab", value]] },
      subscribe(_key: string, listener: (value: string | undefined) => unknown) {
        subscriptions++
        listeners.add(listener)
        listener(value)
        return () => { listeners.delete(listener) }
      }
    } as ClientMemory
    let setTab!: (next: string | ((current: string | undefined) => string)) => Promise<void>
    function Tab() {
      const [tab, set] = useClientMemory<string>("tab", "colors")
      setTab = set
      return <span>{tab ?? "pending"}</span>
    }
    const rendered = render(<ContextProvider context={{
      process: async () => ({}), program: async () => ({}), parent: async () => null, memory
    } as ClientContext}><Tab /></ContextProvider>)
    await waitFor(() => expect(rendered.getByText("colors")).toBeTruthy())
    expect(subscriptions).toBe(1)
    await act(async () => setTab(current => current === "colors" ? "layout" : "colors"))
    expect(rendered.container.textContent).toBe("layout")
    expect(subscriptions).toBe(1)
  })

  it("targets an explicit memory handle without a ContextProvider", async function () {
    let stored: string | undefined
    const listeners = new Set<(value: string | undefined) => unknown>()
    const memory = {
      async update(_key: string, change: (current: string | undefined) => string) {
        stored = change(stored)
        for (const listener of listeners) listener(stored)
        return stored
      },
      async set(_key: string, value: string) {
        stored = value
        for (const listener of listeners) listener(stored)
      },
      subscribe(_key: string, listener: (value: string | undefined) => unknown) {
        listeners.add(listener)
        listener(stored)
        return () => { listeners.delete(listener) }
      }
    } as ClientMemory
    let setTab!: (next: string) => Promise<void>
    function ExactTab() {
      const [tab, set] = useClientMemory(memory, "tab", "colors")
      setTab = set
      return <span>{tab ?? "pending"}</span>
    }

    const rendered = render(<ExactTab />)
    await waitFor(() => expect(rendered.getByText("colors")).toBeTruthy())
    await act(async () => setTab("layout"))
    expect(rendered.container.textContent).toBe("layout")
    expect(stored).toBe("layout")
  })
})

function CurrentProcess() {
  return <span>{useProcess().identity}</span>
}

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>(complete => { resolve = complete })
  return { promise, resolve }
}
