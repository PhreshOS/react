import { Component, type ErrorInfo, type ReactNode } from "react"
import { act, render, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Cleanup, Process, Program, ServiceHandler, Window } from "@phreshos/client"
import useProcessState from "../source/use-process-state.js"
import useProgramState from "../source/use-program-state.js"
import useServiceState from "../source/use-service-state.js"
import useWindowState from "../source/use-window-state.js"

describe("explicit domain state hooks", function () {
  it("subscribes before the Program read and preserves intervening lifecycle events", async function () {
    const events = new Subject()
    const processEvents = new Subject()
    const processes = deferred<Process[]>()
    const created = {} as Process
    const order: string[] = []
    const program = {
      installed: async () => true,
      process: {
        list: () => {
          order.push("read")
          return processes.promise
        },
        subscribe: (event: string, listener: Listener) => {
          order.push(`subscribe:process:${event}`)
          return processEvents.subscribe(event, listener)
        }
      },
      subscribe: (event: string, listener: Listener) => {
        order.push(`subscribe:${event}`)
        return events.subscribe(event, listener)
      }
    } as unknown as Program

    const hook = renderHook(() => useProgramState(program))

    expect(hook.result.current).toBeUndefined()
    expect(order.slice(0, 3)).toEqual([
      "subscribe:process:create",
      "subscribe:process:exit",
      "subscribe:uninstall"
    ])
    expect(order[3]).toBe("read")

    act(() => processEvents.emit("create", created))
    processes.resolve([])

    await waitFor(() => expect(hook.result.current).toEqual({ installed: true, processes: [created] }))

    act(() => events.emit("uninstall", { everythingRemoved: false }))
    expect(hook.result.current?.installed).toBe(false)

    hook.unmount()
    expect(events.listenerCount).toBe(0)
    expect(processEvents.listenerCount).toBe(0)
  })

  it("maintains Process endpoint presence from lifecycle events", async function () {
    const events = new Subject()
    const server = { exists: async () => true }
    const client = { exists: async () => true }
    const process = {
      server,
      client,
      exited: async () => false,
      subscribe: events.subscribe
    } as unknown as Process

    const hook = renderHook(() => useProcessState(process))

    await waitFor(() => expect(hook.result.current).toEqual({
      exited: false,
      serverExists: true,
      clientExists: true
    }))

    act(() => events.emit("endpointStop", client))
    expect(hook.result.current?.clientExists).toBe(false)

    act(() => events.emit("endpointStart", client))
    expect(hook.result.current?.clientExists).toBe(true)

    act(() => events.emit("exit", { status: "exited", code: 0, signal: null }))
    expect(hook.result.current).toEqual({ exited: true, serverExists: false, clientExists: false })
  })

  it("combines Window reads and follows future Window events", async function () {
    const events = new Subject()
    const window = windowFixture(events)
    const hook = renderHook(() => useWindowState(window))

    await waitFor(() => expect(hook.result.current).toEqual({
      title: "Initial",
      position: { x: 10, y: 20 },
      size: { width: 640, height: 480 },
      minimized: false,
      front: true,
      layer: "window",
      location: "./"
    }))

    act(() => events.emit("move", { x: 30, y: 40 }))
    act(() => events.emit("changeTitle", "Changed"))

    expect(hook.result.current?.position).toEqual({ x: 30, y: 40 })
    expect(hook.result.current?.title).toBe("Changed")
  })

  it("subscribes before the service snapshot and preserves intervening lifecycle events", async function () {
    const events = new Subject()
    const snapshot = deferred<boolean>()
    const order: string[] = []
    const service = {
      enabled: () => {
        order.push("read")
        return snapshot.promise
      },
      subscribe: (event: string, listener: Listener) => {
        order.push(`subscribe:${event}`)
        return events.subscribe(event, listener)
      }
    } as unknown as ServiceHandler

    const hook = renderHook(() => useServiceState(service))

    expect(hook.result.current).toBeUndefined()
    expect(order).toEqual(["subscribe:enable", "subscribe:disable", "read"])

    act(() => events.emit("enable", undefined))
    snapshot.resolve(true)

    await waitFor(() => expect(hook.result.current).toEqual({ enabled: true }))

    act(() => events.emit("disable", undefined))
    expect(hook.result.current).toEqual({ enabled: false })

    hook.unmount()
    expect(events.listenerCount).toBe(0)
  })

  it("throws the original initial-read rejection during render", async function () {
    const failure = new Error("This process has no live client endpoint")
    const events = new Subject()
    const window = {
      ...windowFixture(events),
      title: async () => { throw failure }
    } as Window
    let caught: unknown
    const reported = vi.spyOn(console, "error").mockImplementation(() => undefined)

    render(
      <ErrorBoundary onError={error => { caught = error }}>
        <RejectedWindow window={window} />
      </ErrorBoundary>
    )

    await waitFor(() => expect(caught).toBe(failure))
    reported.mockRestore()
  })
})

function RejectedWindow({ window }: { window: Window }) {
  useWindowState(window)
  return null
}

class ErrorBoundary extends Component<ErrorBoundaryProperties, { failed: boolean }> {
  public override state = { failed: false }

  public static getDerivedStateFromError() {
    return { failed: true }
  }

  public override componentDidCatch(error: unknown, _info: ErrorInfo) {
    this.props.onError(error)
  }

  public override render() {
    return this.state.failed ? null : this.props.children
  }
}

type ErrorBoundaryProperties = Readonly<{
  children: ReactNode
  onError: (error: unknown) => void
}>

function windowFixture(events: Subject): Window {
  return {
    title: async () => "Initial",
    position: async () => ({ x: 10, y: 20 }),
    size: async () => ({ width: 640, height: 480 }),
    minimized: async () => false,
    front: async () => true,
    layer: async () => "window",
    location: async () => "./",
    surface: {
      set: async () => undefined,
      remove: async () => undefined
    },
    subscribe: events.subscribe
  } as unknown as Window
}

type Listener = (message: unknown) => unknown

class Subject {
  private readonly listeners = new Map<string, Set<Listener>>()

  public readonly subscribe = (event: string, listener: Listener): Cleanup => {
    const listeners = this.listeners.get(event) ?? new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(event, listeners)

    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.listeners.delete(event)
    }
  }

  public emit(event: string, message: unknown) {
    for (const listener of this.listeners.get(event) ?? []) listener(message)
  }

  public get listenerCount() {
    let count = 0
    for (const listeners of this.listeners.values()) count += listeners.size
    return count
  }
}

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>(settle => { resolve = settle })
  return { promise, resolve }
}
