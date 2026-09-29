import { useMemo, useSyncExternalStore } from "react"
import type { Presentation, PresentationState } from "@phreshos/core"
import LiveState, { combineCleanups } from "./live-state.js"

/** Explicitly reads and follows how the executing Client is drawn on its Desktop while mounted. */
export default function usePresentationState(presentation: Presentation): PresentationState | undefined {
  const state = useMemo(() => new LiveState<PresentationState>(
    async () => {
      const [layer, position, size, front, interactive, surface] = await Promise.all([
        presentation.layer(),
        presentation.position(),
        presentation.size(),
        presentation.front(),
        presentation.interactive(),
        presentation.surface()
      ])

      return { layer, position, size, front, interactive, surface }
    },
    reduce => combineCleanups(
      presentation.subscribe("move", position => reduce(current => ({ ...current, position }))),
      presentation.subscribe("resize", size => reduce(current => ({ ...current, size }))),
      presentation.subscribe("front", front => reduce(current => ({ ...current, front }))),
      presentation.subscribe("changeInteractive", interactive => reduce(current => ({ ...current, interactive }))),
      presentation.subscribe("changeSurface", surface => reduce(current => ({ ...current, surface })))
    )
  ), [presentation])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}
