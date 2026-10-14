// Minimal IndexedDB wrapper. Everything (projects, plan PDFs, price list) lives
// in the browser, so nothing leaves the machine except the sheets you send to AI.
import type { Project } from "./types"

const DB_NAME = "home-estimator"
const DB_VERSION = 1

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

export const db = {
  async listProjects(): Promise<Project[]> {
    const all = await wrap((await store("projects", "readonly")).getAll() as IDBRequest<Project[]>)
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
  async getProject(id: string): Promise<Project | undefined> {
    return wrap((await store("projects", "readonly")).get(id) as IDBRequest<Project | undefined>)
  },
  async putProject(project: Project): Promise<void> {
    await wrap((await store("projects", "readwrite")).put(project))
  },
  async deleteProject(id: string): Promise<void> {
    await wrap((await store("projects", "readwrite")).delete(id))
    await wrap((await store("pdfs", "readwrite")).delete(id))
  },
  async getPdf(projectId: string): Promise<Blob | undefined> {
    return wrap((await store("pdfs", "readonly")).get(projectId) as IDBRequest<Blob | undefined>)
  },
  async putPdf(projectId: string, blob: Blob): Promise<void> {
    await wrap((await store("pdfs", "readwrite")).put(blob, projectId))
  },
  async getKv<T>(key: string): Promise<T | undefined> {
    return wrap((await store("kv", "readonly")).get(key) as IDBRequest<T | undefined>)
  },
  async putKv<T>(key: string, value: T): Promise<void> {
    await wrap((await store("kv", "readwrite")).put(value, key))
  },
}
