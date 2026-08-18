import type { Cleanup } from "@phreshos/client"

const noError = Symbol("no-error")

export type StateReducer<State> = (state: State) => State
export type StateFollower<State> = (reduce: (reducer: StateReducer<State>) => void) => Cleanup

/** One mounted React snapshot composed from an explicit read and future events. */
export default class LiveState<State> {
  private readonly listeners = new Set<() => void>()
  private value: State | undefined
  private error: unknown | typeof noError = noError
  private stopSource: Cleanup | null = null
  private pending: StateReducer<State>[] = []
  private generation = 0
  private active = false

  public constructor(
    private readonly read: () => Promise<State>,
    private readonly follow: StateFollower<State>
  ) {}

  public readonly snapshot = (): State | undefined => {
    if (this.error !== noError) throw this.error
    return this.value
  }

  public readonly subscribe = (listener: () => void): Cleanup => {
    this.listeners.add(listener)
    if (!this.active) this.start()

    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.stop()
    }
  }

  private start() {
    this.active = true
    this.value = undefined
    this.error = noError
    this.pending = []

    const generation = ++this.generation

    try {
      this.stopSource = this.follow(reducer => {
        if (this.generation !== generation) return

        if (this.value === undefined) this.pending.push(reducer)
        else this.update(reducer(this.value))
      })
    } catch (error) {
      this.fail(generation, error)
      return
    }

    void this.read().then(value => {
      if (this.generation !== generation) return

      for (const reducer of this.pending) value = reducer(value)
      this.pending = []
      this.update(value)
    }, error => this.fail(generation, error))
  }

  private stop() {
    this.active = false
    this.generation++
    this.stopSource?.()
    this.stopSource = null
    this.pending = []
    this.value = undefined
    this.error = noError
  }

  private fail(generation: number, error: unknown) {
    if (this.generation !== generation) return

    this.stopSource?.()
    this.stopSource = null
    this.pending = []
    this.error = error
    this.notify()
  }

  private update(value: State) {
    if (Object.is(this.value, value)) return
    this.value = value
    this.notify()
  }

  private notify() {
    for (const listener of this.listeners) listener()
  }
}

export function combineCleanups(...cleanups: Cleanup[]): Cleanup {
  return () => {
    for (const cleanup of cleanups) cleanup()
  }
}
