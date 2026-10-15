import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { db } from "./db"
import { uid } from "./format"
import { DEFAULT_CATEGORIES, type Company, type PriceItem, type Project } from "./types"

// ---- Shared key/value settings (price list, company, categories) ----

type Listener = () => void
const kvCache = new Map<string, unknown>()
const kvListeners = new Map<string, Set<Listener>>()
const kvLoading = new Set<string>()

function subscribeKv(key: string, fn: Listener) {
  if (!kvListeners.has(key)) kvListeners.set(key, new Set())
  kvListeners.get(key)!.add(fn)
  return () => kvListeners.get(key)!.delete(fn)
}

function setKv<T>(key: string, value: T) {
  kvCache.set(key, value)
  kvListeners.get(key)?.forEach((fn) => fn())
  db.putKv(key, value).catch(() => {})
}

function useKv<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const value = useSyncExternalStore(
    (fn) => subscribeKv(key, fn),
    () => (kvCache.has(key) ? (kvCache.get(key) as T) : undefined),
  )
  useEffect(() => {
    if (kvCache.has(key) || kvLoading.has(key)) return
    kvLoading.add(key)
    void db.getKv<T>(key).then((stored) => {
      kvLoading.delete(key)
      if (!kvCache.has(key)) {
        kvCache.set(key, stored ?? fallback)
        kvListeners.get(key)?.forEach((fn) => fn())
      }
    })
    // fallback is a constant per key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = (kvCache.has(key) ? kvCache.get(key) : fallback) as T
      setKv(key, typeof next === "function" ? (next as (p: T) => T)(prev) : next)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  return [value ?? fallback, update, value !== undefined]
}

const EMPTY_PRICES: PriceItem[] = []
export const usePriceList = () => useKv<PriceItem[]>("priceList", EMPTY_PRICES)
export const useCategories = () => useKv<string[]>("categories", DEFAULT_CATEGORIES)

export const DEFAULT_COMPANY: Company = {
  name: "",
  license: "",
  address: "",
  phone: "",
  email: "",
  logoDataUrl: null,
  terms:
    "This proposal is based on the plan set provided and is valid for 30 days. Any changes to plans, specifications, selections, or site conditions will be handled by written change order. Permit fees, utility connection fees, and engineering are excluded unless listed above. Payment schedule to be set out in the construction agreement.",
}
export const useCompany = () => useKv<Company>("company", DEFAULT_COMPANY)

// ---- Projects ----

export function newProject(name: string): Project {
  const now = new Date().toISOString()
  return {
    id: uid(),
    name,
    number: `EST-${now.slice(2, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 900 + 100)}`,
    client: { name: "", address: "", phone: "", email: "" },
    siteAddress: "",
    createdAt: now,
    updatedAt: now,
    settings: { overheadPct: 10, profitPct: 10, contingencyPct: 5, taxPct: DEFAULT_TAX_PCT, taxBasis: "materials", conditionedSf: 0 },
    lines: [],
    measurements: [],
    scales: {},
    pdfName: null,
    pageCount: 0,
    ai: null,
    proposal: { scopeNotes: "", exclusions: "", showLineItems: false },
  }
}

/** Georgetown, TX combined sales tax: 6.25% state + 2% city. */
export const DEFAULT_TAX_PCT = 8.25

export const pdfKeyOf = (p: Project) => p.pdfKey ?? p.id

/** Pages of the plan set that belong to this estimate. */
export function projectPages(p: Project, numPages: number): number[] {
  const all = Array.from({ length: numPages }, (_, i) => i + 1)
  if (!p.pages?.length) return all
  const valid = p.pages.filter((n) => n >= 1 && n <= numPages)
  return valid.length ? [...valid].sort((a, b) => a - b) : all
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const reload = useCallback(() => {
    void db.listProjects().then(setProjects)
  }, [])
  useEffect(reload, [reload])
  return { projects, reload }
}

/** Loads one project and saves edits back to IndexedDB (debounced). */
export function useProject(id: string) {
  const [project, setProject] = useState<Project | null | undefined>(undefined)
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef<Project | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    let cancelled = false
    void db.getProject(id).then((p) => {
      if (!cancelled) {
        latest.current = p ?? null
        setProject(p ?? null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    if (latest.current) db.putProject(latest.current).catch(() => {})
  }, [])

  useEffect(() => {
    mounted.current = true
    window.addEventListener("beforeunload", flush)
    return () => {
      mounted.current = false
      window.removeEventListener("beforeunload", flush)
      flush()
    }
  }, [flush])

  const update = useCallback(
    (fn: (p: Project) => Project) => {
      const stamp = (p: Project) => ({ ...fn(p), updatedAt: new Date().toISOString() })
      if (!mounted.current) {
        // Work that finishes after leaving the page (e.g. an AI run) is applied to the stored copy.
        db.getProject(id)
          .then((p) => p && db.putProject(stamp(p)))
          .catch(() => {})
        return
      }
      const prev = latest.current
      if (!prev) return
      const next = stamp(prev)
      latest.current = next
      setProject(next)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = undefined
        db.putProject(next).catch(() => {})
      }, 400)
    },
    [id],
  )

  return { project, update }
}
