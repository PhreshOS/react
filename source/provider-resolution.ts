import { useEffect, useState } from "react"
import LiveSnapshot from "./live-snapshot.js"

type Stores = readonly LiveSnapshot<unknown>[]

/** Starts a provider's stores as one lifecycle and reports when all are ready. */
export default function useProviderResolution(stores: Stores) {
  const [resolution, setResolution] = useState<Resolution>({ stores, status: "pending" })

  useEffect(() => {
    let active = true

    void Promise.all(stores.map(store => store.start())).then(() => {
      if (active) setResolution({ stores, status: "ready" })
    }, error => {
      for (const store of stores) store.stop()
      if (active) setResolution({ stores, status: "error", error })
    })

    return () => {
      active = false
      for (const store of stores) store.stop()
    }
  }, [stores])

  if (resolution.stores !== stores) return false
  if (resolution.status === "error") throw resolution.error
  return resolution.status === "ready"
}

type Resolution =
  | Readonly<{ stores: Stores, status: "pending" }>
  | Readonly<{ stores: Stores, status: "ready" }>
  | Readonly<{ stores: Stores, status: "error", error: unknown }>
