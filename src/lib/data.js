import { useEffect, useState, createContext, useContext } from 'react'
import { onSnapshot } from 'firebase/firestore'

const mapDoc = (d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })

/**
 * Live-subscribe to a Firestore query or document reference.
 * Pass `null` to skip. `deps` controls when the subscription is rebuilt.
 */
export function useLive(refOrQuery, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true })

  useEffect(() => {
    if (!refOrQuery) {
      setState({ data: undefined, error: null, loading: false })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    const unsub = onSnapshot(
      refOrQuery,
      { includeMetadataChanges: false },
      (snap) => {
        const data = 'docs' in snap ? snap.docs.map(mapDoc) : snap.exists() ? mapDoc(snap) : null
        setState({ data, error: null, loading: false })
      },
      (error) => {
        console.error(error)
        setState({ data: undefined, error, loading: false })
      },
    )
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

export const SessionContext = createContext(null)
/** { user, profile, isOwner, store } */
export const useSession = () => useContext(SessionContext)
