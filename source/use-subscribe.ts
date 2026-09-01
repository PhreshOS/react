import { useCallback } from "react"
import type {
  Captures,
  Cleanup,
  Context,
  ContextMessage,
  Endpoint,
  EventMessage,
  EventName,
  EventSubscriber,
  Subscribable,
  SubscribableEvents,
  SubscribableFallback
} from "@phreshos/core"
import useEventResult from "./event-result.js"

type OpenEvent = string & {}

type AvailableEvent<Events extends object, Fallback> =
  | EventName<Events>
  | ([Fallback] extends [never] ? never : OpenEvent)

type CompatibleEvent<Events extends object, Fallback, Narrowed> = {
  [Event in EventName<Events>]: Narrowed extends Events[Event] ? Event : never
}[EventName<Events>] | (
  [Fallback] extends [never]
    ? never
    : Narrowed extends Fallback ? OpenEvent : never
)

type SubscribableTarget = Readonly<{ subscribe: unknown }>

type TargetEvent<Target> = AvailableEvent<
  SubscribableEvents<Target>,
  SubscribableFallback<Target>
>

type TargetMessage<Target, Event extends string> = EventMessage<
  SubscribableEvents<Target>,
  SubscribableFallback<Target>,
  Event
>

type TargetCapture<Target> = Captures<
  SubscribableEvents<Target>,
  SubscribableFallback<Target>
>

/** Subscribes while mounted and retains the latest named message. */
export default function useSubscribe<
  Target extends SubscribableTarget,
  Event extends TargetEvent<Target>
>(target: Target, event: Event): TargetMessage<Target, Event> | undefined

export default function useSubscribe<Narrowed = unknown>(target: Endpoint, event: string): Narrowed | undefined

export default function useSubscribe<Narrowed extends ContextMessage<unknown> = ContextMessage<unknown>>(
  target: Context,
  event: string
): Narrowed | undefined

/** Subscribes while mounted and retains the latest projected named message. */
export default function useSubscribe<
  Target extends SubscribableTarget,
  Event extends TargetEvent<Target>,
  Result
>(
  target: Target,
  event: Event,
  project: (message: TargetMessage<Target, Event>) => Result
): Awaited<Result> | undefined

export default function useSubscribe<Narrowed, Result = unknown>(
  target: Endpoint,
  event: string,
  project: (message: Narrowed) => Result
): Awaited<Result> | undefined

export default function useSubscribe<Narrowed extends ContextMessage<unknown>, Result = unknown>(
  target: Context,
  event: string,
  project: (message: Narrowed) => Result
): Awaited<Result> | undefined

export default function useSubscribe<Narrowed, Events extends object, Fallback, Result>(
  target: Subscribable<Events, Fallback>,
  event: CompatibleEvent<Events, Fallback, Narrowed>,
  project: (message: Narrowed) => Result
): Awaited<Result> | undefined

/** Subscribes across every event and retains the latest projected capture. */
export default function useSubscribe<Target extends SubscribableTarget, Result>(
  target: Target,
  project: (capture: TargetCapture<Target>) => Result
): Awaited<Result> | undefined

export default function useSubscribe(
  target: Subscribable<object, unknown>,
  eventOrProject: string | ((capture: Captures<object, unknown>) => unknown),
  namedProject?: (message: unknown) => unknown
) {
  const event = typeof eventOrProject === "string" ? eventOrProject : null
  const connect = useCallback(
    (receive: EventSubscriber<unknown>) => {
      if (event === null) {
        const subscribe = target.subscribe as unknown as (
          subscriber: EventSubscriber<Captures<object, unknown>>
        ) => Cleanup
        return subscribe(receive as EventSubscriber<Captures<object, unknown>>)
      }

      const subscribe = target.subscribe as unknown as (
        event: string,
        subscriber: EventSubscriber<unknown>
      ) => Cleanup
      return subscribe(event, receive)
    },
    [target, event]
  )

  const project = event === null ? eventOrProject : namedProject ?? identity
  return useEventResult(connect, project as (message: unknown) => unknown)
}

function identity<Message>(message: Message) {
  return message
}
