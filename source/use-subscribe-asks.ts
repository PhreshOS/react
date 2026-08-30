import { useCallback } from "react"
import type { AskCapture, AskSubscriber, Cleanup } from "@phreshos/client"
import useEventResult from "./event-result.js"

/** Any Endpoint traffic surface capable of subscribing to its outgoing questions. */
export type AskSubscribable = Readonly<{
  /** Subscribes to questions sent by the target Endpoint and returns its cleanup. */
  subscribeAsks<Payload = unknown>(subscriber: AskSubscriber<Payload>): Cleanup
}>

/** Subscribes to outgoing questions while mounted and retains the latest projection. */
export default function useSubscribeAsks<Payload, Result>(
  target: AskSubscribable,
  project: (capture: AskCapture<Payload>) => Result
): Awaited<Result> | undefined {
  const connect = useCallback(
    (receive: AskSubscriber<Payload>) => target.subscribeAsks(receive),
    [target]
  )

  return useEventResult(connect, project)
}
