import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { distanceUnits, measurementBaseUnit, measurementValue } from "../lib/calc"
import { fmtNum } from "../lib/format"
import type { PDFDocumentProxy, PDFPageProxy } from "../lib/pdf"
import type { Measurement, MeasureType, PageScale } from "../lib/types"

export type Tool = "pan" | "calibrate" | MeasureType

interface Props {
  doc: PDFDocumentProxy
  pageNumber: number
  zoom: number
  onZoom: (z: number) => void
  tool: Tool
  scale: PageScale | undefined
  measurements: Measurement[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onFinish: (type: MeasureType, points: [number, number][]) => void
  onCalibrate: (units: number) => void
}

type Pt = [number, number]

const MAX_CANVAS_PIXELS = 36_000_000

export function PlanViewer(props: Props) {
  const { doc, pageNumber, zoom, onZoom, tool, scale, measurements, selectedId, onSelect, onFinish, onCalibrate } = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [page, setPage] = useState<PDFPageProxy | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [draft, setDraft] = useState<Pt[]>([])
  const [cursor, setCursor] = useState<Pt | null>(null)
  const [rendering, setRendering] = useState(false)
  const panStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    void doc.getPage(pageNumber).then((p) => {
      if (cancelled) return
      const vp = p.getViewport({ scale: 1 })
      setPage(p)
      setSize({ w: vp.width, h: vp.height })
    })
    setDraft([])
    return () => {
      cancelled = true
    }
  }, [doc, pageNumber])

  useEffect(() => setDraft([]), [tool])

  // Render the page; resolution follows zoom but is capped to keep memory sane on large sheets.
  useEffect(() => {
    if (!page || !size || !canvasRef.current) return
    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    const renderScale = Math.min(zoom * dpr, Math.sqrt(MAX_CANVAS_PIXELS / (size.w * size.h)))
    const viewport = page.getViewport({ scale: renderScale })
    const offscreen = document.createElement("canvas")
    offscreen.width = Math.floor(viewport.width)
    offscreen.height = Math.floor(viewport.height)
    setRendering(true)
    const task = page.render({ canvasContext: offscreen.getContext("2d")!, viewport })
    task.promise
      .then(() => {
        canvas.width = offscreen.width
        canvas.height = offscreen.height
        canvas.getContext("2d")!.drawImage(offscreen, 0, 0)
        setRendering(false)
      })
      .catch(() => {
        /* cancelled by a newer render */
      })
      .finally(() => {
        offscreen.width = offscreen.height = 0
      })
    return () => task.cancel()
  }, [page, size, zoom])

  const toPdf = useCallback(
    (e: { clientX: number; clientY: number }): Pt => {
      const rect = svgRef.current!.getBoundingClientRect()
      return [(e.clientX - rect.left) / zoom, (e.clientY - rect.top) / zoom]
    },
    [zoom],
  )

  const finish = useCallback(() => {
    if (tool === "length" && draft.length >= 2) onFinish("length", draft)
    else if (tool === "area" && draft.length >= 3) onFinish("area", draft)
    else if (tool === "count" && draft.length >= 1) onFinish("count", draft)
    setDraft([])
  }, [tool, draft, onFinish])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return
      if (e.key === "Escape") setDraft([])
      else if (e.key === "Enter") finish()
      else if (e.key === "Backspace" && draft.length) {
        e.preventDefault()
        setDraft((d) => d.slice(0, -1))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [finish, draft.length])

  // Ctrl/Cmd + wheel zooms around the pointer.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const next = Math.min(6, Math.max(0.1, zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
      const rect = el.getBoundingClientRect()
      const px = (el.scrollLeft + e.clientX - rect.left) / zoom
      const py = (el.scrollTop + e.clientY - rect.top) / zoom
      onZoom(next)
      requestAnimationFrame(() => {
        el.scrollLeft = px * next - (e.clientX - rect.left)
        el.scrollTop = py * next - (e.clientY - rect.top)
      })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [zoom, onZoom])

  function onClick(e: ReactMouseEvent) {
    if (tool === "pan") return
    const p = toPdf(e)
    if (tool === "calibrate") {
      if (draft.length === 0) setDraft([p])
      else {
        const units = distanceUnits(draft[0], p)
        setDraft([])
        if (units > 0) onCalibrate(units)
      }
      return
    }
    if (tool === "area" && draft.length >= 3 && distanceUnits(draft[0], p) * zoom < 10) {
      onFinish("area", draft)
      setDraft([])
      return
    }
    setDraft((d) => [...d, p])
  }

  function onDoubleClick(e: ReactMouseEvent) {
    if (tool === "length" || tool === "area") {
      e.preventDefault()
      // The double-click's two clicks already added the same point twice; drop the duplicate.
      const pts = draft.slice(0, -1)
      if (tool === "length" && pts.length >= 2) onFinish("length", pts)
      if (tool === "area" && pts.length >= 3) onFinish("area", pts)
      setDraft([])
    }
  }

  function onMouseDown(e: ReactMouseEvent) {
    if (tool !== "pan" || e.button !== 0) return
    const el = scrollRef.current!
    panStart.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
  }

  function onMouseMove(e: ReactMouseEvent) {
    if (panStart.current) {
      const el = scrollRef.current!
      el.scrollLeft = panStart.current.left - (e.clientX - panStart.current.x)
      el.scrollTop = panStart.current.top - (e.clientY - panStart.current.y)
      return
    }
    if (tool !== "pan" && svgRef.current) setCursor(toPdf(e))
  }

  const stroke = 2 / zoom
  const fontSize = 12 / zoom

  const draftLabel = useMemo(() => {
    if (!cursor || draft.length === 0) return null
    const pts = tool === "count" ? draft : [...draft, cursor]
    if (tool === "calibrate") return `${fmtNum(distanceUnits(draft[0], cursor) / 72)} in on paper`
    const fake: Measurement = { id: "", page: pageNumber, type: tool as MeasureType, label: "", color: "", points: pts, multiplier: 1 }
    const v = measurementValue(fake, scale)
    if (v === null) return "Set the page scale to see dimensions"
    return `${fmtNum(v)} ${measurementBaseUnit(fake.type)}`
  }, [cursor, draft, tool, scale, pageNumber])

  if (!size) return <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading page…</div>

  return (
    <div className="relative h-full">
      <div
        ref={scrollRef}
        className="h-full overflow-auto bg-slate-200"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={() => (panStart.current = null)}
        onMouseLeave={() => {
          panStart.current = null
          setCursor(null)
        }}
        style={{ cursor: tool === "pan" ? (panStart.current ? "grabbing" : "grab") : "crosshair" }}
      >
        <div className="relative m-4 inline-block bg-white shadow" style={{ width: size.w * zoom, height: size.h * zoom }}>
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          <svg
            ref={svgRef}
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${size.w} ${size.h}`}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
          >
            {measurements.map((m) => (
              <MeasurementShape
                key={m.id}
                m={m}
                scale={scale}
                selected={m.id === selectedId}
                stroke={stroke}
                fontSize={fontSize}
                onSelect={tool === "pan" ? () => onSelect(m.id) : undefined}
              />
            ))}
            {draft.length > 0 && (
              <g pointerEvents="none">
                {tool === "count" ? (
                  draft.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={6 / zoom} fill="#dc2626" fillOpacity={0.6} />)
                ) : (
                  <>
                    <polyline
                      points={[...draft, ...(cursor ? [cursor] : [])].map((p) => p.join(",")).join(" ")}
                      fill={tool === "area" ? "#16a34a" : "none"}
                      fillOpacity={0.15}
                      stroke={tool === "calibrate" ? "#9333ea" : tool === "area" ? "#16a34a" : "#2563eb"}
                      strokeWidth={stroke}
                      strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                    />
                    {draft.map((p, i) => (
                      <circle key={i} cx={p[0]} cy={p[1]} r={3 / zoom} fill="#0f172a" />
                    ))}
                  </>
                )}
              </g>
            )}
          </svg>
        </div>
      </div>
      {rendering && <div className="pointer-events-none absolute right-3 top-3 rounded bg-white/90 px-2 py-1 text-xs text-slate-600 shadow">Rendering…</div>}
      {tool !== "pan" && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-slate-900/85 px-3 py-1.5 text-xs text-white shadow">
          {draftLabel ? <strong className="mr-2">{draftLabel}</strong> : null}
          {toolHint(tool, draft.length)}
        </div>
      )}
    </div>
  )
}

function toolHint(tool: Tool, n: number) {
  switch (tool) {
    case "calibrate":
      return n === 0 ? "Click the start of a known dimension" : "Click the end of the dimension"
    case "length":
      return "Click points · double-click or Enter to finish · Backspace undo · Esc cancel"
    case "area":
      return "Click corners · click the first point, double-click or Enter to close · Esc cancel"
    case "count":
      return n ? `${n} counted · Enter to save · Backspace undo · Esc cancel` : "Click each symbol to count it"
    default:
      return ""
  }
}

function centroid(points: Pt[]): Pt {
  const x = points.reduce((s, p) => s + p[0], 0) / points.length
  const y = points.reduce((s, p) => s + p[1], 0) / points.length
  return [x, y]
}

function MeasurementShape({
  m,
  scale,
  selected,
  stroke,
  fontSize,
  onSelect,
}: {
  m: Measurement
  scale: PageScale | undefined
  selected: boolean
  stroke: number
  fontSize: number
  onSelect?: () => void
}) {
  const v = measurementValue(m, scale)
  const text = `${m.label}: ${v === null ? "no scale" : `${fmtNum(v)} ${measurementBaseUnit(m.type)}`}`
  const sw = selected ? stroke * 2 : stroke
  const anchor = m.type === "length" ? m.points[m.points.length - 1] : centroid(m.points)
  const common = {
    onClick: onSelect
      ? (e: ReactMouseEvent) => {
          e.stopPropagation()
          onSelect()
        }
      : undefined,
    style: { cursor: onSelect ? "pointer" : undefined },
    pointerEvents: onSelect ? ("visiblePainted" as const) : ("none" as const),
  }
  return (
    <g opacity={selected ? 1 : 0.85}>
      {m.type === "length" && <polyline {...common} points={m.points.map((p) => p.join(",")).join(" ")} fill="none" stroke={m.color} strokeWidth={sw * 1.5} />}
      {m.type === "area" && (
        <polygon {...common} points={m.points.map((p) => p.join(",")).join(" ")} fill={m.color} fillOpacity={selected ? 0.3 : 0.18} stroke={m.color} strokeWidth={sw} />
      )}
      {m.type === "count" &&
        m.points.map((p, i) => (
          <circle key={i} {...common} cx={p[0]} cy={p[1]} r={fontSize * 0.55} fill={m.color} fillOpacity={0.55} stroke={m.color} strokeWidth={sw / 2} />
        ))}
      {(selected || m.type !== "count") && (
        <text
          x={anchor[0]}
          y={anchor[1] - fontSize * 0.6}
          fontSize={fontSize}
          fontWeight={600}
          fill="#0f172a"
          stroke="white"
          strokeWidth={fontSize / 4}
          paintOrder="stroke"
          textAnchor="middle"
          pointerEvents="none"
        >
          {text}
        </text>
      )}
    </g>
  )
}
