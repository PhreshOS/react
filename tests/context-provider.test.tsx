import { act, render, waitFor } from "@testing-library/react"
import type { Process } from "@phreshos/core"
import { describe, expect, it } from "vitest"
import ContextProvider, { useProcess } from "../source/context-provider.js"

describe("ContextProvider", function () {
  it("resolves only the runtime handles supplied through its props", async function () {
    const requested = deferred<Process>()
    const process = { identity: "process-one" } as Process
    const rendered = render(
      <ContextProvider process={() => requested.promise} fallback={<span>loading</span>}>
        <CurrentProcess />
      </ContextProvider>
    )

    expect(rendered.getByText("loading")).toBeTruthy()

    await act(async () => requested.resolve(process))
    await waitFor(() => expect(rendered.getByText("process-one")).toBeTruthy())
  })
})

function CurrentProcess() {
  return <span>{useProcess().identity}</span>
}

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>(complete => { resolve = complete })
  return { promise, resolve }
}
