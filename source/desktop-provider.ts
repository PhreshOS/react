import { createContext, createElement, useContext as useReactContext, useMemo, useSyncExternalStore, type ReactNode } from "react"
import type { Desktop, DesktopPreferences, DesktopViewportSnapshot } from "@phreshos/core"
import LiveSnapshot from "./live-snapshot.js"
import useProviderResolution from "./provider-resolution.js"

type DesktopValue = Readonly<{
  desktop: Desktop
  viewport: LiveSnapshot<DesktopViewportSnapshot>
  preferences: LiveSnapshot<DesktopPreferences>
}>

const DesktopContext = createContext<DesktopValue | null>(null)

/** Provides one complete Client Desktop environment to a React tree. */
export default function DesktopProvider({ children, desktop, fallback = null }: DesktopProviderProperties) {
  const value = useMemo<DesktopValue>(() => ({
    desktop,
    viewport: new LiveSnapshot(
      () => desktop.viewport.snapshot(),
      subscriber => desktop.viewport.subscribe("resize", subscriber)
    ),
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

/** Resolves and follows the current Desktop viewport. */
export function useDesktopViewport(): DesktopViewportSnapshot {
  const store = useValue().viewport
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
}

/** Resolves and follows the effective Desktop preferences. */
export function useDesktopPreferences(): DesktopPreferences {
  const store = useValue().preferences
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
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
