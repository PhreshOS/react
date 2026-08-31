import { useMemo, useSyncExternalStore } from "react"
import type { Process } from "@phreshos/client"
import LiveState, { combineCleanups } from "./live-state.js"

/** Mutable lifecycle state of one Process and its Endpoint incarnations. */
export type ProcessState = Readonly<{
  exited: boolean
  serverExists: boolean
  clientExists: boolean
}>

/** Explicitly reads and follows one Process while this hook is mounted. */
export default function useProcessState(process: Process): ProcessState | undefined {
  const state = useMemo(() => new LiveState<ProcessState>(
    async () => {
      const [exited, serverExists, clientExists] = await Promise.all([
        process.exited(),
        process.server.exists(),
        process.client.exists()
      ])

      return { exited, serverExists, clientExists }
    },
    reduce => combineCleanups(
      process.server.lifecycle.subscribe("start", () => reduce(current => current.serverExists ? current : { ...current, serverExists: true })),
      process.server.lifecycle.subscribe("stop", () => reduce(current => current.serverExists ? { ...current, serverExists: false } : current)),
      process.client.lifecycle.subscribe("start", () => reduce(current => current.clientExists ? current : { ...current, clientExists: true })),
      process.client.lifecycle.subscribe("stop", () => reduce(current => current.clientExists ? { ...current, clientExists: false } : current)),
      process.subscribe("exit", () => reduce(current => ({ ...current, exited: true, serverExists: false, clientExists: false })))
    )
  ), [process])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}
