import clsx from "clsx"
import { Plus, X } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { db } from "../lib/db"
import { uid } from "../lib/format"
import type { PDFDocumentProxy } from "../lib/pdf"
import { href, navigate } from "../lib/route"
import { pdfKeyOf } from "../lib/store"
import type { Project } from "../lib/types"
import type { UpdateProject } from "../views/ProjectView"
import { useThumbnails } from "./Thumbnails"
import { Button, Input, Modal } from "./ui"

const SHARED = "__shared"
const SKIP = "__skip"
const HOUSE_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#9333ea", "#0891b2", "#db2777", "#ca8a04", "#475569"]

/**
 * Splits one plan set that contains several houses into one estimate per house.
 * Sheets marked "shared" (cover, general notes, details) go into every house.
 */
export function SplitHousesModal({
  project,
  update,
  doc,
  onClose,
}: {
  project: Project
  update: UpdateProject
  doc: PDFDocumentProxy
  onClose: () => void
}) {
  const allPages = useMemo(() => Array.from({ length: doc.numPages }, (_, i) => i + 1), [doc])
  const thumbs = useThumbnails(doc, allPages)
  const houseIds = useRef(0)
  const [houses, setHouses] = useState(() => [
    { id: houseIds.current++, name: "Plan A" },
    { id: houseIds.current++, name: "Plan B" },
  ])
  const [assign, setAssign] = useState<Record<number, string>>({})
  const [brush, setBrush] = useState<string>("0")
  const [lastClicked, setLastClicked] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const sheetLabel = (n: number) => {
    const s = project.ai?.pages.find((p) => p.page === n)
    return s ? [s.sheet_number, s.sheet_title].filter(Boolean).join(" ") : ""
  }

  const valueOf = (n: number) => assign[n] ?? SKIP
  const paint = (n: number, shift: boolean) => {
    const range = shift && lastClicked !== null ? allPages.filter((p) => p >= Math.min(lastClicked, n) && p <= Math.max(lastClicked, n)) : [n]
    setAssign((a) => {
      const next = { ...a }
      for (const p of range) next[p] = brush
      return next
    })
    setLastClicked(n)
  }

  const brushes = [
    ...houses.map((h, i) => ({ value: String(h.id), label: h.name || `House ${i + 1}`, color: HOUSE_COLORS[i % HOUSE_COLORS.length] })),
    { value: SHARED, label: "Shared by all", color: "#64748b" },
    { value: SKIP, label: "Not used", color: "#cbd5e1" },
  ]
  const brushOf = (v: string) => brushes.find((b) => b.value === v) ?? brushes[brushes.length - 1]

  const shared = allPages.filter((n) => valueOf(n) === SHARED)
  const plan = houses
    .map((h) => ({ ...h, pages: [...allPages.filter((n) => valueOf(n) === String(h.id)), ...shared].sort((a, b) => a - b) }))
    .filter((h) => h.pages.some((n) => valueOf(n) === String(h.id)))

  async function create() {
    if (!plan.length) return
    setBusy(true)
    const base = project.name
    const key = pdfKeyOf(project)
    const now = new Date().toISOString()
    const scoped = (p: Project, pages: number[], name: string): Project => {
      const keepAi = p.ai ? { ...p.ai, pages: p.ai.pages.filter((x) => pages.includes(x.page)), consolidation: null } : null
      return {
        ...p,
        name: `${base} – ${name}`,
        pdfKey: key,
        pages,
        measurements: p.measurements.filter((m) => pages.includes(m.page)),
        ai: keepAi && keepAi.pages.length ? keepAi : null,
        updatedAt: now,
      }
    }
    // This estimate becomes the first house and keeps its lines; the others start fresh.
    const [first, ...rest] = plan
    for (const [i, h] of rest.entries()) {
      const copy = scoped(structuredClone(project), h.pages, h.name)
      await db.putProject({
        ...copy,
        id: uid(),
        number: `${project.number}-${String.fromCharCode(66 + i)}`,
        lines: [],
        createdAt: now,
      })
    }
    update((p) => {
      const kept = scoped(p, first.pages, first.name)
      const measurementIds = new Set(kept.measurements.map((m) => m.id))
      return { ...kept, lines: kept.lines.map((l) => ({ ...l, measurementIds: l.measurementIds.filter((id) => measurementIds.has(id)) })) }
    })
    // Let the debounced save of this project land before showing the list.
    setTimeout(() => navigate(href.projects()), 600)
  }

  return (
    <Modal title="Split plan set into houses" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Name each house, pick it below, then click its sheets (Shift-click selects a range). Mark sheets every house uses (cover, general notes,
          details, schedules) as <strong>Shared by all</strong>. You'll get one estimate per house, each showing only its own sheets. They all
          share this PDF, so it isn't stored twice.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {houses.map((h, i) => (
            <div key={h.id} className="flex items-center gap-1 rounded-md border border-slate-200 py-0.5 pl-2 pr-1">
              <span className="h-3 w-3 rounded-sm" style={{ background: HOUSE_COLORS[i % HOUSE_COLORS.length] }} />
              <Input
                className="h-7 w-32 border-0 px-1 focus:ring-0"
                value={h.name}
                onChange={(e) => setHouses((hs) => hs.map((x) => (x.id === h.id ? { ...x, name: e.target.value } : x)))}
                aria-label={`House ${i + 1} name`}
              />
              {houses.length > 1 && (
                <button
                  className="rounded p-0.5 text-slate-400 hover:text-red-600"
                  aria-label={`Remove ${h.name}`}
                  onClick={() => {
                    setHouses((hs) => hs.filter((x) => x.id !== h.id))
                    setAssign((a) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== String(h.id))))
                    if (brush === String(h.id)) setBrush(SHARED)
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const id = houseIds.current++
              setHouses((hs) => [...hs, { id, name: `Plan ${String.fromCharCode(65 + hs.length)}` }])
              setBrush(String(id))
            }}
          >
            <Plus size={14} /> Add house
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-500">Assign to:</span>
          {brushes.map((b) => (
            <button
              key={b.value}
              onClick={() => setBrush(b.value)}
              className={clsx(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                brush === b.value ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50",
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
              {b.label}
            </button>
          ))}
        </div>

        <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 sm:grid-cols-4 md:grid-cols-6">
          {allPages.map((n) => {
            const b = brushOf(valueOf(n))
            return (
              <button
                key={n}
                onClick={(e) => paint(n, e.shiftKey)}
                className="rounded bg-white p-1 text-left shadow-sm"
                style={{ outline: `3px solid ${b.color}`, outlineOffset: -3 }}
                title={sheetLabel(n)}
              >
                {thumbs[n] ? <img src={thumbs[n]} alt={`Page ${n}`} className="mx-auto max-h-24 w-auto" /> : <div className="h-20 animate-pulse rounded bg-slate-100" />}
                <div className="mt-1 truncate text-[11px] text-slate-700">
                  <span className="font-medium">p. {n}</span> <span className="text-slate-500">{sheetLabel(n) || b.label}</span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="rounded-md bg-slate-50 p-3 text-sm">
          {plan.length === 0 ? (
            <p className="text-slate-500">Assign at least one sheet to a house.</p>
          ) : (
            <ul className="space-y-0.5">
              {plan.map((h, i) => (
                <li key={h.id}>
                  <strong>
                    {project.name} – {h.name}
                  </strong>
                  : {h.pages.length} sheets{i === 0 ? " (this estimate, keeps its current lines)" : " (new estimate)"}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!plan.length || busy} onClick={() => void create()}>
            Create {plan.length} estimate{plan.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
