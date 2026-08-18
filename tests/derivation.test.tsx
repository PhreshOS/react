import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import useColor from "../source/use-color.js"
import useScale from "../source/use-scale.js"

describe("explicit visual derivation hooks", function () {
  it("derives and memoizes a complete numeric scale", function () {
    const hook = renderHook(({ value }) => useScale(value), { initialProps: { value: 12 } })
    const first = hook.result.current

    expect(first).toEqual({ xsmall: 3, small: 6, medium: 12, large: 18, xlarge: 24 })

    hook.rerender({ value: 12 })
    expect(hook.result.current).toBe(first)

    hook.rerender({ value: 16 })
    expect(hook.result.current).toEqual({ xsmall: 4, small: 8, medium: 16, large: 24, xlarge: 32 })
    expect(hook.result.current).not.toBe(first)
  })

  it("derives a complete scale from the supplied color", function () {
    const hook = renderHook(({ value }) => useColor(value), { initialProps: { value: "hotpink" } })

    expect(hook.result.current.base).toBe("hotpink")
    expect(hook.result.current.soft).toBe("color-mix(in oklch, hotpink 60%, white)")
  })
})
