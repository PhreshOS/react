import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode
} from "react"
import type {
  Appearance,
  AppearanceSource,
  DesktopPointerSnapshot,
  DesktopPointerSource,
  DesktopPreferences,
  DesktopPreferencesSource,
  DesktopSurfaceSnapshot,
  DesktopSurfaceSource
} from "@phreshos/core"
import LiveSnapshot from "./live-snapshot.js"

const SystemContext = createContext<SystemStores | null>(null)

/** Resolves and follows only the System capabilities supplied by the runtime. */
export default function SystemProvider({
  appearance,
  children,
  desktopPointer,
  desktopPreferences,
  desktopSurface,
  fallback = null
}: SystemProviderProperties) {
  const stores = useMemo(() => createStores({
    appearance,
    desktopPointer,
    desktopPreferences,
    desktopSurface
  }), [appearance, desktopPointer, desktopPreferences, desktopSurface])
  const [resolution, setResolution] = useState<Resolution>({ status: "pending", stores })

  if (Object.keys(stores).length === 0) throw new Error("SystemProvider requires at least one System capability")

  useEffect(() => {
    let active = true
    const selected = Object.values(stores)

    void Promise.all(selected.map(store => store.start())).then(() => {
      if (active) setResolution({ status: "ready", stores })
    }, error => {
      for (const store of selected) store.stop()
      if (active) setResolution({ status: "error", stores, error })
    })

    return () => {
      active = false
      for (const store of selected) store.stop()
    }
  }, [stores])

  if (resolution.stores !== stores || resolution.status === "pending") return fallback
  if (resolution.status === "error") throw resolution.error

  return createElement(SystemContext.Provider, { value: stores }, children)
}

/** Returns the complete unresolved Appearance and follows authoritative updates. */
export function useSystemAppearance(): Appearance {
  return useProvided("appearance")
}

/** Returns the Desktop surface snapshot and follows future resizes. */
export function useDesktopSurface(): DesktopSurfaceSnapshot {
  return useProvided("desktopSurface")
}

/** Returns the Desktop pointer snapshot and follows future movement. */
export function useDesktopPointer(): DesktopPointerSnapshot {
  return useProvided("desktopPointer")
}

/** Returns all effective Desktop preferences and follows authoritative updates. */
export function useDesktopPreferences(): DesktopPreferences {
  return useProvided("desktopPreferences")
}

function useProvided<Name extends SystemName>(name: Name): SystemValues[Name] {
  const context = useContext(SystemContext)

  if (!context) throw new Error(`${hookNames[name]} must be used inside SystemProvider`)

  const store = context[name] as LiveSnapshot<SystemValues[Name]> | undefined

  if (!store) throw new Error(`${hookNames[name]} requires SystemProvider's ${name} prop`)

  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
}

function createStores(sources: SystemSources): SystemStores {
  const stores: SystemStores = {}
  const appearance = sources.appearance
  const surface = sources.desktopSurface
  const pointer = sources.desktopPointer
  const preferences = sources.desktopPreferences

  if (appearance) stores.appearance = new LiveSnapshot(
    () => appearance.snapshot(),
    subscriber => appearance.subscribe("change", subscriber)
  )

  if (surface) stores.desktopSurface = new LiveSnapshot(
    () => surface.snapshot(),
    subscriber => surface.subscribe("resize", subscriber)
  )

  if (pointer) stores.desktopPointer = new LiveSnapshot(
    () => pointer.snapshot(),
    subscriber => pointer.subscribe("move", subscriber)
  )

  if (preferences) stores.desktopPreferences = new LiveSnapshot(
    () => preferences.snapshot(),
    subscriber => preferences.subscribe("change", subscriber)
  )

  return stores
}

const hookNames: Readonly<Record<SystemName, string>> = {
  appearance: "useSystemAppearance",
  desktopPointer: "useDesktopPointer",
  desktopPreferences: "useDesktopPreferences",
  desktopSurface: "useDesktopSurface"
}

/** Properties accepted by SystemProvider. */
export type SystemProviderProperties = Readonly<{
  readonly children: ReactNode
  readonly fallback?: ReactNode
}> & AtLeastOne<SystemSources>

type SystemSources = Readonly<{
  readonly appearance?: AppearanceSource
  readonly desktopPointer?: DesktopPointerSource
  readonly desktopPreferences?: DesktopPreferencesSource
  readonly desktopSurface?: DesktopSurfaceSource
}>

type SystemValues = Readonly<{
  appearance: Appearance
  desktopPointer: DesktopPointerSnapshot
  desktopPreferences: DesktopPreferences
  desktopSurface: DesktopSurfaceSnapshot
}>

type SystemName = keyof SystemValues

type SystemStores = {
  [Name in SystemName]?: LiveSnapshot<SystemValues[Name]>
}

type Resolution =
  | Readonly<{ status: "pending", stores: SystemStores }>
  | Readonly<{ status: "ready", stores: SystemStores }>
  | Readonly<{ status: "error", stores: SystemStores, error: unknown }>

type AtLeastOne<Values> = {
  [Name in keyof Values]-?: Required<Pick<Values, Name>> & Partial<Omit<Values, Name>>
}[keyof Values]
