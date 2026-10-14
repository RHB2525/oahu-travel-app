import clsx from "clsx"
import {
  ChevronLeft,
  ChevronRight,
  FileUp,
  Hand,
  Hash,
  Layers,
  Link2,
  Minus,
  Pentagon,
  Plus,
  Ruler,
  Scaling,
  Sparkles,
  SquareDashed,
  Trash2,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AiPanel } from "../components/AiPanel"
import { LinkMeasurementModal } from "../components/LinkMeasurementModal"
import { PlanViewer, type Tool } from "../components/PlanViewer"
import { SplitHousesModal } from "../components/SplitHousesModal"
import { Thumbnails } from "../components/Thumbnails"
import { Badge, Button, EmptyState, Field, Input, Modal, NumberInput, Select } from "../components/ui"
import { measurementBaseUnit, measurementValue } from "../lib/calc"
import { fmtNum, parseFeet, uid } from "../lib/format"
import { COMMON_SCALES, type PDFDocumentProxy } from "../lib/pdf"
import { projectPages } from "../lib/store"
import type { Measurement, MeasureType, PageScale, Project } from "../lib/types"
import type { UpdateProject } from "./ProjectView"

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#ca8a04", "#db2777"]

interface Props {
  project: Project
  update: UpdateProject
  doc: PDFDocumentProxy | null
  pdfLoading: boolean
  pdfError: string | null
  onUpload: (file: File) => Promise<void>
}

