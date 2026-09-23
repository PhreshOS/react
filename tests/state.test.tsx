import { Component, type ErrorInfo, type ReactNode } from "react"
import { act, render, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Cleanup, Connection, Endpoint, Process, Program, Service, Session, Subscribable, Window, WindowPresentation } from "@phreshos/core"
import useConnectionState from "../source/use-connection-state.js"
import useEndpointState from "../source/use-endpoint-state.js"
import useProcessState from "../source/use-process-state.js"
import useProgramState from "../source/use-program-state.js"
import useSessionState from "../source/use-session-state.js"
import useServiceState from "../source/use-service-state.js"
import useWindowState from "../source/use-window-state.js"
import useWindowPresentationState from "../source/use-window-presentation-state.js"
import useSubscribe from "../source/use-subscribe.js"

describe("explicit domain state hooks", function () {
  it("projects correlated captures when subscribing across every event", function () {
    const events = new Subject()
    const target = events as unknown as Subscribable<{ count: number, label: string }, never>
    const hook = renderHook(() => useSubscribe(target, capture => {
      if (capture.event === "count") return capture.message.toFixed(0)
      return capture.message.toUpperCase()
    }))

    act(() => events.emit("count", 4))
    expect(hook.result.current).toBe("4")

    act(() => events.emit("label", "ready"))
    expect(hook.result.current).toBe("READY")
  })

  it("subscribes before the Program read and preserves intervening lifecycle events", async function () {
    const events = new Subject()
    const processes = deferred<Process[]>()
    const created = {} as Process
    const order: string[] = []
    const program = {
      installed: async () => true,
      pinned: async () => false,
      processes: () => {
        order.push("read")
        return processes.promise
      },
      subscribe: (event: string, listener: Listener) => {
        order.push(`subscribe:${event}`)
        return events.subscribe(event, listener)
      }
    } as unknown as Program

    const hook = renderHook(() => useProgramState(program))

    expect(hook.result.current).toBeUndefined()
    expect(order.slice(0, 4)).toEqual([
      "subscribe:processCreate",
      "subscribe:processExit",
      "subscribe:uninstall",
      "subscribe:pinned"
    ])
    expect(order[4]).toBe("read")

    act(() => events.emit("processCreate", created))
    processes.resolve([])

    await waitFor(() => expect(hook.result.current).toEqual({ installed: true, pinned: false, processes: [created] }))

    act(() => events.emit("pinned", true))
    expect(hook.result.current?.pinned).toBe(true)

    act(() => events.emit("uninstall", { purge: false }))
    expect(hook.result.current?.installed).toBe(false)

    hook.unmount()
    expect(events.listenerCount).toBe(0)
  })

  it("maintains Process lifecycle state from Process events", async function () {
    const events = new Subject()
    const process = {
      exited: async () => false,
      subscribe: events.subscribe
    } as unknown as Process

    const hook = renderHook(() => useProcessState(process))

    await waitFor(() => expect(hook.result.current).toEqual({ exited: false }))

    act(() => events.emit("exit", { status: "exited", code: 0, signal: null }))
    expect(hook.result.current).toEqual({ exited: true })

    hook.unmount()
    expect(events.listenerCount).toBe(0)
  })

  it("maintains Connection authorization and terminal state", async function () {
    const events = new Subject()
    const initial = {} as Session
    const replacement = {} as Session
    const connection = {
      connected: async () => true,
      session: async () => initial,
      subscribe: events.subscribe
    } as unknown as Connection
    const hook = renderHook(() => useConnectionState(connection))

    await waitFor(() => expect(hook.result.current).toEqual({ connected: true, session: initial }))

    act(() => events.emit("sessionChange", replacement))
    expect(hook.result.current).toEqual({ connected: true, session: replacement })

    act(() => events.emit("disconnect", undefined))
    expect(hook.result.current).toEqual({ connected: false, session: null })

    hook.unmount()
    expect(events.listenerCount).toBe(0)
  })

  it("maintains Session connections and terminal state", async function () {
    const events = new Subject()
    const first = {} as Connection
    const second = {} as Connection
    const session = {
      valid: async () => true,
      connections: async () => [first],
      subscribe: events.subscribe
    } as unknown as Session
    const hook = renderHook(() => useSessionState(session))

    await waitFor(() => expect(hook.result.current).toEqual({ valid: true, connections: [first] }))

    act(() => events.emit("connectionAttach", second))
    expect(hook.result.current).toEqual({ valid: true, connections: [first, second] })

    act(() => events.emit("connectionDetach", first))
    expect(hook.result.current).toEqual({ valid: true, connections: [second] })

    act(() => events.emit("end", { reason: "signedOut" }))
    expect(hook.result.current).toEqual({ valid: false, connections: [] })

    hook.unmount()
    expect(events.listenerCount).toBe(0)
  })

  it("maintains Endpoint execution state from lifecycle events", async function () {
    const lifecycle = new Subject()
    const endpoint = {
      running: async () => false,
      lifecycle: { subscribe: lifecycle.subscribe }
    } as unknown as Endpoint
    const hook = renderHook(() => useEndpointState(endpoint))

    await waitFor(() => expect(hook.result.current).toEqual({ running: false }))

    act(() => lifecycle.emit("start", undefined))
    expect(hook.result.current).toEqual({ running: true })

    act(() => lifecycle.emit("stop", undefined))
    expect(hook.result.current).toEqual({ running: false })
  })

  it("combines Window reads and follows future Window events", async function () {
    const events = new Subject()
    const window = windowFixture(events)
    const hook = renderHook(() => useWindowState(window))

    await waitFor(() => expect(hook.result.current).toEqual({
      title: "Initial",
      header: true,
      surface: true,
      transaction: false,
      position: { x: 10, y: 20 },
      size: { width: 640, height: 480 },
      minimized: false,
      maximized: false,
      front: true,
      layer: "window"
    }))

    act(() => events.emit("move", { x: 30, y: 40 }))
    act(() => events.emit("changeTitle", "Changed"))
    act(() => events.emit("changeHeader", false))

    expect(hook.result.current?.position).toEqual({ x: 30, y: 40 })
    expect(hook.result.current?.title).toBe("Changed")
    expect(hook.result.current?.header).toBe(false)

    act(() => events.emit("maximize", true))
    act(() => events.emit("minimize", true))
    expect(hook.result.current?.maximized).toBe(true)
    expect(hook.result.current?.minimized).toBe(true)
    expect(hook.result.current?.position).toEqual({ x: 30, y: 40 })
  })

  it("keeps Window presentation geometry separate from maximized state", async function () {
    const events = new Subject()
    const presentation = presentationFixture(events, "window")
    const hook = renderHook(() => useWindowPresentationState(presentation))

    await waitFor(() => expect(hook.result.current).toEqual({
      layer: "window",
      title: "Initial",
      header: true,
      surface: true,
      position: { x: 10, y: 20 },
      size: { width: 640, height: 480 },
      minimized: false,
      maximized: false,
      front: true
    }))

    act(() => events.emit("maximize", true))
    expect(hook.result.current && "maximized" in hook.result.current && hook.result.current.maximized).toBe(true)
    expect("position" in hook.result.current! && hook.result.current.position).toEqual({ x: 10, y: 20 })
  })

  it.each(["under", "shell"] as const)("reads only the presentation values supported by the %s layer", async function (layer) {
    const events = new Subject()
    const presentation = presentationFixture(events, layer)
    const hook = renderHook(() => useWindowPresentationState(presentation))

    await waitFor(() => expect(hook.result.current).toEqual({
      layer,
      surface: true,
      position: { x: 10, y: 20 },
      size: { width: 640, height: 480 },
      minimized: false,
      maximized: false,
      front: true
    }))
  })

  it("subscribes before the service snapshot and preserves intervening lifecycle events", async function () {
    const events = new Subject()
    const snapshot = deferred<boolean>()
    const order: string[] = []
    const service = {
      available: () => {
        order.push("read")
        return snapshot.promise
      },
      lifecycle: {
        subscribe: (event: string, listener: Listener) => {
          order.push(`subscribe:${event}`)
          return events.subscribe(event, listener)
        }
      }
    } as unknown as Service

    const hook = renderHook(() => useServiceState(service))

    expect(hook.result.current).toBeUndefined()
    expect(order).toEqual(["subscribe:available", "subscribe:unavailable", "read"])

    act(() => events.emit("available", undefined))
    snapshot.resolve(true)

    await waitFor(() => expect(hook.result.current).toEqual({ available: true }))

    act(() => events.emit("unavailable", undefined))
    expect(hook.result.current).toEqual({ available: false })

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
  const reads = {
    title: async () => "Initial",
    header: async () => true,
    surface: async () => true,
    transaction: async () => false,
    position: async () => ({ x: 10, y: 20 }),
    size: async () => ({ width: 640, height: 480 }),
    minimized: async () => false,
    maximized: async () => false,
    front: async () => true,
    layer: async () => "window" as const
  }

  return {
    ...reads,
    move: async () => undefined,
    resize: async () => undefined,
    setGeometry: async () => undefined,
    minimize: async () => undefined,
    maximize: async () => undefined,
    setTitle: async () => undefined,
    setHeader: async () => undefined,
    setSurface: async () => undefined,
    setTransaction: async () => undefined,
    raise: async () => undefined,
    wait: async () => { throw new Error("Unexpected wait in state hook") },
    events: async function* () { throw new Error("Unexpected iterator in state hook") },
    subscribe: events.subscribe as Window["subscribe"]
  } satisfies Window
}

function presentationFixture(events: Subject, layer: "window" | "under" | "shell"): WindowPresentation {
  return {
    title: async () => {
      if (layer !== "window") throw new Error("Unsupported title read")
      return "Initial"
    },
    header: async () => {
      if (layer !== "window") throw new Error("Unsupported header read")
      return true
    },
    surface: async () => true,
    position: async () => ({ x: 10, y: 20 }),
    size: async () => ({ width: 640, height: 480 }),
    minimized: async () => false,
    maximized: async () => false,
    front: async () => true,
    layer: async () => layer,
    subscribe: events.subscribe as WindowPresentation["subscribe"]
  } as WindowPresentation
}

type Listener = (message: unknown) => unknown

class Subject {
  private readonly listeners = new Map<string, Set<Listener>>()
  private readonly every = new Set<(capture: { event: string, message: unknown }) => unknown>()

  public readonly subscribe = (
    eventOrListener: string | ((capture: { event: string, message: unknown }) => unknown),
    listener?: Listener
  ): Cleanup => {
    if (typeof eventOrListener !== "string") {
      this.every.add(eventOrListener)
      return () => this.every.delete(eventOrListener)
    }

    const event = eventOrListener
    const subscriber = listener as Listener
    const listeners = this.listeners.get(event) ?? new Set<Listener>()
    listeners.add(subscriber)
    this.listeners.set(event, listeners)

    return () => {
      listeners.delete(subscriber)
      if (listeners.size === 0) this.listeners.delete(event)
    }
  }

  public emit(event: string, message: unknown) {
    for (const listener of this.listeners.get(event) ?? []) listener(message)
    for (const listener of this.every) listener({ event, message })
  }

  public get listenerCount() {
    let count = 0
    for (const listeners of this.listeners.values()) count += listeners.size
    return count + this.every.size
  }
}

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>(settle => { resolve = settle })
  return { promise, resolve }
}
