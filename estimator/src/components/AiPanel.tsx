import clsx from "clsx"
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, Square, XCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { aiLineToEstimate, analyzePage, consolidate, runPool } from "../lib/ai"
import { fmtNum } from "../lib/format"
import type { PDFDocumentProxy } from "../lib/pdf"
import { useCategories, usePriceList } from "../lib/store"
import type { AiPageResult, Project } from "../lib/types"
import type { UpdateProject } from "../views/ProjectView"
import { Badge, Button, Textarea } from "./ui"

type PageStatus = { state: "queued" | "running" | "done" | "error"; error?: string }

const CONCURRENCY = 3

export function AiPanel({
  project,
  update,
  doc,
  pages,
  currentPage,
}: {
  project: Project
  update: UpdateProject
  doc: PDFDocumentProxy
  /** Sheets that belong to this estimate (one house of a multi-house set). */
  pages: number[]
  currentPage: number
}) {
  const [prices] = usePriceList()
  const [categories] = useCategories()
  const [selected, setSelected] = useState<Set<number>>(() => new Set(pages))
  const [highDetail, setHighDetail] = useState(true)
  const [status, setStatus] = useState<Record<number, PageStatus>>({})
  const [phase, setPhase] = useState<"idle" | "pages" | "consolidating">("idle")
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const notes = project.aiNotes ?? ""
  // When this estimate is one house of a multi-house set, shared sheets (schedules, notes) can list every plan.
  const aiNotes = project.pages?.length
    ? `This estimate covers only the house "${project.name}". Some sheets are shared by several plans in the set; on those, count only what applies to this house and flag anything ambiguous.\n${notes}`
    : notes

  const sheetOf = (n: number) => project.ai?.pages.find((p) => p.page === n)

  async function runConsolidation(pageResults: AiPageResult[], signal?: AbortSignal) {
    setPhase("consolidating")
    try {
      const consolidation = await consolidate(pageResults, prices, categories, aiNotes, signal)
      update((p) => ({ ...p, ai: { at: new Date().toISOString(), pages: pageResults, consolidation } }))
    } catch (err) {
      if (!signal?.aborted) setError(`Combining results failed: ${(err as Error).message}`)
    }
  }

  async function run() {
    const targets = pages.filter((n) => selected.has(n))
    if (!targets.length) return
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    setPhase("pages")
    setStatus(Object.fromEntries(targets.map((n) => [n, { state: "queued" }])))
    // Keep results for sheets not re-run this time.
    const results = new Map<number, AiPageResult>(
      (project.ai?.pages ?? []).filter((p) => !targets.includes(p.page) && pages.includes(p.page)).map((p) => [p.page, p]),
    )
    await runPool(
      targets,
      CONCURRENCY,
      (n) => {
        setStatus((s) => ({ ...s, [n]: { state: "running" } }))
        return analyzePage(doc, n, { categories, projectNotes: aiNotes, highDetail, signal: controller.signal })
      },
      (n, result, err) => {
        if (result) results.set(n, result)
        setStatus((s) => ({ ...s, [n]: err ? { state: "error", error: controller.signal.aborted ? "Cancelled" : err.message } : { state: "done" } }))
      },
    )
    const pageResults = [...results.values()].sort((a, b) => a.page - b.page)
    // Save sheet results right away so a failed combine step doesn't lose them.
    update((p) => ({ ...p, ai: { at: new Date().toISOString(), pages: pageResults, consolidation: p.ai?.consolidation ?? null } }))
    if (!controller.signal.aborted && pageResults.length) await runConsolidation(pageResults, controller.signal)
    setPhase("idle")
    abortRef.current = null
  }

  const running = phase !== "idle"

  // Closing the tab mid-run would cancel the requests; other pages in the app are fine.
  useEffect(() => {
    if (!running) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [running])
  const toggle = (n: number) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  return (
    <div className="space-y-4 p-3">
      <div className="rounded-md bg-violet-50 p-3 text-xs text-violet-900">
        Claude reads each sheet (images plus the PDF's text layer), counts symbols and reads dimensions and schedules, then merges everything
        into estimate lines matched to your price list. Always review the quantities: treat them as a first draft.
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Sheets to analyze</span>
          <span className="flex gap-2 text-xs">
            <button className="text-brand-700 hover:underline" onClick={() => setSelected(new Set(pages))}>
              All
            </button>
            <button className="text-brand-700 hover:underline" onClick={() => setSelected(new Set())}>
              None
            </button>
            <button className="text-brand-700 hover:underline" onClick={() => setSelected(new Set([currentPage]))}>
              This page
            </button>
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {pages.map((n) => {
            const st = status[n]
            const sheet = sheetOf(n)
            return (
              <label
                key={n}
                title={st?.error ?? sheet?.sheet_title ?? ""}
                className={clsx(
                  "flex cursor-pointer items-center gap-1 rounded border px-1.5 py-1 text-xs",
                  selected.has(n) ? "border-brand-500 bg-brand-50" : "border-slate-200",
                )}
              >
                <input type="checkbox" className="sr-only" checked={selected.has(n)} onChange={() => toggle(n)} disabled={running} />
                {st?.state === "running" ? (
                  <Loader2 size={12} className="animate-spin text-violet-600" />
                ) : st?.state === "done" ? (
                  <CheckCircle2 size={12} className="text-emerald-600" />
                ) : st?.state === "error" ? (
                  <XCircle size={12} className="text-red-600" />
                ) : null}
                <span className="truncate">{sheet?.sheet_number || `p. ${n}`}</span>
              </label>
            )
          })}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Notes for the estimator (optional)</span>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => update((p) => ({ ...p, aiNotes: e.target.value }))}
          placeholder="e.g. Standing seam metal roof. LVP throughout except tile in baths. Shaker cabinets. Ignore sheet A-0 (existing)."
        />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={highDetail} onChange={(e) => setHighDetail(e.target.checked)} disabled={running} />
        <span>
          High-detail mode
          <span className="block text-xs text-slate-500">Also sends zoomed sections of each sheet (a 3×2 grid on 36"×24" and larger sheets). Much better at reading small notes and counting outlets and fixtures, at several times the cost.</span>
        </span>
      </label>

      <div className="flex gap-2">
        {running ? (
          <Button variant="danger" onClick={() => abortRef.current?.abort()}>
            <Square size={14} /> Cancel
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void run()} disabled={!selected.size}>
            <Sparkles size={16} /> Analyze {selected.size} sheet{selected.size === 1 ? "" : "s"}
          </Button>
        )}
        {!running && project.ai?.pages.length ? (
          <Button onClick={() => void runConsolidation(project.ai!.pages).then(() => setPhase("idle"))} title="Re-match to your current price list without re-reading sheets">
            Re-combine
          </Button>
        ) : null}
      </div>
      {running && (
        <p className="rounded bg-sky-50 p-2 text-xs text-sky-900">
          You can switch to other pages in the estimator while this runs; results are saved when they arrive. Don't close this browser tab.
        </p>
      )}
      {phase === "pages" && (
        <p className="text-xs text-slate-500">
          Reading sheets… {Object.values(status).filter((s) => s.state === "done" || s.state === "error").length} / {Object.keys(status).length} done. Each sheet
          takes about 30–90 seconds.
        </p>
      )}
      {phase === "consolidating" && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 size={14} className="animate-spin" /> Combining sheets and matching to your price list…
        </p>
      )}
      {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      {Object.entries(status).some(([, s]) => s.state === "error" && s.error !== "Cancelled") && (
        <ul className="space-y-1 rounded bg-red-50 p-2 text-xs text-red-700">
          {Object.entries(status)
            .filter(([, s]) => s.state === "error")
            .map(([n, s]) => (
              <li key={n}>
                Page {n}: {s.error}
              </li>
            ))}
        </ul>
      )}

      {project.ai && <AiResults key={project.ai.at} project={project} update={update} />}
    </div>
  )
}

