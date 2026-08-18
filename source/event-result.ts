import { useEffectEvent, useMemo, useSyncExternalStore } from "react"
import type { Cleanup } from "@phreshos/client"

/** A persistent SDK registration consumed by the React adapter. */
export type Connect<Message> = (receive: (message: Message) => void) => Cleanup

/** Retains only the latest projected event value for one mounted hook. */
export default function useEventResult<Message, Result>(
  connect: Connect<Message>,
  project: (message: Message) => Result
): Awaited<Result> | undefined {
  const latestProject = useEffectEvent(project)
  const state = useMemo(() => new EventResult(connect), [connect])

  state.project = latestProject

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot) as Awaited<Result> | undefined
}

/** Bridges one persistent SDK registration into a React external store. */
export class EventResult<Message> {
  public project: (message: Message) => unknown = () => undefined

  private readonly connect: Connect<Message>
  private readonly listeners = new Set<() => void>()
  private value: unknown
  private stop: Cleanup | null = null
  private invocation = 0

  public constructor(connect: Connect<Message>) {
    this.connect = connect
  }

  public readonly snapshot = () => this.value

  public readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)

    if (!this.stop) this.stop = this.connect(this.receive)

    return () => {
      this.listeners.delete(listener)

      if (this.listeners.size > 0) return

      this.invocation++
      this.stop?.()
      this.stop = null
    }
  }

  private readonly receive = (message: Message) => {
    const invocation = ++this.invocation
    const result = this.project(message)

    if (isPromiseLike(result)) {
      void Promise.resolve(result).then(value => {
        if (invocation === this.invocation) this.update(value)
      })
    } else this.update(result)
  }

  private update(value: unknown) {
    if (Object.is(this.value, value)) return

    this.value = value

    for (const listener of this.listeners) listener()
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === "object" && value !== null || typeof value === "function")
    && "then" in value
    && typeof value.then === "function"
}
