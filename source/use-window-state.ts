import { useMemo, useSyncExternalStore } from "react"
import type { Window, WindowState } from "@phreshos/core"
import LiveState, { combineCleanups } from "./live-state.js"

/** Explicitly reads and follows one live Client Window while mounted. */
export default function useWindowState(window: Window): WindowState | undefined {
  const state = useMemo(() => new LiveState<WindowState>(
    async () => {
      const [title, header, surface, transaction, position, size, minimized, maximized, front, layer] = await Promise.all([
        window.title(),
        window.header(),
        window.surface(),
        window.transaction(),
        window.position(),
        window.size(),
        window.minimized(),
        window.maximized(),
        window.front(),
        window.layer()
      ])

      return { title, header, surface, transaction, position, size, minimized, maximized, front, layer }
    },
    reduce => combineCleanups(
      window.subscribe("move", position => reduce(current => ({ ...current, position }))),
      window.subscribe("resize", size => reduce(current => ({ ...current, size }))),
      window.subscribe("minimize", minimized => reduce(current => ({ ...current, minimized }))),
      window.subscribe("maximize", maximized => reduce(current => ({ ...current, maximized }))),
      window.subscribe("changeTitle", title => reduce(current => ({ ...current, title }))),
      window.subscribe("changeHeader", header => reduce(current => ({ ...current, header }))),
      window.subscribe("changeSurface", surface => reduce(current => ({ ...current, surface }))),
      window.subscribe("changeTransaction", transaction => reduce(current => ({ ...current, transaction }))),
      window.subscribe("front", front => reduce(current => ({ ...current, front })))
    )
  ), [window])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}