function AiResults({ project, update }: { project: Project; update: UpdateProject }) {
  const [prices] = usePriceList()
  const ai = project.ai!
  const c = ai.consolidation
  const [checked, setChecked] = useState<Set<number>>(() => new Set(c?.lines.map((_, i) => i) ?? []))
  const [replace, setReplace] = useState(true)
  const [added, setAdded] = useState<number | null>(null)

  function addToEstimate() {
    if (!c) return
    const newLines = c.lines.filter((_, i) => checked.has(i)).map((l) => aiLineToEstimate(l, prices))
    update((p) => ({
      ...p,
      lines: [...(replace ? p.lines.filter((l) => l.source !== "ai") : p.lines), ...newLines],
      settings: {
        ...p.settings,
        conditionedSf: p.settings.conditionedSf || c.summary.conditioned_sf || 0,
      },
    }))
    setAdded(newLines.length)
  }

  const s = c?.summary
  return (
    <div className="space-y-3 border-t border-slate-200 pt-3">
      <p className="text-xs text-slate-500">Last run {new Date(ai.at).toLocaleString()}</p>
      {s && (
        <div className="flex flex-wrap gap-1">
          {s.conditioned_sf != null && <Badge>{fmtNum(s.conditioned_sf)} SF living</Badge>}
          {s.garage_sf != null && <Badge>{fmtNum(s.garage_sf)} SF garage</Badge>}
          {s.roof_area_sf != null && <Badge>{fmtNum(s.roof_area_sf)} SF roof</Badge>}
          {s.roof_pitch && <Badge>{s.roof_pitch} pitch</Badge>}
          {s.stories != null && <Badge>{s.stories} story</Badge>}
          {s.bedrooms != null && <Badge>{s.bedrooms} bed</Badge>}
          {s.bathrooms != null && <Badge>{s.bathrooms} bath</Badge>}
        </div>
      )}

      {c && c.questions.length > 0 && (
        <div className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-900">
          <p className="mb-1 flex items-center gap-1 font-semibold">
            <AlertTriangle size={13} /> Verify / ask about
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            {c.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {c ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.lines.length} proposed lines</span>
            <button
              className="text-xs text-brand-700 hover:underline"
              onClick={() => setChecked(checked.size === c.lines.length ? new Set() : new Set(c.lines.map((_, i) => i)))}
            >
              {checked.size === c.lines.length ? "Uncheck all" : "Check all"}
            </button>
          </div>
          <ul className="divide-y divide-slate-100 rounded border border-slate-200">
            {c.lines.map((l, i) => {
              const matched = l.price_item_code && prices.some((p) => p.code.toLowerCase() === l.price_item_code!.toLowerCase())
              return (
                <li key={i} className="px-2 py-1.5 text-xs">
                  <label className="flex cursor-pointer gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked.has(i)}
                      onChange={() =>
                        setChecked((s) => {
                          const n = new Set(s)
                          if (n.has(i)) n.delete(i)
                          else n.add(i)
                          return n
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-slate-800">{l.description}</span>
                        <span className="whitespace-nowrap font-semibold tabular-nums">
                          {fmtNum(l.quantity)} {l.unit}
                        </span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1">
                        <Badge>{l.category}</Badge>
                        {matched ? <Badge tone="green">{l.price_item_code}</Badge> : <Badge tone="amber">no price match</Badge>}
                        <Badge tone={l.confidence === "high" ? "green" : l.confidence === "medium" ? "blue" : "red"}>{l.confidence}</Badge>
                      </span>
                      <span className="mt-0.5 block text-slate-500">
                        {l.basis}
                        {l.source_sheets.length > 0 && ` [${l.source_sheets.join(", ")}]`}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace lines from earlier AI runs
          </label>
          <Button variant="primary" className="w-full" onClick={addToEstimate} disabled={!checked.size}>
            Add {checked.size} lines to estimate
          </Button>
          {added !== null && <p className="text-xs text-emerald-700">Added {added} lines. Review them on the Estimate tab.</p>}
        </>
      ) : (
        <p className="text-xs text-slate-500">The sheets were read but not combined yet. Click Re-combine.</p>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer font-medium text-slate-700">Per-sheet findings ({ai.pages.length} sheets)</summary>
        <div className="mt-2 space-y-3">
          {ai.pages.map((p) => (
            <div key={p.page}>
              <p className="font-semibold text-slate-800">
                p.{p.page} {p.sheet_number} {p.sheet_title} <span className="font-normal text-slate-500">· {p.discipline}</span>
              </p>
              <ul className="mt-1 space-y-0.5 text-slate-600">
                {p.findings.map((f, i) => (
                  <li key={i}>
                    {f.item}: <strong>{f.quantity == null ? "?" : `${fmtNum(f.quantity)} ${f.unit}`}</strong> <span className="text-slate-400">({f.basis})</span>
                  </li>
                ))}
                {p.findings.length === 0 && <li className="text-slate-400">No quantities on this sheet.</li>}
              </ul>
              {p.notes && <p className="mt-1 italic text-slate-500">{p.notes}</p>}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
