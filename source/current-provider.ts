import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react"
import {
  current,
  type Process,
  type Program
} from "@phreshos/client"

const provisionNames = ["program", "process", "parent"] as const
const CurrentContext = createContext<CurrentContextValue | null>(null)

/** Resolves only the current handles explicitly selected by the program. */
export default function CurrentProvider({
  children,
  fallback = null,
  provide,
  waitServer = false
}: CurrentProviderProperties) {
  const normalized = normalizeProvision(provide)
  const selectionKey = normalized.join("\0")
  const selection = useMemo(() => normalized, [selectionKey])

  return createElement(SelectedCurrentProvider, {
    children,
    fallback,
    key: `${selectionKey}\0${String(waitServer)}`,
    selection,
    waitServer
  })
}

function SelectedCurrentProvider({ children, fallback, selection, waitServer }: SelectedCurrentProviderProperties) {
  const [resolution, setResolution] = useState<Resolution>({ status: "pending" })

  useEffect(() => {
    let active = true

    setResolution({ status: "pending" })

    void resolveCurrent(selection, waitServer).then(value => {
      if (active) setResolution({ status: "ready", value })
    }, error => {
      if (active) setResolution({ status: "error", error })
    })

    return () => { active = false }
  }, [selection, waitServer])

  if (resolution.status === "pending") return fallback
  if (resolution.status === "error") throw resolution.error

  return createElement(CurrentContext.Provider, { value: resolution.value }, children)
}

async function resolveCurrent(selection: readonly CurrentProvisionName[], waitServer: boolean | number): Promise<CurrentContextValue> {
  const serverReady = typeof waitServer === "number"
    ? current.server.waitReady(waitServer)
    : waitServer ? current.server.waitReady() : undefined

  const [entries] = await Promise.all([
    Promise.all(selection.map(resolveProvision)),
    serverReady
  ])

  return {
    provided: new Set(selection),
    values: Object.fromEntries(entries) as Partial<CurrentValues>
  }
}

async function resolveProvision(name: CurrentProvisionName): Promise<readonly [CurrentProvisionName, CurrentValues[CurrentProvisionName]]> {
  switch (name) {
    case "program": return [name, await current.program()]
    case "process": return [name, await current.process()]
    case "parent": return [name, await current.parent()]
  }
}

/** Returns the current Program selected by the nearest provider. */
export function useProgram(): Program {
  return useProvided("program")
}

/** Returns the current Process selected by the nearest provider. */
export function useProcess(): Process {
  return useProvided("process")
}

/** Returns the current Process's selected visible parent. */
export function useParent(): Process | null {
  return useProvided("parent")
}

function useProvided<Name extends CurrentProvisionName>(name: Name): CurrentValues[Name] {
  const context = useContext(CurrentContext)

  if (!context) throw new Error(`use${hookName(name)} must be used inside CurrentProvider`)
  if (!context.provided.has(name)) throw new Error(`use${hookName(name)} requires "${name}" in CurrentProvider's provide prop`)

  return context.values[name] as CurrentValues[Name]
}

function normalizeProvision(provide: CurrentProvision): readonly CurrentProvisionName[] {
  if (!Array.isArray(provide) || provide.length === 0) throw new Error("CurrentProvider's provide prop must select at least one current value")

  const selected = new Set<CurrentProvisionName>()

  for (const name of provide) {
    if (!provisionNames.includes(name)) throw new Error(`CurrentProvider cannot provide "${String(name)}"`)
    if (selected.has(name)) throw new Error(`CurrentProvider's provide prop selects "${name}" more than once`)
    selected.add(name)
  }

  return [...selected]
}

function hookName(name: CurrentProvisionName) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** Values that CurrentProvider can resolve. */
export type CurrentProvisionName = typeof provisionNames[number]

/** Required non-empty selection of current values. */
export type CurrentProvision = readonly [CurrentProvisionName, ...CurrentProvisionName[]]

/** Properties accepted by CurrentProvider. */
export interface CurrentProviderProperties {
  /** Content rendered after every selected current handle has resolved. */
  readonly children: ReactNode

  /** Content rendered while selected handles or optional Server readiness resolve. */
  readonly fallback?: ReactNode

  /** Exact current values made available to descendant hooks. */
  readonly provide: CurrentProvision

  /**
   * Waits for the Process's Server before rendering children.
   * `true` uses the default ten-second deadline; a number sets milliseconds.
   */
  readonly waitServer?: boolean | number
}

type CurrentValues = Readonly<{
  program: Program
  process: Process
  parent: Process | null
}>

type CurrentContextValue = Readonly<{
  provided: ReadonlySet<CurrentProvisionName>
  values: Partial<CurrentValues>
}>

type SelectedCurrentProviderProperties = Omit<CurrentProviderProperties, "provide" | "waitServer"> & Readonly<{
  selection: readonly CurrentProvisionName[]
  waitServer: boolean | number
}>

type Resolution =
  | Readonly<{ status: "pending" }>
  | Readonly<{ status: "ready", value: CurrentContextValue }>
  | Readonly<{ status: "error", error: unknown }>
