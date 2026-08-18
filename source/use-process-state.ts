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
      process.subscribe("endpointStart", endpoint => reduce(current => endpointPresence(current, process, endpoint, true))),
      process.subscribe("endpointStop", endpoint => reduce(current => endpointPresence(current, process, endpoint, false))),
      process.subscribe("exit", () => reduce(current => ({ ...current, exited: true, serverExists: false, clientExists: false })))
    )
  ), [process])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}

function endpointPresence(state: ProcessState, process: Process, endpoint: unknown, exists: boolean): ProcessState {
  if (endpoint === process.server) {
    return state.serverExists === exists ? state : { ...state, serverExists: exists }
  }

  if (endpoint === process.client) {
    return state.clientExists === exists ? state : { ...state, clientExists: exists }
  }

  return state
}
