import { useMemo, useSyncExternalStore } from "react"
import type { Connection, Session } from "@phreshos/core"
import LiveState, { combineCleanups } from "./live-state.js"

/** Mutable lifecycle state of one authentication Session. */
export type SessionState = Readonly<{
  valid: boolean
  connections: readonly Connection[]
}>

/** Explicitly reads and follows one Session while this hook is mounted. */
export default function useSessionState(session: Session): SessionState | undefined {
  const state = useMemo(() => new LiveState<SessionState>(
    async () => {
      const [valid, connections] = await Promise.all([
        session.valid(),
        session.connections()
      ])

      return { valid, connections }
    },
    reduce => combineCleanups(
      session.subscribe("connectionAttach", connection => reduce(current => attach(current, connection))),
      session.subscribe("connectionDetach", connection => reduce(current => detach(current, connection))),
      session.subscribe("end", () => reduce(current => end(current)))
    )
  ), [session])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}

function attach(state: SessionState, connection: Connection): SessionState {
  if (state.connections.includes(connection)) return state
  return { ...state, connections: [...state.connections, connection] }
}

function detach(state: SessionState, connection: Connection): SessionState {
  const connections = state.connections.filter(candidate => candidate !== connection)
  return connections.length === state.connections.length ? state : { ...state, connections }
}

function end(state: SessionState): SessionState {
  return !state.valid && state.connections.length === 0 ? state : { valid: false, connections: [] }
}
