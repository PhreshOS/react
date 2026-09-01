import type { Context, Endpoint } from "@phreshos/core"
import useSubscribe from "../source/use-subscribe.js"

type Events = {
  changed: { value: number }
  closed: undefined
}

function declaredEvents(endpoint: Endpoint<Events>) {
  const changed = useSubscribe(endpoint, "changed")
  const value: number | undefined = changed?.value
  void value

  const projected = useSubscribe(endpoint, "changed", message => message.value)
  const result: number | undefined = projected
  void result

  useSubscribe(endpoint, "unknown")

  useSubscribe(endpoint, "unknown", message => message)
}

void declaredEvents

function openEvents(endpoint: Endpoint) {
  useSubscribe(endpoint, "unknown")

  const projected = useSubscribe(endpoint, "changed", (message: number) => message)
  const value: number | undefined = projected
  void value
}

void openEvents

function closedEvents(endpoint: Endpoint<{}, never>) {
  // @ts-expect-error A React subscription obeys an explicitly closed event contract.
  useSubscribe(endpoint, "unknown")
}

void closedEvents

function openContext(context: Context) {
  const message = useSubscribe(context, "application-event")
  message?.payload
}

void openContext
