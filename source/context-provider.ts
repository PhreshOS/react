import { createContext, createElement, useContext as useReactContext, useMemo, useSyncExternalStore, type ReactNode } from "react"
import type { ClientContext, Process, Program } from "@phreshos/core"
import LiveSnapshot from "./live-snapshot.js"
import useProviderResolution from "./provider-resolution.js"

type ContextValue = Readonly<{
  context: ClientContext
  process: LiveSnapshot<Process>
  program: LiveSnapshot<Program>
  parent: LiveSnapshot<Process | null>
}>

const CurrentContext = createContext<ContextValue | null>(null)

/** Provides one complete Client execution Context to a React tree. */
export default function ContextProvider({ children, context, fallback = null }: ContextProviderProperties) {
  const value = useMemo<ContextValue>(() => ({
    context,
    process: fixed(() => context.process()),
    program: fixed(() => context.program()),
    parent: fixed(() => context.parent())
  }), [context])

  const stores = useMemo(() => [value.process, value.program, value.parent] as const, [value])
  const ready = useProviderResolution(stores)

  return ready ? createElement(CurrentContext.Provider, { value }, children) : fallback
}

/** Returns the complete Client Context supplied by the nearest provider. */
export function useContext(): ClientContext {
  return useValue().context
}

/** Returns the current Program once it resolves. */
export function useProgram<Handle extends Program = Program>(): Handle {
  return useResolved(useValue().program) as Handle
}

/** Returns the current Process once it resolves. */
export function useProcess<Handle extends Process = Process>(): Handle {
  return useResolved(useValue().process) as Handle
}

/** Returns the current Process parent once it resolves. */
export function useParent<Handle extends Process = Process>(): Handle | null {
  return useResolved(useValue().parent) as Handle | null
}

function useResolved<Value>(store: LiveSnapshot<Value>) {
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
}

function useValue() {
  const value = useReactContext(CurrentContext)
  if (!value) throw new Error("useContext must be used inside ContextProvider")
  return value
}

function fixed<Value>(read: () => Promise<Value>) {
  return new LiveSnapshot(read, () => () => undefined)
}

export type ContextProviderProperties = Readonly<{
  children: ReactNode
  context: ClientContext
  fallback?: ReactNode
}>
