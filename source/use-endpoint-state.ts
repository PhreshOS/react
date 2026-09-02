import { useMemo, useSyncExternalStore } from "react"
import type { Endpoint } from "@phreshos/core"
import LiveState, { combineCleanups } from "./live-state.js"

export type EndpointState = Readonly<{
  exists: boolean
}>

/** Explicitly reads and follows one Endpoint address while mounted. */
export default function useEndpointState(endpoint: Endpoint): EndpointState | undefined {
  const state = useMemo(() => new LiveState<EndpointState>(
    async () => ({ exists: await endpoint.exists() }),
    reduce => combineCleanups(
      endpoint.lifecycle.subscribe("start", () => reduce(current => setExists(current, true))),
      endpoint.lifecycle.subscribe("stop", () => reduce(current => setExists(current, false)))
    )
  ), [endpoint])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}

function setExists(state: EndpointState, exists: boolean): EndpointState {
  return state.exists === exists ? state : { exists }
}
