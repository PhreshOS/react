import { useMemo, useSyncExternalStore } from "react"
import type { ServiceHandler } from "@phreshos/client"
import LiveState, { combineCleanups } from "./live-state.js"

/** Live availability of one exact service identity. */
export type ServiceState = Readonly<{
  disabled: boolean
}>

/** Explicitly reads and follows one service while this hook is mounted. */
export default function useServiceState(service: ServiceHandler): ServiceState | undefined {
  const state = useMemo(() => new LiveState<ServiceState>(
    async () => ({ disabled: await service.disabled() }),
    reduce => combineCleanups(
      service.subscribe("enable", () => reduce(current => setDisabled(current, false))),
      service.subscribe("disable", () => reduce(current => setDisabled(current, true)))
    )
  ), [service])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}

function setDisabled(state: ServiceState, disabled: boolean): ServiceState {
  return state.disabled === disabled ? state : { disabled }
}
