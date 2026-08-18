import { useMemo } from "react"
import { color, type ColorScale } from "@phreshos/core"

/** Returns the complete color scale derived from one explicit CSS color. */
export default function useColor(value: string): ColorScale {
  return useMemo(() => color(value), [value])
}
