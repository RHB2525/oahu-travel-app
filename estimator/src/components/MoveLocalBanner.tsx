import { CloudUpload, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { localSummary, uploadLocalToCloud } from "../lib/db"
import { useAuthInfo } from "./AuthGate"
import { Button } from "./ui"

const flagKey = (uid: string) => `movedLocal:${uid}`

function readFlag(uid: string) {
  try {
    return localStorage.getItem(flagKey(uid)) === "1"
  } catch {
    return false
  }
}

/** After signing in, offers to copy estimates saved only in this browser into the account. */
export function MoveLocalBanner({ onMoved }: { onMoved: () => void }) {
  const { userId } = useAuthInfo()
  const [summary, setSummary] = useState<{ projects: number; settings: number } | null>(null)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!userId || readFlag(userId)) return
    void localSummary().then((s) => setSummary({ projects: s.projects.length, settings: s.settings.length }))
  }, [userId])

  if (!userId || hidden || !summary || summary.projects + summary.settings === 0) return null

  const markDone = () => {
    try {
      localStorage.setItem(flagKey(userId), "1")
    } catch {
      /* ignore */
    }
    setHidden(true)
  }

  async function move() {
    setError(null)
    setProgress([0, 1])
    try {
      await uploadLocalToCloud((done, total) => setProgress([done, total]))
      markDone()
      onMoved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.")
      setProgress(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
      <CloudUpload size={20} className="shrink-0 text-sky-600" />
      <p className="min-w-0 flex-1">
        This browser has {summary.projects} estimate{summary.projects === 1 ? "" : "s"}
        {summary.settings ? " and your price list / company settings" : ""} saved from before you signed in. Move them to your account so
        they're safe and available on any computer?
        {error && <span className="mt-1 block text-red-700">Couldn't finish: {error}. Try again.</span>}
      </p>
      {progress ? (
        <span className="flex items-center gap-2 text-sky-800">
          <Loader2 size={16} className="animate-spin" /> Uploading {progress[0]} of {progress[1]}…
        </span>
      ) : (
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => void move()}>
            Move to my account
          </Button>
          <Button variant="ghost" onClick={markDone}>
            No thanks
          </Button>
        </div>
      )}
    </div>
  )
}
