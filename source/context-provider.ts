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
  context,
  type Process,
  type Program
} from "@phreshos/client"

const provisionNames = ["program", "process", "parent"] as const
const RuntimeContext = createContext<RuntimeContextValue | null>(null)

/** Resolves only the runtime handles explicitly selected by the program. */
export default function ContextProvider({
  children,
  fallback = null,
  provide,
  waitServer = false
}: ContextProviderProperties) {
  const normalized = normalizeProvision(provide)
  const selectionKey = normalized.join("\0")
  const selection = useMemo(() => normalized, [selectionKey])

  return createElement(SelectedContextProvider, {
    children,
    fallback,
    key: `${selectionKey}\0${String(waitServer)}`,
    selection,
    waitServer
  })
}

function SelectedContextProvider({ children, fallback, selection, waitServer }: SelectedContextProviderProperties) {
  const [resolution, setResolution] = useState<Resolution>({ status: "pending" })

  useEffect(() => {
    let active = true

    setResolution({ status: "pending" })

    void resolveContext(selection, waitServer).then(value => {
      if (active) setResolution({ status: "ready", value })
    }, error => {
      if (active) setResolution({ status: "error", error })
    })

    return () => { active = false }
  }, [selection, waitServer])

  if (resolution.status === "pending") return fallback
  if (resolution.status === "error") throw resolution.error

  return createElement(RuntimeContext.Provider, { value: resolution.value }, children)
}

async function resolveContext(selection: readonly ContextProvisionName[], waitServer: boolean | number): Promise<RuntimeContextValue> {
  const serverReady = typeof waitServer === "number"
    ? context.server.waitReady(waitServer)
    : waitServer ? context.server.waitReady() : undefined

  const [entries] = await Promise.all([
    Promise.all(selection.map(resolveProvision)),
    serverReady
  ])

  return {
    provided: new Set(selection),
    values: Object.fromEntries(entries) as Partial<ContextValues>
  }
}

async function resolveProvision(name: ContextProvisionName): Promise<readonly [ContextProvisionName, ContextValues[ContextProvisionName]]> {
  switch (name) {
    case "program": return [name, await context.program()]
    case "process": return [name, await context.process()]
    case "parent": return [name, await context.parent()]
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

function useProvided<Name extends ContextProvisionName>(name: Name): ContextValues[Name] {
  const providedContext = useContext(RuntimeContext)

  if (!providedContext) throw new Error(`use${hookName(name)} must be used inside ContextProvider`)
  if (!providedContext.provided.has(name)) throw new Error(`use${hookName(name)} requires "${name}" in ContextProvider's provide prop`)

  return providedContext.values[name] as ContextValues[Name]
}

function normalizeProvision(provide: ContextProvision): readonly ContextProvisionName[] {
  if (!Array.isArray(provide) || provide.length === 0) throw new Error("ContextProvider's provide prop must select at least one runtime value")

  const selected = new Set<ContextProvisionName>()

  for (const name of provide) {
    if (!provisionNames.includes(name)) throw new Error(`ContextProvider cannot provide "${String(name)}"`)
    if (selected.has(name)) throw new Error(`ContextProvider's provide prop selects "${name}" more than once`)
    selected.add(name)
  }

  return [...selected]
}

function hookName(name: ContextProvisionName) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** Values that ContextProvider can resolve. */
export type ContextProvisionName = typeof provisionNames[number]

/** Required non-empty selection of runtime values. */
export type ContextProvision = readonly [ContextProvisionName, ...ContextProvisionName[]]

/** Properties accepted by ContextProvider. */
export interface ContextProviderProperties {
  /** Content rendered after every selected runtime handle has resolved. */
  readonly children: ReactNode

  /** Content rendered while selected handles or optional Server readiness resolve. */
  readonly fallback?: ReactNode

  /** Exact runtime values made available to descendant hooks. */
  readonly provide: ContextProvision

  /**
   * Waits for the Process's Server before rendering children.
   * `true` uses the default ten-second deadline; a number sets milliseconds.
   */
  readonly waitServer?: boolean | number
}

type ContextValues = Readonly<{
  program: Program
  process: Process
  parent: Process | null
}>

type RuntimeContextValue = Readonly<{
  provided: ReadonlySet<ContextProvisionName>
  values: Partial<ContextValues>
}>

type SelectedContextProviderProperties = Omit<ContextProviderProperties, "provide" | "waitServer"> & Readonly<{
  selection: readonly ContextProvisionName[]
  waitServer: boolean | number
}>

type Resolution =
  | Readonly<{ status: "pending" }>
  | Readonly<{ status: "ready", value: RuntimeContextValue }>
  | Readonly<{ status: "error", error: unknown }>
