import { Copy, Download, FileUp, FolderOpen, Layers, Plus, Trash2, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { Button, Card, EmptyState, Field, Input, Modal } from "../components/ui"
import { projectTotals } from "../lib/calc"
import { db } from "../lib/db"
import { downloadBlob, fmtMoney0, safeFilename, uid } from "../lib/format"
import { bytesToBase64 } from "../lib/pdf"
import { href, navigate } from "../lib/route"
import { newProject, pdfKeyOf, useCategories, useProjects } from "../lib/store"
import type { Project } from "../lib/types"

export function ProjectsView() {
  const { projects, reload } = useProjects()
  const [categories] = useCategories()
  const [creating, setCreating] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  async function exportBackup(p: Project) {
    const pdf = await db.getPdf(pdfKeyOf(p))
    const payload = {
      app: "home-estimator",
      version: 1,
      project: p,
      pdfBase64: pdf ? bytesToBase64(new Uint8Array(await pdf.arrayBuffer())) : null,
    }
    downloadBlob(new Blob([JSON.stringify(payload)], { type: "application/json" }), `${safeFilename(p.name)}.estimate.json`)
  }

  async function importBackup(file: File) {
    try {
      const payload = JSON.parse(await file.text())
      if (payload?.app !== "home-estimator" || !payload.project) throw new Error("Not an estimator backup file.")
      const project: Project = { ...payload.project, id: uid(), pdfKey: undefined, updatedAt: new Date().toISOString() }
      await db.putProject(project)
      if (payload.pdfBase64) {
        const bytes = Uint8Array.from(atob(payload.pdfBase64), (c) => c.charCodeAt(0))
        await db.putPdf(project.id, new Blob([bytes], { type: "application/pdf" }))
      }
      reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Import failed")
    }
  }

  async function remove(p: Project) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    await db.deleteProject(p.id)
    // The plan set may be shared with other houses split from the same PDF.
    const key = pdfKeyOf(p)
    if (!(await db.listProjects()).some((x) => pdfKeyOf(x) === key)) await db.deletePdf(key)
    reload()
  }

  async function duplicate(p: Project) {
    const now = new Date().toISOString()
    await db.putProject({ ...structuredClone(p), id: uid(), pdfKey: pdfKeyOf(p), name: `${p.name} (copy)`, createdAt: now, updatedAt: now })
    reload()
  }

  const sharedCount = (p: Project) => projects?.filter((x) => pdfKeyOf(x) === pdfKeyOf(p)).length ?? 0

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-slate-500">Saved in this browser. Use Backup to move a job to another computer.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => importRef.current?.click()}>
            <Upload size={16} /> Import backup
          </Button>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> New estimate
          </Button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importBackup(f)
              e.target.value = ""
            }}
          />
        </div>
      </div>

      <Card>
        {projects === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : projects.length === 0 ? (
          <EmptyState icon={<FolderOpen size={36} />} title="No estimates yet">
            Create an estimate and upload the plan set PDF to get started.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <a href={href.project(p.id)} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 hover:text-brand-700">{p.name}</p>
                  <p className="truncate text-sm text-slate-500">
                    {[p.number, p.client.name, p.siteAddress, p.pdfName].filter(Boolean).join(" · ")}
                  </p>
                  {(p.pages?.length || sharedCount(p) > 1) && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Layers size={12} />
                      {p.pages?.length ? `${p.pages.length} sheet${p.pages.length === 1 ? "" : "s"}` : "All sheets"}
                      {sharedCount(p) > 1 && ` · plan set shared with ${sharedCount(p) - 1} other estimate${sharedCount(p) > 2 ? "s" : ""}`}
                    </p>
                  )}
                </a>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{fmtMoney0(projectTotals(p, categories).total)}</p>
                  <p className="text-xs text-slate-500">Updated {new Date(p.updatedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" title="Duplicate (e.g. to start a similar plan)" onClick={() => void duplicate(p)}>
                    <Copy size={16} />
                  </Button>
                  <Button size="sm" variant="ghost" title="Download backup" onClick={() => void exportBackup(p)}>
                    <Download size={16} />
                  </Button>
                  <Button size="sm" variant="ghost" title="Delete" onClick={() => void remove(p)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {creating && <NewProjectModal onClose={() => setCreating(false)} />}
    </div>
  )
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("")
  const [client, setClient] = useState("")
  const [site, setSite] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    const p = newProject(name.trim() || file?.name.replace(/\.pdf$/i, "") || "New estimate")
    p.client.name = client.trim()
    p.siteAddress = site.trim()
    if (file) {
      p.pdfName = file.name
      await db.putPdf(p.id, file)
    }
    await db.putProject(p)
    navigate(href.project(p.id))
  }

  return (
    <Modal title="New estimate" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
      >
        <Field label="Project name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Smith Residence" />
        </Field>
        <Field label="Client">
          <Input value={client} onChange={(e) => setClient(e.target.value)} />
        </Field>
        <Field label="Site address">
          <Input value={site} onChange={(e) => setSite(e.target.value)} />
        </Field>
        <Field label="Plan set (PDF)" hint="Optional now, you can upload it on the Plans tab.">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:bg-slate-50">
            <FileUp size={18} />
            <span className="truncate">{file ? file.name : "Choose PDF…"}</span>
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  )
}
