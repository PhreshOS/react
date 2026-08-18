import { useMemo } from "react"
import { numericScale, type NumericScale } from "@phreshos/core"

/** Returns the complete visual scale derived from one explicit numeric value. */
export default function useScale(value: number): NumericScale {
  return useMemo(() => numericScale(value), [value])
}
