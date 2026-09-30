import { useMemo, useSyncExternalStore } from "react"
import type { DesktopPlaneSource, DesktopSize } from "@phreshos/core"
import LiveState from "./live-state.js"

/** The plane of standard Windows one Desktop shows a view of. */
export type PlaneState = Readonly<{
  size: DesktopSize
}>

/** Explicitly reads and follows the Desktop's plane while mounted: its size, which changes with the Desktop's. */
export default function usePlaneState(plane: DesktopPlaneSource): PlaneState | undefined {
  const state = useMemo(() => new LiveState<PlaneState>(
    async () => ({ size: await plane.size() }),
    reduce => plane.subscribe("resize", size => reduce(current => ({ ...current, size })))
  ), [plane])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}
