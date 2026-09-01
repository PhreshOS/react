import { useMemo, useSyncExternalStore } from "react"
import type { Window, WindowState } from "@phreshos/core"
import LiveState, { combineCleanups } from "./live-state.js"

/** Explicitly reads and follows one live Client Window while mounted. */
export default function useWindowState(window: Window): WindowState | undefined {
  const state = useMemo(() => new LiveState<WindowState>(
    async () => {
      const [title, position, size, minimized, front, layer, location] = await Promise.all([
        window.title(),
        window.position(),
        window.size(),
        window.minimized(),
        window.front(),
        window.layer(),
        window.location()
      ])

      return { title, position, size, minimized, front, layer, location }
    },
    reduce => combineCleanups(
      window.subscribe("move", position => reduce(current => ({ ...current, position }))),
      window.subscribe("resize", size => reduce(current => ({ ...current, size }))),
      window.subscribe("minimize", minimized => reduce(current => ({ ...current, minimized }))),
      window.subscribe("changeTitle", title => reduce(current => ({ ...current, title }))),
      window.subscribe("front", front => reduce(current => ({ ...current, front })))
    )
  ), [window])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}
