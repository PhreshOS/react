import { useMemo, useSyncExternalStore } from "react"
import type { Service } from "@phreshos/client"
import LiveState, { combineCleanups } from "./live-state.js"

/** Live availability of one exact service identity. */
export type ServiceState = Readonly<{
  enabled: boolean
}>

/** Explicitly reads and follows one service while this hook is mounted. */
export default function useServiceState(service: Service): ServiceState | undefined {
  const state = useMemo(() => new LiveState<ServiceState>(
    async () => ({ enabled: await service.enabled() }),
    reduce => combineCleanups(
      service.lifecycle.subscribe("enable", () => reduce(current => setEnabled(current, true))),
      service.lifecycle.subscribe("disable", () => reduce(current => setEnabled(current, false)))
    )
  ), [service])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}

function setEnabled(state: ServiceState, enabled: boolean): ServiceState {
  return state.enabled === enabled ? state : { enabled }
}
