import { useCallback } from "react"
import type { AnswerCapture, AnswerSubscriber, Cleanup } from "@phreshos/core"
import useEventResult from "./event-result.js"

/** Any Server traffic surface capable of subscribing to its outgoing answers. */
export type AnswerSubscribable = Readonly<{
  /** Subscribes to answers sent by the target Server and returns its cleanup. */
  subscribeAnswers<Result = unknown>(subscriber: AnswerSubscriber<Result>): Cleanup
}>

/** Subscribes to outgoing answers while mounted and retains the latest projection. */
export default function useSubscribeAnswers<Answer, Result>(
  target: AnswerSubscribable,
  project: (capture: AnswerCapture<Answer>) => Result
): Awaited<Result> | undefined {
  const connect = useCallback(
    (receive: AnswerSubscriber<Answer>) => target.subscribeAnswers(receive),
    [target]
  )

  return useEventResult(connect, project)
}
