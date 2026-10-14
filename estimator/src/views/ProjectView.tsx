import clsx from "clsx"
import { ChevronLeft } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { projectTotals } from "../lib/calc"
import { db } from "../lib/db"
import { fmtMoney0, uid } from "../lib/format"
import { loadPdf, type PDFDocumentProxy } from "../lib/pdf"
import { href, type ProjectTab } from "../lib/route"
import { pdfKeyOf, useCategories, useProject } from "../lib/store"
import type { Project } from "../lib/types"
import { NextStep } from "../components/NextStep"
import { DetailsTab } from "./DetailsTab"
import { EstimateTab } from "./EstimateTab"
import { PlansTab } from "./PlansTab"
import { ProposalTab } from "./ProposalTab"

export type UpdateProject = (fn: (p: Project) => Project) => void

const TABS: { id: ProjectTab; label: string }[] = [
  { id: "plans", label: "Plans & Takeoff" },
  { id: "estimate", label: "Estimate" },
  { id: "proposal", label: "Proposal" },
  { id: "details", label: "Job Details" },
]

export function ProjectView({ id, tab, panel }: { id: string; tab: ProjectTab; panel?: "ai" }) {
  const { project, update } = useProject(id)
  const [categories] = useCategories()
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(true)
  const [pdfVersion, setPdfVersion] = useState(0)
  const pdfKey = project ? pdfKeyOf(project) : null

  // This effect owns the loaded document and frees it when the project or file changes.
  useEffect(() => {
    if (!pdfKey) return
    let cancelled = false
    let loaded: PDFDocumentProxy | null = null
    setPdfLoading(true)
    setPdfError(null)
    void (async () => {
      try {
        const blob = await db.getPdf(pdfKey)
        if (blob) loaded = await loadPdf(blob)
        if (cancelled) void loaded?.loadingTask.destroy()
        else setDoc(loaded)
      } catch (err) {
        if (!cancelled) {
          setPdfError(err instanceof Error ? err.message : "Could not open the PDF.")
          setDoc(null)
        }
      } finally {
        if (!cancelled) setPdfLoading(false)
      }
    })()
    return () => {
      cancelled = true
      void loaded?.loadingTask.destroy()
    }
  }, [pdfKey, pdfVersion])

  const replacePdf = useCallback(
    async (file: File) => {
      const check = await loadPdf(file).catch(() => null)
      if (!check) {
        setPdfError("That file could not be read as a PDF.")
        return
      }
      const pageCount = check.numPages
      void check.loadingTask.destroy()
      // A replacement always gets a fresh key so other houses sharing the old set are untouched.
      const newKey = uid()
      await db.putPdf(newKey, file)
      if (pdfKey && !(await db.listProjects()).some((x) => x.id !== id && pdfKeyOf(x) === pdfKey)) await db.deletePdf(pdfKey)
      update((p) => ({ ...p, pdfName: file.name, pdfKey: newKey, pages: undefined, pageCount }))
      setPdfVersion((v) => v + 1)
    },
    [id, pdfKey, update],
  )

  useEffect(() => {
    if (doc && project && project.pageCount !== doc.numPages) update((p) => ({ ...p, pageCount: doc.numPages }))
  }, [doc, project, update])

  if (project === undefined) return <p className="p-6 text-sm text-slate-500">Loading…</p>
  if (project === null)
    return (
      <div className="p-6">
        <p className="mb-2">Project not found.</p>
        <a className="text-brand-700 underline" href={href.projects()}>
          Back to projects
        </a>
      </div>
    )

  const totals = projectTotals(project, categories)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col print:block print:h-auto">
      <div className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3">
          <a href={href.projects()} className="text-slate-500 hover:text-slate-800" aria-label="Back to projects">
            <ChevronLeft size={20} />
          </a>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">{project.name}</h1>
            <p className="truncate text-xs text-slate-500">{[project.number, project.client.name, project.siteAddress].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">Estimate total</p>
            <p className="text-lg font-semibold tabular-nums">
              {fmtMoney0(totals.total)}
              {totals.perSf && <span className="ml-2 text-sm font-normal text-slate-500">{fmtMoney0(totals.perSf)}/SF</span>}
            </p>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 pt-2">
          {TABS.map((t) => (
            <a
              key={t.id}
              href={href.project(id, t.id)}
              className={clsx(
                "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
                tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:text-slate-900",
              )}
            >
              {t.label}
              {t.id === "estimate" && project.lines.length > 0 && <span className="ml-1.5 text-xs text-slate-400">{project.lines.length}</span>}
            </a>
          ))}
        </nav>
      </div>
      <NextStep project={project} doc={doc} />
      <div className="min-h-0 flex-1 overflow-auto print:overflow-visible">
        {tab === "plans" && (
          <PlansTab
            project={project}
            update={update}
            doc={doc}
            pdfLoading={pdfLoading}
            pdfError={pdfError}
            onUpload={replacePdf}
            initialPanel={panel}
          />
        )}
        {tab === "estimate" && <EstimateTab project={project} update={update} />}
        {tab === "proposal" && <ProposalTab project={project} update={update} />}
        {tab === "details" && <DetailsTab project={project} update={update} />}
      </div>
    </div>
  )
}
