import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react"
import type { Process, Program } from "@phreshos/core"

const RuntimeContext = createContext<Partial<ContextValues> | null>(null)

/** Resolves only the runtime handles supplied by the surrounding runtime. */
export default function ContextProvider({
  children,
  fallback = null,
  parent,
  process,
  program
}: ContextProviderProperties) {
  const sources = useMemo<ContextSources>(() => ({ parent, process, program }), [parent, process, program])
  const [resolution, setResolution] = useState<Resolution>({ status: "pending", sources })

  if (parent === undefined && process === undefined && program === undefined) {
    throw new Error("ContextProvider requires at least one runtime handle")
  }

  useEffect(() => {
    let active = true

    void resolveSources(sources).then(value => {
      if (active) setResolution({ status: "ready", sources, value })
    }, error => {
      if (active) setResolution({ status: "error", sources, error })
    })

    return () => { active = false }
  }, [sources])

  if (resolution.sources !== sources || resolution.status === "pending") return fallback
  if (resolution.status === "error") throw resolution.error

  return createElement(RuntimeContext.Provider, { value: resolution.value }, children)
}

async function resolveSources(sources: ContextSources): Promise<Partial<ContextValues>> {
  const entries = await Promise.all(contextNames.flatMap(name => {
    const source = sources[name]
    return source === undefined ? [] : [resolveSource(name, source as ContextSource<ContextValues[typeof name]>)]
  }))

  return Object.fromEntries(entries) as Partial<ContextValues>
}

async function resolveSource<Name extends ContextName>(
  name: Name,
  source: ContextSource<ContextValues[Name]>
): Promise<readonly [Name, ContextValues[Name]]> {
  const value = typeof source === "function" ? source() : source
  return [name, await value]
}

/** Returns the current Program supplied by the nearest provider. */
export function useProgram<Handle extends Program = Program>(): Handle {
  return useProvided("program") as Handle
}

/** Returns the current Process supplied by the nearest provider. */
export function useProcess<Handle extends Process = Process>(): Handle {
  return useProvided("process") as Handle
}

/** Returns the current Process's supplied visible parent. */
export function useParent<Handle extends Process = Process>(): Handle | null {
  return useProvided("parent") as Handle | null
}

function useProvided<Name extends ContextName>(name: Name): ContextValues[Name] {
  const context = useContext(RuntimeContext)

  if (!context) throw new Error(`${hookNames[name]} must be used inside ContextProvider`)
  if (!(name in context)) throw new Error(`${hookNames[name]} requires ContextProvider's ${name} prop`)

  return context[name] as ContextValues[Name]
}

const contextNames = ["program", "process", "parent"] as const

const hookNames: Readonly<Record<ContextName, string>> = {
  parent: "useParent",
  process: "useProcess",
  program: "useProgram"
}

/** A stable handle or resolver supplied by one runtime integration. */
export type ContextSource<Value> = Value | (() => Value | PromiseLike<Value>)

/** Properties accepted by ContextProvider. */
export type ContextProviderProperties = Readonly<{
  readonly children: ReactNode
  readonly fallback?: ReactNode
}> & AtLeastOne<ContextSources>

type ContextSources = Readonly<{
  readonly parent?: ContextSource<Process | null>
  readonly process?: ContextSource<Process>
  readonly program?: ContextSource<Program>
}>

type ContextName = typeof contextNames[number]

type ContextValues = Readonly<{
  program: Program
  process: Process
  parent: Process | null
}>

type Resolution =
  | Readonly<{ status: "pending", sources: ContextSources }>
  | Readonly<{ status: "ready", sources: ContextSources, value: Partial<ContextValues> }>
  | Readonly<{ status: "error", sources: ContextSources, error: unknown }>

type AtLeastOne<Values> = {
  [Name in keyof Values]-?: Required<Pick<Values, Name>> & Partial<Omit<Values, Name>>
}[keyof Values]
