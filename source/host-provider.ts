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
  host,
  type PointerPosition,
  type Size,
  type ThemeProperties
} from "@phreshos/client"
import LiveSnapshot from "./live-snapshot.js"

const provisionNames = ["theme", "desktopSize", "pointerPosition"] as const
const HostContext = createContext<HostContextValue | null>(null)

/** Requests and follows only the host values explicitly selected by the program. */
export default function HostProvider(properties: HostProviderProperties) {
  const normalized = normalizeProvision(properties.provide)
  const selectionKey = normalized.join("\0")
  const selection = useMemo(() => normalized, [selectionKey])

  return createElement(SelectedHostProvider, { ...properties, key: selectionKey, selection })
}

function SelectedHostProvider({ children, fallback, selection }: SelectedHostProviderProperties) {
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

  return createElement(HostContext.Provider, { value: { provided: new Set(selection), stores } }, children)
}

/** Returns the selected Theme snapshot and follows future change events. */
export function useHostTheme(): Readonly<ThemeProperties> {
  return useProvided("theme")
}

/** Returns the selected desktop size and follows future resize events. */
export function useDesktopSize(): Size {
  return useProvided("desktopSize")
}

/** Returns the selected Pointer position and follows future move events. */
export function usePointerPosition(): PointerPosition | null {
  return useProvided("pointerPosition")
}

function useProvided<Name extends HostProvisionName>(name: Name): HostValues[Name] {
  const context = useContext(HostContext)

  if (!context) throw new Error(`${hookNames[name]} must be used inside HostProvider`)
  if (!context.provided.has(name)) throw new Error(`${hookNames[name]} requires "${name}" in HostProvider's provide prop`)

  const store = context.stores[name] as LiveSnapshot<HostValues[Name]>
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
}

function createStores(selection: readonly HostProvisionName[]): HostStores {
  const stores: HostStores = {}

  for (const name of selection) {
    switch (name) {
      case "theme":
        stores.theme = new LiveSnapshot(
          () => host.theme.snapshot(),
          subscriber => host.theme.subscribe("change", subscriber)
        )
        break
      case "desktopSize":
        stores.desktopSize = new LiveSnapshot(
          () => host.desktop.size(),
          subscriber => host.desktop.subscribe("resize", subscriber)
        )
        break
      case "pointerPosition":
        stores.pointerPosition = new LiveSnapshot(
          () => host.pointer.position(),
          subscriber => host.pointer.subscribe("move", subscriber)
        )
        break
    }
  }

  return stores
}

function normalizeProvision(provide: HostProvision): readonly HostProvisionName[] {
  if (!Array.isArray(provide) || provide.length === 0) throw new Error("HostProvider's provide prop must select at least one host value")

  const selected = new Set<HostProvisionName>()

  for (const name of provide) {
    if (!provisionNames.includes(name)) throw new Error(`HostProvider cannot provide "${String(name)}"`)
    if (selected.has(name)) throw new Error(`HostProvider's provide prop selects "${name}" more than once`)
    selected.add(name)
  }

  return [...selected]
}

const hookNames: Readonly<Record<HostProvisionName, string>> = {
  theme: "useHostTheme",
  desktopSize: "useDesktopSize",
  pointerPosition: "usePointerPosition"
}

/** Values that HostProvider can request and follow. */
export type HostProvisionName = typeof provisionNames[number]

/** Required non-empty selection of host values. */
export type HostProvision = readonly [HostProvisionName, ...HostProvisionName[]]

/** Properties accepted by HostProvider. */
export interface HostProviderProperties {
  /** Content rendered after every selected host value has resolved. */
  readonly children: ReactNode

  /** Content rendered while selected host values resolve. */
  readonly fallback: ReactNode

  /** Exact host values requested and followed for mounted descendants. */
  readonly provide: HostProvision
}

type HostValues = Readonly<{
  theme: Readonly<ThemeProperties>
  desktopSize: Size
  pointerPosition: PointerPosition | null
}>

type HostStores = {
  [Name in HostProvisionName]?: LiveSnapshot<HostValues[Name]>
}

type HostContextValue = Readonly<{
  provided: ReadonlySet<HostProvisionName>
  stores: HostStores
}>

type SelectedHostProviderProperties = HostProviderProperties & Readonly<{
  selection: readonly HostProvisionName[]
}>

type Resolution =
  | Readonly<{ status: "pending" }>
  | Readonly<{ status: "ready" }>
  | Readonly<{ status: "error", error: unknown }>
