import type { Theme } from "@phreshos/core"
import { useLayoutEffect } from "react"

/** Keeps the document root's native color scheme aligned with one effective Theme. */
export default function useDocumentColorScheme(theme: Theme): void {
  useLayoutEffect(() => {
    const root = document.documentElement
    const previous = root.style.colorScheme

    root.style.colorScheme = theme

    return () => { root.style.colorScheme = previous }
  }, [theme])
}
