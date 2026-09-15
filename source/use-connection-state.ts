import { useMemo, useSyncExternalStore } from "react"
import type { Connection, Session } from "@phreshos/core"
import LiveState, { combineCleanups } from "./live-state.js"

/** Mutable authorization state of one browser Connection. */
export type ConnectionState = Readonly<{
  connected: boolean
  session: Session | null
}>

/** Explicitly reads and follows one Connection while this hook is mounted. */
export default function useConnectionState(connection: Connection): ConnectionState | undefined {
  const state = useMemo(() => new LiveState<ConnectionState>(
    async () => {
      const [connected, session] = await Promise.all([
        connection.connected(),
        connection.session()
      ])

      return { connected, session }
    },
    reduce => combineCleanups(
      connection.subscribe("sessionChange", session => reduce(current => setSession(current, session))),
      connection.subscribe("disconnect", () => reduce(current => disconnect(current)))
    )
  ), [connection])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}

function setSession(state: ConnectionState, session: Session | null): ConnectionState {
  return state.session === session ? state : { ...state, session }
}

function disconnect(state: ConnectionState): ConnectionState {
  return !state.connected && state.session === null ? state : { connected: false, session: null }
}
