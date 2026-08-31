import { useMemo, useSyncExternalStore } from "react"
import type { Service } from "@phreshos/client"
import LiveState, { combineCleanups } from "./live-state.js"

/** Live existence of one configured Endpoint service. */
export type ServiceState = Readonly<{
  exists: boolean
}>

/** Explicitly reads and follows one service while this hook is mounted. */
export default function useServiceState(service: Service): ServiceState | undefined {
  const state = useMemo(() => new LiveState<ServiceState>(
    async () => ({ exists: await service.exists() }),
    reduce => combineCleanups(
      service.lifecycle.subscribe("start", () => reduce(current => setExists(current, true))),
      service.lifecycle.subscribe("stop", () => reduce(current => setExists(current, false)))
    )
  ), [service])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}

function setExists(state: ServiceState, exists: boolean): ServiceState {
  return state.exists === exists ? state : { exists }
}