export function PlansTab({ project, update, doc, pdfLoading, pdfError, onUpload }: Props) {
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(0.5)
  const [tool, setTool] = useState<Tool>("pan")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panel, setPanel] = useState<"takeoff" | "ai">("takeoff")
  const [scaleOpen, setScaleOpen] = useState(false)
  const [calibrationUnits, setCalibrationUnits] = useState<number | null>(null)
  const [linking, setLinking] = useState<Measurement | null>(null)
  const [splitting, setSplitting] = useState(false)
  const viewerBox = useRef<HTMLDivElement>(null)
  const visiblePages = useMemo(() => (doc ? projectPages(project, doc.numPages) : []), [doc, project])
  const pageIndex = visiblePages.indexOf(pageNumber)

  // Keep the viewer on a sheet that belongs to this estimate.
  useEffect(() => {
    if (visiblePages.length && !visiblePages.includes(pageNumber)) setPageNumber(visiblePages[0])
  }, [visiblePages, pageNumber])

  const scale = project.scales[pageNumber]

  const fitWidth = useCallback(async () => {
    if (!doc || !viewerBox.current) return
    const vp = (await doc.getPage(pageNumber)).getViewport({ scale: 1 })
    setZoom(Math.max(0.1, (viewerBox.current.clientWidth - 40) / vp.width))
  }, [doc, pageNumber])

  const addMeasurement = useCallback(
    (type: MeasureType, points: [number, number][]) => {
      const n = project.measurements.filter((m) => m.type === type).length + 1
      const name = type === "length" ? "Length" : type === "area" ? "Area" : "Count"
      const m: Measurement = {
        id: uid(),
        page: pageNumber,
        type,
        label: `${name} ${n}`,
        color: COLORS[project.measurements.length % COLORS.length],
        points,
        multiplier: 1,
      }
      update((p) => ({ ...p, measurements: [...p.measurements, m] }))
      setSelectedId(m.id)
      setPanel("takeoff")
    },
    [pageNumber, project.measurements, update],
  )

  const setScale = (s: PageScale, allPages: boolean) => {
    update((p) => {
      const scales = { ...p.scales }
      if (allPages) for (let i = 1; i <= (doc?.numPages ?? p.pageCount); i++) scales[i] = s
      else scales[pageNumber] = s
      return { ...p, scales }
    })
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        {pdfLoading ? (
          <p className="text-center text-sm text-slate-500">Opening plan set…</p>
        ) : (
          <UploadZone onUpload={onUpload} error={pdfError} />
        )}
      </div>
    )
  }

  const pageMeasurements = project.measurements.filter((m) => m.page === pageNumber)
  const sheetBadges: Record<number, string> = {}
  project.ai?.pages.forEach((p) => p.sheet_number && (sheetBadges[p.page] = p.sheet_number))
  const linkedLines = (id: string) => project.lines.filter((l) => l.measurementIds.includes(id))

  const toolButtons: { id: Tool; label: string; icon: typeof Hand }[] = [
    { id: "pan", label: "Pan / select", icon: Hand },
    { id: "length", label: "Length (LF)", icon: Ruler },
    { id: "area", label: "Area (SF)", icon: Pentagon },
    { id: "count", label: "Count (EA)", icon: Hash },
  ]

  return (
    <div className="flex h-full min-h-[600px]">
      <aside className="hidden w-36 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 lg:block">
        <Thumbnails doc={doc} pages={visiblePages} current={pageNumber} onSelect={setPageNumber} badges={sheetBadges} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" disabled={pageIndex <= 0} onClick={() => setPageNumber(visiblePages[pageIndex - 1])} aria-label="Previous page">
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm tabular-nums">
              {pageIndex + 1} / {visiblePages.length}
              {visiblePages.length !== doc.numPages && <span className="ml-1 text-xs text-slate-500">(p. {pageNumber})</span>}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={pageIndex >= visiblePages.length - 1}
              onClick={() => setPageNumber(visiblePages[pageIndex + 1])}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0.1, z / 1.25))} aria-label="Zoom out">
              <Minus size={16} />
            </Button>
            <span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(6, z * 1.25))} aria-label="Zoom in">
              <Plus size={16} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void fitWidth()}>
              Fit
            </Button>
          </div>
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            {toolButtons.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={tool === t.id ? "primary" : "ghost"}
                onClick={() => setTool(t.id)}
                title={t.label}
              >
                <t.icon size={16} />
                <span className="hidden xl:inline">{t.label}</span>
              </Button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {scale ? (
              <Badge tone="green">Scale: {scale.label}</Badge>
            ) : (
              <Badge tone="amber">No scale on this page</Badge>
            )}
            <Button size="sm" variant={tool === "calibrate" ? "primary" : "secondary"} onClick={() => setScaleOpen(true)}>
              <Scaling size={16} /> Set scale
            </Button>
          </div>
        </div>
        <div ref={viewerBox} className="min-h-0 flex-1">
          <PlanViewer
            doc={doc}
            pageNumber={pageNumber}
            zoom={zoom}
            onZoom={setZoom}
            tool={tool}
            scale={scale}
            measurements={pageMeasurements}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onFinish={addMeasurement}
            onCalibrate={(units) => {
              setCalibrationUnits(units)
              setTool("pan")
            }}
          />
        </div>
      </div>

      <aside className="flex w-[380px] shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="flex border-b border-slate-200">
          {[
            { id: "takeoff" as const, label: `Measurements (${project.measurements.length})`, icon: SquareDashed },
            { id: "ai" as const, label: "AI Takeoff", icon: Sparkles },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setPanel(t.id)}
              className={clsx(
                "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm font-medium",
                panel === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:text-slate-900",
              )}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {panel === "takeoff" ? (
            <MeasurementList
              project={project}
              update={update}
              pageNumber={pageNumber}
              selectedId={selectedId}
              onSelect={(m) => {
                setSelectedId(m.id)
                setPageNumber(m.page)
              }}
              onLink={setLinking}
              linkedLines={linkedLines}
            />
          ) : (
            <AiPanel project={project} update={update} doc={doc} pages={visiblePages} currentPage={pageNumber} />
          )}
        </div>
        <div className="space-y-1.5 border-t border-slate-200 p-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Layers size={13} />
            {visiblePages.length === doc.numPages ? (
              <span>All {doc.numPages} sheets</span>
            ) : (
              <span>
                {visiblePages.length} of {doc.numPages} sheets in this estimate
                <button className="ml-1.5 text-brand-700 underline" onClick={() => update((p) => ({ ...p, pages: undefined }))}>
                  Show all
                </button>
              </span>
            )}
            <button className="ml-auto font-medium text-brand-700 underline" onClick={() => setSplitting(true)}>
              Several houses in this PDF? Split them
            </button>
          </div>
          <div>
          Plan set: <span className="font-medium text-slate-700">{project.pdfName}</span>
          <label className="ml-2 cursor-pointer text-brand-700 underline">
            Replace
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f && confirm("Replace the plan set? Measurements stay but may no longer line up with the new sheets.")) void onUpload(f)
                e.target.value = ""
              }}
            />
          </label>
          </div>
        </div>
      </aside>

      {scaleOpen && (
        <ScaleModal
          current={scale}
          onClose={() => setScaleOpen(false)}
          onApply={(s, all) => {
            setScale(s, all)
            setScaleOpen(false)
          }}
          onCalibrate={() => {
            setScaleOpen(false)
            setTool("calibrate")
          }}
        />
      )}
      {calibrationUnits !== null && (
        <CalibrateModal
          units={calibrationUnits}
          onClose={() => setCalibrationUnits(null)}
          onApply={(s, all) => {
            setScale(s, all)
            setCalibrationUnits(null)
          }}
        />
      )}
      {splitting && <SplitHousesModal project={project} update={update} doc={doc} onClose={() => setSplitting(false)} />}
      {linking && <LinkMeasurementModal project={project} update={update} measurement={linking} onClose={() => setLinking(null)} />}
    </div>
  )
}

