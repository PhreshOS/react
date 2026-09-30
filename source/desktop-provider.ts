import { createContext, createElement, useContext as useReactContext, useMemo, useSyncExternalStore, type ReactNode } from "react"
import type { Connection, Desktop, DesktopPreferences, DesktopViewportState } from "@phreshos/core"
import LiveSnapshot from "./live-snapshot.js"
import LiveState from "./live-state.js"
import useProviderResolution from "./provider-resolution.js"

type DesktopValue = Readonly<{
  desktop: Desktop
  viewport: LiveSnapshot<DesktopViewportState>
  preferences: LiveSnapshot<DesktopPreferences>
}>

const DesktopContext = createContext<DesktopValue | null>(null)

/** Provides one complete Client Desktop environment to a React tree. */
export default function DesktopProvider({ children, desktop, fallback = null }: DesktopProviderProperties) {
  const value = useMemo<DesktopValue>(() => ({
    desktop,
    viewport: viewportState(desktop),
    preferences: new LiveSnapshot(
      () => desktop.preferences.snapshot(),
      subscriber => desktop.preferences.subscribe("change", subscriber)
    )
  }), [desktop])

  const stores = useMemo(() => [value.viewport, value.preferences] as const, [value])
  const ready = useProviderResolution(stores)

  return ready ? createElement(DesktopContext.Provider, { value }, children) : fallback
}

/** Returns the complete Desktop supplied by the nearest provider. */
export function useDesktop(): Desktop {
  return useValue().desktop
}

/** Resolves and follows the current Desktop viewport: its size and its offset together. */
export function useDesktopViewport(): DesktopViewportState {
  const store = useValue().viewport
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
}

/** Resolves and follows the effective Desktop preferences. */
export function useDesktopPreferences(): DesktopPreferences {
  const store = useValue().preferences
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
}

/** Resolves the browser Connection carrying this Desktop when explicitly used. */
export function useDesktopConnection(): Connection | undefined {
  const desktop = useDesktop()
  const state = useMemo(() => new LiveState(
    () => desktop.connection(),
    () => () => undefined
  ), [desktop])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}

function useValue() {
  const value = useReactContext(DesktopContext)
  if (!value) throw new Error("useDesktop must be used inside DesktopProvider")
  return value
}

export type DesktopProviderProperties = Readonly<{
  children: ReactNode
  desktop: Desktop
  fallback?: ReactNode
}>

/** One state from the viewport's two values: each event replaces its own value and keeps the other. */
function viewportState(desktop: Desktop) {
  let latest: Partial<{ -readonly [Key in keyof DesktopViewportState]: DesktopViewportState[Key] }> = {}
  const complete = () => latest.size && latest.offset ? Object.freeze({ size: latest.size, offset: latest.offset }) : null

  return new LiveSnapshot<DesktopViewportState>(
    async () => {
      const [size, offset] = await Promise.all([desktop.viewport.size(), desktop.viewport.offset()])
      latest = { size, offset }
      return complete()!
    },
    subscriber => {
      const publish = () => { const state = complete(); if (state) subscriber(state) }
      const stopResize = desktop.viewport.subscribe("resize", size => { latest = { ...latest, size }; publish() })
      const stopMove = desktop.viewport.subscribe("move", move => { latest = { ...latest, offset: move.offset }; publish() })
      return () => { stopResize(); stopMove() }
    }
  )
}
