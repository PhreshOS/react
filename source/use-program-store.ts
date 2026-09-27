import { useCallback, useMemo, useSyncExternalStore } from "react"
import type { ProgramStore } from "@phreshos/core"
import { useProvidedProgram } from "./context-provider.js"
import LiveState from "./live-state.js"

type Widen<Value> = Value extends string ? string : Value extends number ? number : Value extends boolean ? boolean : Value
type StoreResult<Value> = readonly [Value | undefined, (next: Value | ((current: Value | undefined) => Value)) => Promise<void>]

/** Follows one Program-owned persistent value and seeds it only when absent. */
export default function useProgramStore<Value>(key: string, initial: Value): StoreResult<Widen<Value>>
export default function useProgramStore<Value>(store: ProgramStore, key: string, initial: Value): StoreResult<Widen<Value>>
export default function useProgramStore<Value>(storeOrKey: ProgramStore | string, keyOrInitial: string | Value, explicitInitial?: Value): StoreResult<Widen<Value>> {
  type Stored = Widen<Value>
  const program = useProvidedProgram()
  const store = typeof storeOrKey === "string" ? program?.store : storeOrKey
  if (!store) throw new Error("useProgramStore(key, initial) requires ContextProvider")
  const key = typeof storeOrKey === "string" ? storeOrKey : keyOrInitial as string
  const initial = typeof storeOrKey === "string" ? keyOrInitial as Value : explicitInitial as Value
  // A stored undefined value still occupies a key; only the System can test absence atomically.
  const state = useMemo(() => new LiveState<{ value: Stored | undefined }>(
    async () => ({ value: await store.getOrSet<Stored>(key, initial as Stored) }),
    reduce => store.subscribe<Stored>(key, value => reduce(() => ({ value })))
  ), [store, key])
  const snapshot = useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
  const set = useCallback(async (next: Stored | ((current: Stored | undefined) => Stored)) => {
    if (typeof next === "function") await store.update<Stored>(key, next as (current: Stored | undefined) => Stored)
    else await store.set(key, next)
  }, [store, key])
  return [snapshot?.value, set] as const
}
