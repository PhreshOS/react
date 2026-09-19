import { useMemo, useSyncExternalStore } from "react"
import type { Endpoint } from "@phreshos/core"
import LiveState, { combineCleanups } from "./live-state.js"

export type EndpointState = Readonly<{
  running: boolean
}>

/** Explicitly reads and follows one Endpoint address while mounted. */
export default function useEndpointState(endpoint: Endpoint): EndpointState | undefined {
  const state = useMemo(() => new LiveState<EndpointState>(
    async () => ({ running: await endpoint.running() }),
    reduce => combineCleanups(
      endpoint.lifecycle.subscribe("start", () => reduce(current => setRunning(current, true))),
      endpoint.lifecycle.subscribe("stop", () => reduce(current => setRunning(current, false)))
    )
  ), [endpoint])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}

function setRunning(state: EndpointState, running: boolean): EndpointState {
  return state.running === running ? state : { running }
}
