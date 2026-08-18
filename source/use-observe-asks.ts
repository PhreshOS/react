import { useCallback } from "react"
import type {
  AskCapture,
  AskObserver,
  Cleanup
} from "@phreshos/client"
import useEventResult from "./event-result.js"

/** Any Endpoint traffic surface capable of observing its outgoing questions. */
export type AskObservable = Readonly<{
  /** Observes questions sent by the target Endpoint and returns its cleanup. */
  observeAsks<Payload = unknown>(observer: AskObserver<Payload>): Cleanup
}>

/**
 * Observes questions in one Endpoint's traffic while mounted and retains the
 * latest projected result.
 */
export default function useObserveAsks<Payload, Result>(
  target: AskObservable,
  project: (capture: AskCapture<Payload>) => Result
): Awaited<Result> | undefined {
  const connect = useCallback(
    (receive: AskObserver<Payload>) => target.observeAsks(receive),
    [target]
  )

  return useEventResult(connect, project)
}
