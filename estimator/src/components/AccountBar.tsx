import { AlertTriangle, Check, Loader2, LogOut } from "lucide-react"
import { useEffect } from "react"
import { hasUnsavedChanges, useSaveStatus } from "../lib/saveStatus"
import { useAuthInfo } from "./AuthGate"

/** Save status and signed-in account, shown in the header when using Supabase. */
export function AccountBar() {
  const { email, signOut } = useAuthInfo()
  const status = useSaveStatus()

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) e.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [])

  if (!email) return null
  return (
    <div className="flex items-center gap-2 border-l border-slate-200 pl-3 text-xs">
      {status.error ? (
        <button
          onClick={() => status.retry?.()}
          className="flex items-center gap-1 rounded bg-red-50 px-2 py-1 font-medium text-red-700 hover:bg-red-100"
          title={status.error}
        >
          <AlertTriangle size={13} /> Not saved, retry
        </button>
      ) : status.pending > 0 ? (
        <span className="flex items-center gap-1 text-slate-500">
          <Loader2 size={13} className="animate-spin" /> Saving…
        </span>
      ) : (
        <span className="flex items-center gap-1 text-emerald-700">
          <Check size={13} /> Saved
        </span>
      )}
      <span className="hidden max-w-[160px] truncate text-slate-500 lg:inline" title={email}>
        {email}
      </span>
      <button onClick={() => void signOut()} className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Sign out" aria-label="Sign out">
        <LogOut size={15} />
      </button>
    </div>
  )
}
