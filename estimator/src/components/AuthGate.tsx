import type { Session } from "@supabase/supabase-js"
import { Calculator, Loader2 } from "lucide-react"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { setCloudUser } from "../lib/db"
import { supabase } from "../lib/supabase"
import { Button, Field, Input } from "./ui"

interface AuthInfo {
  email: string | null
  userId: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthInfo>({ email: null, userId: null, signOut: async () => {} })
export const useAuthInfo = () => useContext(AuthContext)

/**
 * With Supabase configured, requires sign-in and points storage at the user's account.
 * Without it, the app runs in this-browser-only mode.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true)
      // A different account needs fresh caches (price list, company), so start clean.
      if (event === "SIGNED_OUT") window.location.reload()
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!supabase) return <>{children}</>
  if (session === undefined)
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        <Loader2 className="animate-spin" />
      </div>
    )
  if (recovering && session) return <SetNewPassword onDone={() => setRecovering(false)} />
  if (!session) return <SignIn />

  // Set before children render so their first loads read from the account.
  setCloudUser(session.user.id)
  const info: AuthInfo = {
    email: session.user.email ?? null,
    userId: session.user.id,
    signOut: async () => {
      await supabase!.auth.signOut()
    },
  }
  return <AuthContext.Provider value={info}>{children}</AuthContext.Provider>
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2 font-semibold text-brand-700">
          <Calculator size={20} /> Home Construction Estimator
        </div>
        <h1 className="mb-4 text-lg font-semibold">{title}</h1>
        {children}
      </div>
    </div>
  )
}

function SignIn() {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const redirectTo = window.location.origin
    try {
      if (mode === "in") {
        const { error } = await supabase!.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === "up") {
        const { data, error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
        if (error) throw error
        if (!data.session) setMessage({ tone: "ok", text: "Check your email and click the confirmation link, then come back and sign in." })
      } else {
        const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo })
        if (error) throw error
        setMessage({ tone: "ok", text: "If that email has an account, a reset link is on its way." })
      }
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Something went wrong." })
    } finally {
      setBusy(false)
    }
  }

  const title = mode === "in" ? "Sign in" : mode === "up" ? "Create your account" : "Reset your password"
  return (
    <Shell title={title}>
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        {mode !== "forgot" && (
          <Field label="Password" hint={mode === "up" ? "At least 6 characters." : undefined}>
            <Input
              type="password"
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        {message && (
          <p className={message.tone === "error" ? "rounded bg-red-50 p-2 text-sm text-red-700" : "rounded bg-emerald-50 p-2 text-sm text-emerald-800"}>
            {message.text}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy && <Loader2 size={16} className="animate-spin" />}
          {mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
        </Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        {mode === "in" ? (
          <>
            <button className="text-brand-700 underline" onClick={() => setMode("up")}>
              Create an account
            </button>
            <button className="text-slate-500 underline" onClick={() => setMode("forgot")}>
              Forgot password?
            </button>
          </>
        ) : (
          <button className="text-brand-700 underline" onClick={() => setMode("in")}>
            Back to sign in
          </button>
        )}
      </div>
    </Shell>
  )
}

function SetNewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <Shell title="Choose a new password">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          const { error } = await supabase!.auth.updateUser({ password })
          setBusy(false)
          if (error) setError(error.message)
          else onDone()
        }}
      >
        <Field label="New password" hint="At least 6 characters.">
          <Input type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          Save password
        </Button>
      </form>
    </Shell>
  )
}
