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
import {
  system,
  type Appearance,
  type DesktopSize,
  type PointerPosition,
  type Theme
} from "@phreshos/client"
import LiveSnapshot from "./live-snapshot.js"

const provisionNames = ["appearance", "theme", "desktopSize", "pointerPosition"] as const
const SystemContext = createContext<SystemContextValue | null>(null)

/** Requests and follows only the system values explicitly selected by the program. */
export default function SystemProvider(properties: SystemProviderProperties) {
  const normalized = normalizeProvision(properties.provide)
  const selectionKey = normalized.join("\0")
  const selection = useMemo(() => normalized, [selectionKey])

  return createElement(SelectedSystemProvider, { ...properties, key: selectionKey, selection })
}

function SelectedSystemProvider({ children, fallback, selection }: SelectedSystemProviderProperties) {
  const stores = useMemo(() => createStores(selection), [selection])
  const [resolution, setResolution] = useState<Resolution>({ status: "pending" })

  useEffect(() => {
    let active = true
    const selected = selection.map(name => stores[name] as LiveSnapshot<unknown>)

    void Promise.all(selected.map(store => store.start())).then(() => {
      if (active) setResolution({ status: "ready" })
    }, error => {
      for (const store of selected) store.stop()
      if (active) setResolution({ status: "error", error })
    })

    return () => {
      active = false
      for (const store of selected) store.stop()
    }
  }, [selection, stores])

  if (resolution.status === "pending") return fallback
  if (resolution.status === "error") throw resolution.error

  return createElement(SystemContext.Provider, { value: { provided: new Set(selection), stores } }, children)
}

/** Returns the complete unresolved Appearance and follows authoritative updates. */
export function useSystemAppearance(): Appearance {
  return useProvided("appearance")
}

/** Returns the effective local Desktop Theme and follows future changes. */
export function useSystemTheme(): Theme {
  return useProvided("theme")
}

/** Returns the selected desktop size and follows future resize events. */
export function useDesktopSize(): DesktopSize {
  return useProvided("desktopSize")
}

/** Returns the selected Pointer position and follows future move events. */
export function usePointerPosition(): PointerPosition | null {
  return useProvided("pointerPosition")
}

function useProvided<Name extends SystemProvisionName>(name: Name): SystemValues[Name] {
  const context = useContext(SystemContext)

  if (!context) throw new Error(`${hookNames[name]} must be used inside SystemProvider`)
  if (!context.provided.has(name)) throw new Error(`${hookNames[name]} requires "${name}" in SystemProvider's provide prop`)

  const store = context.stores[name] as LiveSnapshot<SystemValues[Name]>
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
}

function createStores(selection: readonly SystemProvisionName[]): SystemStores {
  const stores: SystemStores = {}

  for (const name of selection) {
    switch (name) {
      case "appearance":
        stores.appearance = new LiveSnapshot(
          () => system.appearance.snapshot(),
          subscriber => system.appearance.subscribe("change", subscriber)
        )
        break
      case "theme":
        stores.theme = new LiveSnapshot(
          () => system.theme.snapshot(),
          subscriber => system.theme.subscribe("change", subscriber)
        )
        break
      case "desktopSize":
        stores.desktopSize = new LiveSnapshot(
          () => system.desktop.size(),
          subscriber => system.desktop.subscribe("resize", subscriber)
        )
        break
      case "pointerPosition":
        stores.pointerPosition = new LiveSnapshot(
          () => system.pointer.position(),
          subscriber => system.pointer.subscribe("move", subscriber)
        )
        break
    }
  }

  return stores
}

function normalizeProvision(provide: SystemProvision): readonly SystemProvisionName[] {
  if (!Array.isArray(provide) || provide.length === 0) throw new Error("SystemProvider's provide prop must select at least one system value")

  const selected = new Set<SystemProvisionName>()

  for (const name of provide) {
    if (!provisionNames.includes(name)) throw new Error(`SystemProvider cannot provide "${String(name)}"`)
    if (selected.has(name)) throw new Error(`SystemProvider's provide prop selects "${name}" more than once`)
    selected.add(name)
  }

  return [...selected]
}

const hookNames: Readonly<Record<SystemProvisionName, string>> = {
  appearance: "useSystemAppearance",
  theme: "useSystemTheme",
  desktopSize: "useDesktopSize",
  pointerPosition: "usePointerPosition"
}

/** Values that SystemProvider can request and follow. */
export type SystemProvisionName = typeof provisionNames[number]

/** Required non-empty selection of system values. */
export type SystemProvision = readonly [SystemProvisionName, ...SystemProvisionName[]]

/** Properties accepted by SystemProvider. */
export interface SystemProviderProperties {
  /** Content rendered after every selected system value has resolved. */
  readonly children: ReactNode

  /** Content rendered while selected system values resolve. */
  readonly fallback: ReactNode

  /** Exact system values requested and followed for mounted descendants. */
  readonly provide: SystemProvision
}

type SystemValues = Readonly<{
  appearance: Appearance
  theme: Theme
  desktopSize: DesktopSize
  pointerPosition: PointerPosition | null
}>

type SystemStores = {
  [Name in SystemProvisionName]?: LiveSnapshot<SystemValues[Name]>
}

type SystemContextValue = Readonly<{
  provided: ReadonlySet<SystemProvisionName>
  stores: SystemStores
}>

type SelectedSystemProviderProperties = SystemProviderProperties & Readonly<{
  selection: readonly SystemProvisionName[]
}>

type Resolution =
  | Readonly<{ status: "pending" }>
  | Readonly<{ status: "ready" }>
  | Readonly<{ status: "error", error: unknown }>