function UploadZone({ onUpload, error }: { onUpload: (f: File) => Promise<void>; error: string | null }) {
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const handle = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    await onUpload(f)
    setBusy(false)
  }
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        void handle(e.dataTransfer.files[0])
      }}
      className={clsx(
        "block cursor-pointer rounded-xl border-2 border-dashed bg-white p-10",
        dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-slate-400",
      )}
    >
      <EmptyState icon={<FileUp size={40} />} title={busy ? "Opening…" : "Upload the plan set"}>
        Drop the PDF here or click to choose it. Include all sheets: architectural, roof, electrical, plumbing, cabinet elevations and schedules. Large
        sets are fine; the file stays in this browser.
      </EmptyState>
      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
      <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void handle(e.target.files?.[0])} />
    </label>
  )
}

function MeasurementList({
  project,
  update,
  pageNumber,
  selectedId,
  onSelect,
  onLink,
  linkedLines,
}: {
  project: Project
  update: UpdateProject
  pageNumber: number
  selectedId: string | null
  onSelect: (m: Measurement) => void
  onLink: (m: Measurement) => void
  linkedLines: (id: string) => Project["lines"]
}) {
  const [onlyPage, setOnlyPage] = useState(false)
  const list = project.measurements.filter((m) => !onlyPage || m.page === pageNumber)
  const patch = (id: string, change: Partial<Measurement>) =>
    update((p) => ({ ...p, measurements: p.measurements.map((m) => (m.id === id ? { ...m, ...change } : m)) }))
  const remove = (id: string) =>
    update((p) => ({
      ...p,
      measurements: p.measurements.filter((m) => m.id !== id),
      lines: p.lines.map((l) => (l.measurementIds.includes(id) ? { ...l, measurementIds: l.measurementIds.filter((x) => x !== id) } : l)),
    }))

  if (project.measurements.length === 0) {
    return (
      <div className="space-y-3 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Manual takeoff</p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            <strong>Set scale</strong> for the sheet: pick the printed scale, or calibrate by clicking both ends of a known dimension.
          </li>
          <li>
            Use <strong>Length</strong> for walls, eaves, ridges, runs; <strong>Area</strong> for floors, roof planes, slabs;{" "}
            <strong>Count</strong> for outlets, fixtures, doors.
          </li>
          <li>
            <strong>Link</strong> each measurement to an estimate line. The line's quantity then updates whenever the measurement changes.
          </li>
        </ol>
        <p className="text-xs text-slate-500">Tip: Ctrl/⌘ + scroll to zoom. Use the multiplier for wall height (LF → SF) or both sides of a wall.</p>
      </div>
    )
  }

  return (
    <div>
      <label className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
        <input type="checkbox" checked={onlyPage} onChange={(e) => setOnlyPage(e.target.checked)} /> Only this page
      </label>
      <ul className="divide-y divide-slate-100">
        {list.map((m) => {
          const v = measurementValue(m, project.scales[m.page])
          const lines = linkedLines(m.id)
          return (
            <li
              key={m.id}
              className={clsx("space-y-2 px-3 py-2.5", m.id === selectedId && "bg-brand-50")}
              onClick={() => onSelect(m)}
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: m.color }} />
                <Input className="h-8" value={m.label} onChange={(e) => patch(m.id, { label: e.target.value })} onClick={(e) => e.stopPropagation()} />
                <button
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(m.id)
                  }}
                  aria-label="Delete measurement"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-xs text-slate-500">p.{m.page}</span>
                <span className="font-semibold tabular-nums">{v === null ? <Badge tone="amber">needs scale</Badge> : `${fmtNum(v)} ${measurementBaseUnit(m.type)}`}</span>
                <span className="ml-auto text-xs text-slate-500">×</span>
                <NumberInput
                  className="h-7 w-16"
                  value={m.multiplier}
                  onCommit={(n) => patch(m.id, { multiplier: n || 1 })}
                  onClick={(e) => e.stopPropagation()}
                  title="Multiplier (e.g. wall height, both sides, number of floors)"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {lines.map((l) => (
                  <Badge key={l.id} tone="blue">
                    → {l.description.slice(0, 40)}
                  </Badge>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    onLink(m)
                  }}
                >
                  <Link2 size={14} /> {lines.length ? "Link another" : "Link to estimate"}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ScaleModal({
  current,
  onClose,
  onApply,
  onCalibrate,
}: {
  current: PageScale | undefined
  onClose: () => void
  onApply: (s: PageScale, allPages: boolean) => void
  onCalibrate: () => void
}) {
  const [preset, setPreset] = useState(COMMON_SCALES[4].label)
  const [all, setAll] = useState(false)
  return (
    <Modal title="Set drawing scale" onClose={onClose}>
      <div className="space-y-4">
        {current && <p className="text-sm text-slate-600">Current: {current.label}</p>}
        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          <p className="text-sm font-medium">Calibrate from a known dimension (most reliable)</p>
          <p className="text-xs text-slate-500">Click both ends of a dimension string or grid line, then type its real length.</p>
          <Button variant="primary" onClick={onCalibrate}>
            <Ruler size={16} /> Calibrate on sheet
          </Button>
        </div>
        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          <p className="text-sm font-medium">Use the printed scale</p>
          <p className="text-xs text-slate-500">Only accurate if the PDF is at full paper size (typical for CAD exports, not for reduced scans).</p>
          <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
            {COMMON_SCALES.map((s) => (
              <option key={s.label}>{s.label}</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Apply to all pages
          </label>
          <Button
            onClick={() => {
              const s = COMMON_SCALES.find((x) => x.label === preset)!
              onApply({ feetPerUnit: s.feetPerPaperInch / 72, label: s.label }, all)
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CalibrateModal({ units, onClose, onApply }: { units: number; onClose: () => void; onApply: (s: PageScale, all: boolean) => void }) {
  const [value, setValue] = useState("")
  const [all, setAll] = useState(false)
  const feet = parseFeet(value)
  return (
    <Modal title="Calibrate scale" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (feet && feet > 0) onApply({ feetPerUnit: feet / units, label: `calibrated (${value.trim()})` }, all)
        }}
      >
        <Field label="Real length of the line you drew" hint={`Examples: 24' 6", 24-6, 24.5. Line is ${fmtNum(units / 72)} in on paper.`}>
          <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={`e.g. 24' 6"`} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Apply to all pages
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!feet || feet <= 0}>
            Set scale
          </Button>
        </div>
      </form>
    </Modal>
  )
}
