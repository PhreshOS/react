import { useCallback } from "react"
import type {
  AnswerCapture,
  AnswerObserver,
  Cleanup
} from "@phreshos/client"
import useEventResult from "./event-result.js"

/** Any Server traffic surface capable of observing its outgoing answers. */
export type AnswerObservable = Readonly<{
  /** Observes answers sent by the target Server and returns its cleanup. */
  observeAnswers<Result = unknown>(observer: AnswerObserver<Result>): Cleanup
}>

/**
 * Observes answers in one Server's traffic while mounted and retains the
 * latest projected result.
 */
export default function useObserveAnswers<Answer, Result>(
  target: AnswerObservable,
  project: (capture: AnswerCapture<Answer>) => Result
): Awaited<Result> | undefined {
  const connect = useCallback(
    (receive: AnswerObserver<Answer>) => target.observeAnswers(receive),
    [target]
  )

  return useEventResult(connect, project)
}
