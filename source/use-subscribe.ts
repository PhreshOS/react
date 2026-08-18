import { useCallback } from "react"
import type {
  Channel,
  ChannelMessage,
  Cleanup,
  Endpoint,
  EventMessage,
  EventName,
  EventSubscriber,
  Subscribable,
  SubscribableEvents,
  SubscribableFallback
} from "@phreshos/client"
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

type SubscribableTarget = Readonly<{
  subscribe: unknown
}>

type TargetEvent<Target> = AvailableEvent<
  SubscribableEvents<Target>,
  SubscribableFallback<Target>
>

type TargetMessage<Target, Event extends string> = EventMessage<
  SubscribableEvents<Target>,
  SubscribableFallback<Target>,
  Event
>

/**
 * Subscribes while mounted and retains the latest message or projected result.
 *
 * The target supplies known message types. An explicit generic or callback
 * annotation may narrow that type, but cannot replace it incompatibly.
 */
export default function useSubscribe<
  Target extends SubscribableTarget,
  Event extends TargetEvent<Target>
>(
  target: Target,
  event: Event
): TargetMessage<Target, Event> | undefined

export default function useSubscribe<Narrowed = unknown>(
  target: Endpoint,
  event: string
): Narrowed | undefined

export default function useSubscribe<Narrowed extends ChannelMessage<unknown> = ChannelMessage<unknown>>(
  target: Channel,
  event: string
): Narrowed | undefined

export default function useSubscribe<
  Target extends SubscribableTarget,
  Event extends TargetEvent<Target>,
  Result
>(
  target: Target,
  event: Event,
  project: (message: TargetMessage<Target, Event>) => Result
): Awaited<Result> | undefined

export default function useSubscribe<
  Narrowed,
  Result = unknown
>(
  target: Endpoint,
  event: string,
  project: (message: Narrowed) => Result
): Awaited<Result> | undefined

export default function useSubscribe<
  Narrowed extends ChannelMessage<unknown>,
  Result = unknown
>(
  target: Channel,
  event: string,
  project: (message: Narrowed) => Result
): Awaited<Result> | undefined

export default function useSubscribe<
  Narrowed,
  Events extends object,
  Fallback,
  Result
>(
  target: Subscribable<Events, Fallback>,
  event: CompatibleEvent<Events, Fallback, Narrowed>,
  project: (message: Narrowed) => Result
): Awaited<Result> | undefined

export default function useSubscribe<
  Events extends object,
  Fallback,
  Event extends string
>(
  target: Subscribable<Events, Fallback>,
  event: Event,
  project?: (message: EventMessage<Events, Fallback, Event>) => unknown
) {
  const connect = useCallback(
    (receive: EventSubscriber<EventMessage<Events, Fallback, Event>>) => {
      const subscribe = target.subscribe as unknown as (
        event: string,
        subscriber: EventSubscriber<EventMessage<Events, Fallback, Event>>
      ) => Cleanup

      return subscribe(event, receive)
    },
    [target, event]
  )

  return useEventResult(connect, project ?? identity)
}

function identity<Message>(message: Message) {
  return message
}
