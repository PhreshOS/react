import { cleanup, render } from "@testing-library/react"
import type { Theme } from "@phreshos/core"
import { afterEach, describe, expect, it } from "vitest"
import { useDocumentColorScheme } from "../source/main.js"

afterEach(cleanup)

describe("useDocumentColorScheme", function () {
  it("synchronizes the root with updates and restores its previous value", function () {
    const root = document.documentElement
    root.style.colorScheme = "light dark"

    const rendered = render(<DocumentScheme theme="dark" />)
    expect(root.style.colorScheme).toBe("dark")

    rendered.rerender(<DocumentScheme theme="light" />)
    expect(root.style.colorScheme).toBe("light")

    rendered.unmount()
    expect(root.style.colorScheme).toBe("light dark")
  })
})

function DocumentScheme({ theme }: Readonly<{ theme: Theme }>) {
  useDocumentColorScheme(theme)
  return null
}
