// Storage for projects, plan PDFs and settings (price list, company, categories).
// Signed in to Supabase: saved to the user's account, with plan PDFs also cached in this browser.
// Without Supabase: everything lives in this browser's IndexedDB.
import { trackSave } from "./saveStatus"
import { PLANS_BUCKET, supabase } from "./supabase"
import type { Project } from "./types"

const DB_NAME = "home-estimator"
const DB_VERSION = 1

/** Fills in settings added after a project was saved. Early projects used Hawaii GET (4.712% on the total). */
export function migrateProject(p: Project): Project {
  const s = p.settings as Project["settings"] & { taxBasis?: Project["settings"]["taxBasis"] }
  if (s.taxBasis) return p
  const wasHawaiiDefault = s.taxPct === 4.712
  return {
    ...p,
    settings: { ...s, taxBasis: wasHawaiiDefault ? "materials" : "total", taxPct: wasHawaiiDefault ? 8.25 : s.taxPct },
  }
}

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" })
        if (!db.objectStoreNames.contains("pdfs")) db.createObjectStore("pdfs")
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv")
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function store(name: string, mode: IDBTransactionMode) {
  const db = await open()
  return db.transaction(name, mode).objectStore(name)
}

/** This browser's IndexedDB. Also used as the PDF cache when signed in. */
export const local = {
  async listProjects(): Promise<Project[]> {
    const all = await wrap((await store("projects", "readonly")).getAll() as IDBRequest<Project[]>)
    return all.map(migrateProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
  async getProject(id: string): Promise<Project | undefined> {
    const p = await wrap((await store("projects", "readonly")).get(id) as IDBRequest<Project | undefined>)
    return p && migrateProject(p)
  },
  async putProject(project: Project): Promise<void> {
    await wrap((await store("projects", "readwrite")).put(project))
  },
  async deleteProject(id: string): Promise<void> {
    await wrap((await store("projects", "readwrite")).delete(id))
  },
  async deletePdf(key: string): Promise<void> {
    await wrap((await store("pdfs", "readwrite")).delete(key))
  },
  async getPdf(key: string): Promise<Blob | undefined> {
    return wrap((await store("pdfs", "readonly")).get(key) as IDBRequest<Blob | undefined>)
  },
  async putPdf(key: string, blob: Blob): Promise<void> {
    await wrap((await store("pdfs", "readwrite")).put(blob, key))
  },
  async getKv<T>(key: string): Promise<T | undefined> {
    return wrap((await store("kv", "readonly")).get(key) as IDBRequest<T | undefined>)
  },
  async putKv<T>(key: string, value: T): Promise<void> {
    await wrap((await store("kv", "readwrite")).put(value, key))
  },
}

let cloudUserId: string | null = null

/** Set by the sign-in gate; while set, reads and writes go to the user's Supabase account. */
export function setCloudUser(id: string | null) {
  cloudUserId = id
}

function cloudOrThrow() {
  if (!supabase || !cloudUserId) throw new Error("Not signed in.")
  return { sb: supabase, uid: cloudUserId }
}

function check<T extends { error: { message: string } | null }>(res: T): T {
  if (res.error) throw new Error(res.error.message)
  return res
}

const pdfPath = (uid: string, key: string) => `${uid}/${key}.pdf`

const cloud = {
  async listProjects(): Promise<Project[]> {
    const { sb } = cloudOrThrow()
    const res = check(await sb.from("estimator_projects").select("data").order("updated_at", { ascending: false }))
    return (res.data ?? []).map((r) => migrateProject(r.data as Project))
  },
  async getProject(id: string): Promise<Project | undefined> {
    const { sb } = cloudOrThrow()
    const res = check(await sb.from("estimator_projects").select("data").eq("id", id).maybeSingle())
    return res.data ? migrateProject(res.data.data as Project) : undefined
  },
  async putProject(project: Project): Promise<void> {
    const { sb, uid } = cloudOrThrow()
    await trackSave(async () => {
      check(await sb.from("estimator_projects").upsert({ id: project.id, user_id: uid, data: project, updated_at: project.updatedAt }))
    })
  },
  async deleteProject(id: string): Promise<void> {
    const { sb } = cloudOrThrow()
    await trackSave(async () => {
      check(await sb.from("estimator_projects").delete().eq("id", id))
    })
  },
  async getPdf(key: string): Promise<Blob | undefined> {
    const cached = await local.getPdf(key)
    if (cached) return cached
    const { sb, uid } = cloudOrThrow()
    const { data, error } = await sb.storage.from(PLANS_BUCKET).download(pdfPath(uid, key))
    if (error || !data) return undefined
    const blob = new Blob([data], { type: "application/pdf" })
    await local.putPdf(key, blob).catch(() => {})
    return blob
  },
  async putPdf(key: string, blob: Blob): Promise<void> {
    const { sb, uid } = cloudOrThrow()
    await local.putPdf(key, blob).catch(() => {})
    await trackSave(async () => {
      check(await sb.storage.from(PLANS_BUCKET).upload(pdfPath(uid, key), blob, { upsert: true, contentType: "application/pdf" }))
    })
  },
  async deletePdf(key: string): Promise<void> {
    const { sb, uid } = cloudOrThrow()
    await local.deletePdf(key).catch(() => {})
    await trackSave(async () => {
      check(await sb.storage.from(PLANS_BUCKET).remove([pdfPath(uid, key)]))
    })
  },
  async getKv<T>(key: string): Promise<T | undefined> {
    const { sb } = cloudOrThrow()
    const res = check(await sb.from("estimator_settings").select("value").eq("key", key).maybeSingle())
    return (res.data?.value as T | undefined) ?? undefined
  },
  async putKv<T>(key: string, value: T): Promise<void> {
    const { sb, uid } = cloudOrThrow()
    await trackSave(async () => {
      check(
        await sb
          .from("estimator_settings")
          .upsert({ user_id: uid, key, value, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" }),
      )
    })
  },
}

const active = () => (cloudUserId ? cloud : local)

export const db: typeof local = {
  listProjects: () => active().listProjects(),
  getProject: (id) => active().getProject(id),
  putProject: (p) => active().putProject(p),
  deleteProject: (id) => active().deleteProject(id),
  deletePdf: (key) => active().deletePdf(key),
  getPdf: (key) => active().getPdf(key),
  putPdf: (key, blob) => active().putPdf(key, blob),
  getKv: (key) => active().getKv(key),
  putKv: (key, value) => active().putKv(key, value),
}

const SETTINGS_KEYS = ["priceList", "company", "categories"]

/** What this browser has saved locally, for the "move to your account" offer after signing in. */
export async function localSummary() {
  const projects = await local.listProjects()
  const settings: string[] = []
  for (const k of SETTINGS_KEYS) if ((await local.getKv(k)) !== undefined) settings.push(k)
  return { projects, settings }
}

/**
 * Copies estimates, their plan PDFs and settings saved in this browser into the signed-in account.
 * Settings already in the account are kept, so a price list from another computer isn't overwritten.
 */
export async function uploadLocalToCloud(onProgress: (done: number, total: number) => void) {
  const { projects, settings } = await localSummary()
  const pdfKeys = [...new Set(projects.map((p) => p.pdfKey ?? p.id))]
  const total = projects.length + pdfKeys.length + settings.length
  let done = 0
  const tick = () => onProgress(++done, total)
  for (const k of settings) {
    if ((await cloud.getKv(k)) === undefined) await cloud.putKv(k, await local.getKv(k))
    tick()
  }
  for (const key of pdfKeys) {
    const blob = await local.getPdf(key)
    if (blob) await cloud.putPdf(key, blob)
    tick()
  }
  for (const p of projects) {
    const existing = await cloud.getProject(p.id)
    if (!existing || existing.updatedAt < p.updatedAt) await cloud.putProject(p)
    tick()
  }
}
