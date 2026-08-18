import { useCallback } from "react"
import type { Captures, EventObserver, Subscribable } from "@phreshos/client"
import useEventResult from "./event-result.js"

/** Observes all events while mounted and retains the latest projected result. */
export default function useObserve<Events extends object, Fallback, Result>(
  target: Subscribable<Events, Fallback>,
  project: (capture: Captures<Events, Fallback>) => Result
): Awaited<Result> | undefined {
  const connect = useCallback(
    (receive: EventObserver<Events, Fallback>) => target.observe(receive),
    [target]
  )

  return useEventResult(connect, project)
}
