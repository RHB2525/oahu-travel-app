import { useSyncExternalStore } from "react"

/** Tracks writes to the cloud so the header can show Saving… / Saved / a retry button. */
type State = { pending: number; error: string | null; retry: (() => void) | null }

let state: State = { pending: 0, error: null, retry: null }
const listeners = new Set<() => void>()
const emit = (next: State) => {
  state = next
  listeners.forEach((fn) => fn())
}

export async function trackSave<T>(run: () => Promise<T>): Promise<T> {
  emit({ ...state, pending: state.pending + 1 })
  try {
    const result = await run()
    emit({ pending: state.pending - 1, error: null, retry: null })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    emit({ pending: state.pending - 1, error: message, retry: () => void trackSave(run).catch(() => {}) })
    throw err
  }
}

export function hasUnsavedChanges() {
  return state.pending > 0 || state.error !== null
}

export function useSaveStatus() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => state,
  )
}
