import { useCallback, useMemo, useSyncExternalStore } from "react"
import type { ClientMemory, JsonValue } from "@phreshos/core"
import { useProvidedContext } from "./context-provider.js"
import LiveState from "./live-state.js"

type Widen<Value extends JsonValue> = Value extends string ? string : Value extends number ? number : Value extends boolean ? boolean : Value
type MemoryResult<Value extends JsonValue> = readonly [Value | undefined, (next: Value | ((current: Value | undefined) => Value)) => Promise<void>]

/** Reads the current Client's memory, or an explicitly supplied Client memory handle. */
export default function useClientMemory<Value extends JsonValue>(key: string, initial: Value): MemoryResult<Widen<Value>>
export default function useClientMemory<Value extends JsonValue>(memory: ClientMemory, key: string, initial: Value): MemoryResult<Widen<Value>>
export default function useClientMemory<Value extends JsonValue>(memoryOrKey: ClientMemory | string, keyOrInitial: string | Value, explicitInitial?: Value): MemoryResult<Widen<Value>> {
  type Stored = Widen<Value>
  const context = useProvidedContext()
  const memory = typeof memoryOrKey === "string" ? context?.memory : memoryOrKey
  if (!memory) throw new Error("useClientMemory(key, initial) requires ContextProvider")
  const key = typeof memoryOrKey === "string" ? memoryOrKey : keyOrInitial as string
  const initial = typeof memoryOrKey === "string" ? keyOrInitial as Value : explicitInitial as Value
  // Initial seeds the key, but does not restart its subscription when it changes.
  const state = useMemo(() => new LiveState<{ value: Stored | undefined }>(
    async () => ({ value: await memory.update<Stored>(key, current => current === undefined ? initial as Stored : current) }),
    reduce => memory.subscribe<Stored>(key, value => reduce(() => ({ value })))
  ), [memory, key])
  const snapshot = useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
  const set = useCallback(async (next: Stored | ((current: Stored | undefined) => Stored)) => {
    if (typeof next === "function") await memory.update<Stored>(key, next as (current: Stored | undefined) => Stored)
    else await memory.set(key, next)
  }, [memory, key])
  return [snapshot?.value, set] as const
}
