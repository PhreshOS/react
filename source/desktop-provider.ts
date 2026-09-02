import { createContext, createElement, useContext as useReactContext, useMemo, useSyncExternalStore, type ReactNode } from "react"
import type { Desktop, DesktopPreferences, DesktopSurfaceSnapshot } from "@phreshos/core"
import LiveSnapshot from "./live-snapshot.js"
import useProviderResolution from "./provider-resolution.js"

type DesktopValue = Readonly<{
  desktop: Desktop
  surface: LiveSnapshot<DesktopSurfaceSnapshot>
  preferences: LiveSnapshot<DesktopPreferences>
}>

const DesktopContext = createContext<DesktopValue | null>(null)

/** Provides one complete Client Desktop environment to a React tree. */
export default function DesktopProvider({ children, desktop, fallback = null }: DesktopProviderProperties) {
  const value = useMemo<DesktopValue>(() => ({
    desktop,
    surface: new LiveSnapshot(
      () => desktop.surface.snapshot(),
      subscriber => desktop.surface.subscribe("resize", subscriber)
    ),
    preferences: new LiveSnapshot(
      () => desktop.preferences.snapshot(),
      subscriber => desktop.preferences.subscribe("change", subscriber)
    )
  }), [desktop])

  const stores = useMemo(() => [value.surface, value.preferences] as const, [value])
  const ready = useProviderResolution(stores)

  return ready ? createElement(DesktopContext.Provider, { value }, children) : fallback
}

/** Returns the complete Desktop supplied by the nearest provider. */
export function useDesktop(): Desktop {
  return useValue().desktop
}

/** Resolves and follows the current Desktop surface. */
export function useDesktopSurface(): DesktopSurfaceSnapshot {
  const store = useValue().surface
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
