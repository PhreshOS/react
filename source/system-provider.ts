import { createContext, createElement, useContext as useReactContext, useMemo, useSyncExternalStore, type ReactNode } from "react"
import type { Appearance, System } from "@phreshos/core"
import LiveSnapshot from "./live-snapshot.js"
import useProviderResolution from "./provider-resolution.js"

type SystemValue = Readonly<{
  system: System
  appearance: LiveSnapshot<Appearance>
}>

const SystemContext = createContext<SystemValue | null>(null)

/** Provides one complete global System contract to a React tree. */
export default function SystemProvider({ children, fallback = null, system }: SystemProviderProperties) {
  const value = useMemo<SystemValue>(() => ({
    system,
    appearance: new LiveSnapshot(
      () => system.appearance.snapshot(),
      subscriber => system.appearance.subscribe("change", subscriber)
    )
  }), [system])

  const stores = useMemo(() => [value.appearance] as const, [value])
  const ready = useProviderResolution(stores)

  return ready ? createElement(SystemContext.Provider, { value }, children) : fallback
}

/** Returns the complete global System supplied by the nearest provider. */
export function useSystem(): System {
  return useValue().system
}

/** Resolves and follows the global System Appearance. */
export function useSystemAppearance(): Appearance {
  const store = useValue().appearance
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
}

function useValue() {
  const value = useReactContext(SystemContext)
  if (!value) throw new Error("useSystem must be used inside SystemProvider")
  return value
}

export type SystemProviderProperties = Readonly<{
  children: ReactNode
  fallback?: ReactNode
  system: System
}>
