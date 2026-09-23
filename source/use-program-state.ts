import { useMemo, useSyncExternalStore } from "react"
import type { Process, Program } from "@phreshos/core"
import LiveState, { combineCleanups } from "./live-state.js"

/** Mutable runtime state derived from one Program's reads and live events. */
export type ProgramState = Readonly<{
  installed: boolean
  pinned: boolean
  processes: readonly Process[]
}>

/** Explicitly reads and follows one Program while this hook is mounted. */
export default function useProgramState(program: Program): ProgramState | undefined {
  const state = useMemo(() => new LiveState<ProgramState>(
    async () => {
      const [installed, pinned, processes] = await Promise.all([
        program.installed(),
        program.pinned(),
        program.processes()
      ])

      return { installed, pinned, processes }
    },
    reduce => combineCleanups(
      program.subscribe("processCreate", process => reduce(current => addProcess(current, process))),
      program.subscribe("processExit", ({ process }) => reduce(current => removeProcess(current, process))),
      program.subscribe("uninstall", () => reduce(current => current.installed ? { ...current, installed: false } : current)),
      program.subscribe("pinned", pinned => reduce(current => current.pinned === pinned ? current : { ...current, pinned }))
    )
  ), [program])

  return useSyncExternalStore(state.subscribe, state.snapshot, state.snapshot)
}

function addProcess(state: ProgramState, process: Process): ProgramState {
  if (state.processes.includes(process)) return state
  return { ...state, processes: [...state.processes, process] }
}

function removeProcess(state: ProgramState, process: Process): ProgramState {
  const processes = state.processes.filter(candidate => candidate !== process)
  return processes.length === state.processes.length ? state : { ...state, processes }
}
