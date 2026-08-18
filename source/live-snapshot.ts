import type { Cleanup } from "@phreshos/client"

const unavailable = Symbol("unavailable")

/** One explicitly requested snapshot followed by only future live changes. */
export default class LiveSnapshot<Value> {
  private readonly listeners = new Set<() => void>()
  private value: Value | typeof unavailable = unavailable
  private stopSource: Cleanup | null = null
  private generation = 0
  private revision = 0

  public constructor(
    private readonly read: () => Promise<Value>,
    private readonly subscribeSource: (subscriber: (value: Value) => void) => Cleanup
  ) {}

  public readonly snapshot = (): Value => {
    if (this.value === unavailable) throw new Error("The requested host value is not ready")
    return this.value
  }

  public readonly subscribe = (listener: () => void): Cleanup => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Starts the live subscription before requesting the current snapshot. */
  public async start(): Promise<void> {
    this.stop()
    this.value = unavailable

    const generation = this.generation
    this.stopSource = this.subscribeSource(value => {
      if (this.generation !== generation) return
      this.revision++
      this.update(value)
    })

    const requestedAt = this.revision

    try {
      const value = await this.read()
      if (this.generation === generation && this.revision === requestedAt) this.update(value)
    } catch (error) {
      if (this.generation === generation && this.revision === requestedAt) throw error
    }
  }

  public stop(): void {
    this.generation++
    this.revision = 0
    this.stopSource?.()
    this.stopSource = null
  }

  private update(value: Value) {
    if (Object.is(this.value, value)) return
    this.value = value
    for (const listener of this.listeners) listener()
  }
}
