import { useState } from "react"
import { convertQty, measurementBaseUnit } from "../lib/calc"
import { fmtMoney, uid } from "../lib/format"
import { useCategories, usePriceList } from "../lib/store"
import type { EstimateLine, Measurement, PriceItem, Project } from "../lib/types"
import type { UpdateProject } from "../views/ProjectView"
import { Badge, Button, Field, Input, Modal, Select } from "./ui"

export function LinkMeasurementModal({
  project,
  update,
  measurement,
  onClose,
}: {
  project: Project
  update: UpdateProject
  measurement: Measurement
  onClose: () => void
}) {
  const [prices] = usePriceList()
  const [categories] = useCategories()
  const [mode, setMode] = useState<"price" | "existing" | "custom">(prices.length ? "price" : "custom")
  const [q, setQ] = useState("")
  const [customDesc, setCustomDesc] = useState(measurement.label)
  const [customCat, setCustomCat] = useState(categories[0] ?? "General Conditions")
  const base = measurementBaseUnit(measurement.type)
  const compatible = (unit: EstimateLine["unit"]) => convertQty(1, base, unit) !== null
  const match = (text: string) => text.toLowerCase().includes(q.toLowerCase())

  const addLine = (line: EstimateLine) => {
    update((p) => ({ ...p, lines: [...p.lines, line] }))
    onClose()
  }

  const fromPrice = (item: PriceItem) =>
    addLine({
      id: uid(),
      category: item.category,
      description: item.description,
      priceItemId: item.id,
      unit: item.unit,
      qty: 0,
      measurementIds: [measurement.id],
      wastePct: item.wastePct,
      material: item.material,
      labor: item.labor,
      source: "takeoff",
      note: "",
    })

  const linkExisting = (line: EstimateLine) => {
    update((p) => ({
      ...p,
      lines: p.lines.map((l) =>
        l.id === line.id ? { ...l, source: "takeoff", measurementIds: [...new Set([...l.measurementIds, measurement.id])] } : l,
      ),
    }))
    onClose()
  }

  return (
    <Modal title={`Link "${measurement.label}" (${base}) to the estimate`} onClose={onClose} wide>
      <div className="mb-3 flex gap-1">
        {(
          [
            ["price", "New line from price list"],
            ["existing", "Add to existing line"],
            ["custom", "New custom line"],
          ] as const
        ).map(([id, label]) => (
          <Button key={id} size="sm" variant={mode === id ? "primary" : "ghost"} onClick={() => setMode(id)}>
            {label}
          </Button>
        ))}
      </div>

      {mode !== "custom" && <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" autoFocus />}

      {mode === "price" && (
        <div className="max-h-[50vh] overflow-y-auto rounded border border-slate-200">
          {prices.length === 0 && <p className="p-4 text-sm text-slate-500">Your price list is empty. Add items on the Price List page.</p>}
          {prices
            .filter((p) => match(`${p.code} ${p.description} ${p.category}`))
            .map((p) => (
              <button
                key={p.id}
                disabled={!compatible(p.unit)}
                onClick={() => fromPrice(p)}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40"
              >
                <span className="w-24 shrink-0 font-mono text-xs text-slate-500">{p.code}</span>
                <span className="flex-1">{p.description}</span>
                <Badge>{p.category}</Badge>
                <span className="w-28 text-right tabular-nums">
                  {fmtMoney(p.material + p.labor)}/{p.unit}
                </span>
              </button>
            ))}
        </div>
      )}

      {mode === "existing" && (
        <div className="max-h-[50vh] overflow-y-auto rounded border border-slate-200">
          {project.lines.length === 0 && <p className="p-4 text-sm text-slate-500">No estimate lines yet.</p>}
          {project.lines
            .filter((l) => match(`${l.description} ${l.category}`))
            .map((l) => (
              <button
                key={l.id}
                disabled={!compatible(l.unit) || l.measurementIds.includes(measurement.id)}
                onClick={() => linkExisting(l)}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40"
              >
                <span className="flex-1">{l.description}</span>
                <Badge>{l.category}</Badge>
                <span className="w-12 text-right">{l.unit}</span>
              </button>
            ))}
          {project.lines.some((l) => l.measurementIds.length === 0) && (
            <p className="p-2 text-xs text-slate-500">Linking replaces a line's typed-in quantity with the sum of its linked measurements.</p>
          )}
        </div>
      )}

      {mode === "custom" && (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            addLine({
              id: uid(),
              category: customCat,
              description: customDesc.trim() || measurement.label,
              priceItemId: null,
              unit: base,
              qty: 0,
              measurementIds: [measurement.id],
              wastePct: 0,
              material: 0,
              labor: 0,
              source: "takeoff",
              note: "",
            })
          }}
        >
          <Field label="Description">
            <Input value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} autoFocus />
          </Field>
          <Field label="Category">
            <Select value={customCat} onChange={(e) => setCustomCat(e.target.value)}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" variant="primary">
              Add line ({base})
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
