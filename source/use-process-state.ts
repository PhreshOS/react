import { useMemo, useSyncExternalStore } from "react"
import type { Process } from "@phreshos/core"
import LiveState from "./live-state.js"

/** Mutable lifecycle state of one Process. */
export type ProcessState = Readonly<{
  exited: boolean
}>

/** Explicitly reads and follows one Process while this hook is mounted. */
export default function useProcessState(process: Process): ProcessState | undefined {
  const state = useMemo(() => new LiveState<ProcessState>(
    async () => ({ exited: await process.exited() }),
    reduce => process.subscribe("exit", () => reduce(current => current.exited ? current : { exited: true }))
  ), [process])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}
