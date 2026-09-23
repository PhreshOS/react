import { useMemo, useSyncExternalStore } from "react"
import type { WindowPresentation, WindowPresentationState } from "@phreshos/core"
import LiveState, { combineCleanups } from "./live-state.js"

type MutablePresentationProperty = Exclude<keyof Extract<WindowPresentationState, { layer: "window" }>, "layer">

/** Reads and follows the values one Desktop relies on to represent a Window. */
export default function useWindowPresentationState(presentation: WindowPresentation): WindowPresentationState | undefined {
  const state = useMemo(() => new LiveState<WindowPresentationState>(
    () => readPresentation(presentation),
    reduce => combineCleanups(
      presentation.subscribe("move", position => reduce(current => change(current, "position", position))),
      presentation.subscribe("resize", size => reduce(current => change(current, "size", size))),
      presentation.subscribe("minimize", minimized => reduce(current => change(current, "minimized", minimized))),
      presentation.subscribe("maximize", maximized => reduce(current => change(current, "maximized", maximized))),
      presentation.subscribe("changeTitle", title => reduce(current => change(current, "title", title))),
      presentation.subscribe("changeHeader", header => reduce(current => change(current, "header", header))),
      presentation.subscribe("changeSurface", surface => reduce(current => change(current, "surface", surface))),
      presentation.subscribe("front", front => reduce(current => change(current, "front", front)))
    )
  ), [presentation])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}

async function readPresentation(presentation: WindowPresentation): Promise<WindowPresentationState> {
  const layer = await presentation.layer()

  if (layer === "wallpaper") return { layer }

  const [surface, position, size, minimized, maximized, front] = await Promise.all([
    presentation.surface(),
    presentation.position(),
    presentation.size(),
    presentation.minimized(),
    presentation.maximized(),
    presentation.front()
  ])

  if (layer === "under" || layer === "over" || layer === "shell") {
    return { layer, surface, position, size, minimized, maximized, front }
  }

  const [title, header] = await Promise.all([presentation.title(), presentation.header()])
  return { layer, title, header, surface, position, size, minimized, maximized, front }
}

function change(
  state: WindowPresentationState,
  property: MutablePresentationProperty,
  value: unknown
): WindowPresentationState {
  if (!(property in state)) return state
  return { ...state, [property]: value } as WindowPresentationState
}
