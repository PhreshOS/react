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

  // @ts-expect-error A React subscription obeys the target's event contract.
  useSubscribe(endpoint, "unknown")

  // @ts-expect-error A projected React subscription obeys the target's event contract.
  useSubscribe(endpoint, "unknown", message => message)
}

void declaredEvents

function undeclaredEvents(endpoint: Endpoint) {
  // @ts-expect-error An Endpoint with no event declaration exposes no event names.
  useSubscribe(endpoint, "unknown")
}

void undeclaredEvents

function openContext(context: Context) {
  const message = useSubscribe(context, "application-event")
  message?.payload
}

void openContext
