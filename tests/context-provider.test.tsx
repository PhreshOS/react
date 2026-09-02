import { act, render, waitFor } from "@testing-library/react"
import type { ClientContext, Process } from "@phreshos/core"
import { describe, expect, it } from "vitest"
import ContextProvider, { useProcess } from "../source/context-provider.js"

describe("ContextProvider", function () {
  it("provides one Client Context and resolves its current Process", async function () {
    const requested = deferred<Process>()
    const process = { identity: "process-one" } as Process
    const rendered = render(
      <ContextProvider context={{
        process: () => requested.promise,
        program: async () => ({}),
        parent: async () => null
      } as ClientContext} fallback={<span>loading</span>}>
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
