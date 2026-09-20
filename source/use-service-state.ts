import { useMemo, useSyncExternalStore } from "react"
import type { Service } from "@phreshos/core"
import LiveState, { combineCleanups } from "./live-state.js"

/** Live availability of one stable Service address. */
export type ServiceState = Readonly<{
  available: boolean
}>

/** Explicitly reads and follows one service while this hook is mounted. */
export default function useServiceState(service: Service): ServiceState | undefined {
  const state = useMemo(() => new LiveState<ServiceState>(
    async () => ({ available: await service.available() }),
    reduce => combineCleanups(
      service.lifecycle.subscribe("available", () => reduce(current => setAvailable(current, true))),
      service.lifecycle.subscribe("unavailable", () => reduce(current => setAvailable(current, false)))
    )
  ), [service])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}

function setAvailable(state: ServiceState, available: boolean): ServiceState {
  return state.available === available ? state : { available }
}
