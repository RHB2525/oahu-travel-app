import clsx from "clsx"
import { AlertTriangle, FileSpreadsheet, Plus, RefreshCw, Ruler, Sparkles, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge, Button, Card, Field, Input, Modal, NumberInput, Select } from "../components/ui"
import { lineTotals, projectTotals } from "../lib/calc"
import { exportEstimateXlsx } from "../lib/exportExcel"
import { downloadBlob, fmtMoney, fmtNum, safeFilename, uid } from "../lib/format"
import { toCsv } from "../lib/priceImport"
import { href } from "../lib/route"
import { useCategories, usePriceList } from "../lib/store"
import { UNITS, type EstimateLine, type PriceItem, type Project, type Unit } from "../lib/types"
import type { UpdateProject } from "./ProjectView"

export function EstimateTab({ project, update }: { project: Project; update: UpdateProject }) {
  const [categories] = useCategories()
  const [prices] = usePriceList()
  const [adding, setAdding] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const totals = projectTotals(project, categories)

  const patchLine = (id: string, change: Partial<EstimateLine>) =>
    update((p) => ({ ...p, lines: p.lines.map((l) => (l.id === id ? { ...l, ...change } : l)) }))
  const removeLine = (id: string) => update((p) => ({ ...p, lines: p.lines.filter((l) => l.id !== id) }))
  const patchSettings = (change: Partial<Project["settings"]>) => update((p) => ({ ...p, settings: { ...p.settings, ...change } }))

  const grouped = useMemo(() => {
    const q = filter.toLowerCase()
    const lines = project.lines.filter((l) => !q || `${l.description} ${l.category} ${l.note}`.toLowerCase().includes(q))
    const cats = [...new Set([...categories.filter((c) => lines.some((l) => l.category === c)), ...lines.map((l) => l.category)])]
    return cats.map((c) => ({ category: c, lines: lines.filter((l) => l.category === c) }))
  }, [project.lines, categories, filter])

  const unpriced = project.lines.filter((l) => l.material === 0 && l.labor === 0).length
  const outdated = project.lines.filter((l) => {
    const item = prices.find((p) => p.id === l.priceItemId)
    return item && (item.material !== l.material || item.labor !== l.labor)
  })

  function refreshPrices() {
    update((p) => ({
      ...p,
      lines: p.lines.map((l) => {
        const item = prices.find((x) => x.id === l.priceItemId)
        return item ? { ...l, material: item.material, labor: item.labor } : l
      }),
    }))
  }

  function exportCsv() {
    const rows: (string | number)[][] = [["Category", "Description", "Qty", "Unit", "Waste %", "Material/Unit", "Labor/Unit", "Material", "Labor", "Total", "Source", "Notes"]]
    for (const g of grouped)
      for (const l of g.lines) {
        const t = lineTotals(l, project)
        rows.push([l.category, l.description, t.qty.toFixed(2), l.unit, l.wastePct, l.material, l.labor, t.material.toFixed(2), t.labor.toFixed(2), t.total.toFixed(2), l.source, l.note])
      }
    downloadBlob(new Blob([toCsv(rows)], { type: "text/csv" }), `${safeFilename(project.name)}-estimate.csv`)
  }

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="max-w-xs" placeholder="Filter lines…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Button variant="primary" onClick={() => setAdding(categories[0] ?? "")}>
            <Plus size={16} /> Add line
          </Button>
          {outdated.length > 0 && (
            <Button onClick={refreshPrices} title="Your price list changed since these lines were added">
              <RefreshCw size={16} /> Update {outdated.length} line{outdated.length === 1 ? "" : "s"} to current prices
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button onClick={() => void exportEstimateXlsx(project, prices, categories)}>
              <FileSpreadsheet size={16} /> Excel
            </Button>
            <Button onClick={exportCsv}>CSV</Button>
          </div>
        </div>

        {unpriced > 0 && (
          <p className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle size={16} /> {unpriced} line{unpriced === 1 ? " has" : "s have"} no cost yet. Pick a price list item or type unit costs.
          </p>
        )}

        {project.lines.length === 0 ? (
          <Card>
            <div className="py-8 text-center text-sm text-slate-600">
              <p className="mb-2 font-medium text-slate-800">No line items yet</p>
              <p>
                Run the <a className="text-brand-700 underline" href={href.project(project.id, "plans")}>AI takeoff</a>, link measurements from
                the plans, or add lines by hand.
              </p>
            </div>
          </Card>
        ) : (
          grouped.map((g) => {
            const cat = totals.categories.find((c) => c.category === g.category)
            return (
              <Card
                key={g.category}
                title={
                  <span>
                    {g.category} <span className="ml-2 font-normal text-slate-500">{fmtMoney(cat?.direct ?? 0)}</span>
                  </span>
                }
                actions={
                  <Button size="sm" variant="ghost" onClick={() => setAdding(g.category)}>
                    <Plus size={14} /> Add
                  </Button>
                }
                className="overflow-hidden"
              >
                <div className="-m-4 overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Description</th>
                        <th className="w-28 px-2 py-2 text-right font-medium">Qty</th>
                        <th className="w-24 px-2 py-2 font-medium">Unit</th>
                        <th className="w-20 px-2 py-2 text-right font-medium">Waste %</th>
                        <th className="w-28 px-2 py-2 text-right font-medium">Mat / unit</th>
                        <th className="w-28 px-2 py-2 text-right font-medium">Labor / unit</th>
                        <th className="w-28 px-3 py-2 text-right font-medium">Total</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {g.lines.map((l) => (
                        <LineRow key={l.id} line={l} project={project} prices={prices} categories={categories} onPatch={(c) => patchLine(l.id, c)} onRemove={() => removeLine(l.id)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          })
        )}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Card title="Totals">
          <dl className="space-y-1.5 text-sm">
            <Row label="Material" value={totals.material} />
            <Row label="Labor" value={totals.labor} />
            <Row label="Direct cost" value={totals.direct} strong />
            <PctRow label="Overhead" pct={project.settings.overheadPct} value={totals.overhead} onPct={(n) => patchSettings({ overheadPct: n })} />
            <PctRow label="Profit" pct={project.settings.profitPct} value={totals.profit} onPct={(n) => patchSettings({ profitPct: n })} />
            <PctRow label="Contingency" pct={project.settings.contingencyPct} value={totals.contingency} onPct={(n) => patchSettings({ contingencyPct: n })} />
            <PctRow label="Tax / GET" pct={project.settings.taxPct} value={totals.tax} onPct={(n) => patchSettings({ taxPct: n })} />
            <div className="border-t border-slate-200 pt-2">
              <Row label="Total" value={totals.total} strong big />
            </div>
          </dl>
          <div className="mt-4 grid grid-cols-2 items-end gap-2">
            <Field label="Living area (SF)">
              <NumberInput value={project.settings.conditionedSf} onCommit={(n) => patchSettings({ conditionedSf: n })} />
            </Field>
            <div className="pb-2 text-right text-sm">
              {totals.perSf ? (
                <>
                  <span className="font-semibold">{fmtMoney(totals.perSf)}</span>
                  <span className="text-slate-500"> / SF</span>
                </>
              ) : (
                <span className="text-slate-400">— / SF</span>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Profit applies to direct cost + overhead. Tax applies to the marked-up subtotal.</p>
        </Card>
      </aside>

      {adding !== null && (
        <AddLineModal
          category={adding}
          categories={categories}
          prices={prices}
          onClose={() => setAdding(null)}
          onAdd={(lines) => {
            update((p) => ({ ...p, lines: [...p.lines, ...lines] }))
            setAdding(null)
          }}
        />
      )}
    </div>
  )
}

function Row({ label, value, strong, big }: { label: string; value: number; strong?: boolean; big?: boolean }) {
  return (
    <div className={clsx("flex justify-between", strong && "font-semibold", big && "text-lg")}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{fmtMoney(value)}</dd>
    </div>
  )
}

function PctRow({ label, pct, value, onPct }: { label: string; pct: number; value: number; onPct: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-2">
        {label}
        <NumberInput className="h-7 w-16 text-xs" value={pct} onCommit={onPct} aria-label={`${label} percent`} />
        <span className="text-xs text-slate-500">%</span>
      </dt>
      <dd className="tabular-nums">{fmtMoney(value)}</dd>
    </div>
  )
}

function LineRow({
  line,
  project,
  prices,
  categories,
  onPatch,
  onRemove,
}: {
  line: EstimateLine
  project: Project
  prices: PriceItem[]
  categories: string[]
  onPatch: (c: Partial<EstimateLine>) => void
  onRemove: () => void
}) {
  const t = lineTotals(line, project)
  const item = prices.find((p) => p.id === line.priceItemId)
  const linked = line.measurementIds.length > 0
  return (
    <tr className="align-top">
      <td className="px-3 py-2">
        <Input className="h-8" value={line.description} onChange={(e) => onPatch({ description: e.target.value })} />
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
          {line.source === "ai" && (
            <Badge tone="violet">
              <Sparkles size={11} className="mr-0.5" /> AI{line.confidence ? ` · ${line.confidence}` : ""}
            </Badge>
          )}
          {linked && (
            <Badge tone="blue">
              <Ruler size={11} className="mr-0.5" /> {line.measurementIds.length} measurement{line.measurementIds.length > 1 ? "s" : ""}
            </Badge>
          )}
          {item ? <Badge tone="green">{item.code}</Badge> : null}
          <select
            className="rounded border-0 bg-transparent py-0 text-xs text-slate-500 hover:bg-slate-100"
            value={line.category}
            onChange={(e) => onPatch({ category: e.target.value })}
            aria-label="Category"
          >
            {[...new Set([...categories, line.category])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {t.warning && (
            <span className="text-amber-700" title={t.warning}>
              <AlertTriangle size={12} className="inline" /> {t.warning}
            </span>
          )}
        </div>
        <input
          className="mt-1 w-full rounded border-0 bg-transparent px-0 py-0.5 text-xs text-slate-500 placeholder:text-slate-300 focus:bg-slate-50 focus:ring-0"
          value={line.note}
          placeholder="Notes / basis"
          onChange={(e) => onPatch({ note: e.target.value })}
        />
      </td>
      <td className="px-2 py-2">
        {linked ? (
          <div className="flex h-8 items-center justify-end gap-1 tabular-nums" title="From linked measurements">
            {fmtNum(t.qty)}
            <button
              className="text-xs text-slate-400 hover:text-red-600"
              title="Unlink measurements and type a quantity"
              onClick={() => onPatch({ measurementIds: [], qty: Math.round(t.qty * 100) / 100 })}
            >
              ×
            </button>
          </div>
        ) : (
          <NumberInput className="h-8" value={line.qty} onCommit={(n) => onPatch({ qty: n })} />
        )}
        {line.wastePct > 0 && <div className="mt-1 text-right text-[11px] text-slate-400">{fmtNum(t.qtyWithWaste)} w/ waste</div>}
      </td>
      <td className="px-2 py-2">
        <Select className="h-8 px-1.5" value={line.unit} onChange={(e) => onPatch({ unit: e.target.value as Unit })}>
          {UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </Select>
      </td>
      <td className="px-2 py-2">
        <NumberInput className="h-8" value={line.wastePct} onCommit={(n) => onPatch({ wastePct: n })} />
      </td>
      <td className="px-2 py-2">
        <NumberInput className="h-8" value={line.material} onCommit={(n) => onPatch({ material: n })} />
      </td>
      <td className="px-2 py-2">
        <NumberInput className="h-8" value={line.labor} onCommit={(n) => onPatch({ labor: n })} />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex h-8 items-center justify-end font-semibold tabular-nums">{fmtMoney(t.total)}</div>
        <div className="text-[11px] text-slate-400 tabular-nums">
          M {fmtMoney(t.material)} · L {fmtMoney(t.labor)}
        </div>
      </td>
      <td className="py-2 pr-2">
        <button className="mt-1.5 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={onRemove} aria-label="Delete line">
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  )
}

function AddLineModal({
  category,
  categories,
  prices,
  onClose,
  onAdd,
}: {
  category: string
  categories: string[]
  prices: PriceItem[]
  onClose: () => void
  onAdd: (lines: EstimateLine[]) => void
}) {
  const [q, setQ] = useState("")
  const [cat, setCat] = useState(category)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState({ description: "", unit: "EA" as Unit, qty: 1, material: 0, labor: 0 })
  const list = prices.filter((p) => `${p.code} ${p.description} ${p.category}`.toLowerCase().includes(q.toLowerCase()))
  const sorted = [...list].sort((a, b) => Number(b.category === cat) - Number(a.category === cat))

  const fromItem = (p: PriceItem): EstimateLine => ({
    id: uid(),
    category: p.category,
    description: p.description,
    priceItemId: p.id,
    unit: p.unit,
    qty: 0,
    measurementIds: [],
    wastePct: p.wastePct,
    material: p.material,
    labor: p.labor,
    source: "manual",
    note: "",
  })

  return (
    <Modal title="Add estimate lines" onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">From your price list</p>
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" autoFocus />
          <div className="max-h-[45vh] overflow-y-auto rounded border border-slate-200">
            {prices.length === 0 && (
              <p className="p-3 text-sm text-slate-500">
                No price list yet. <a className="text-brand-700 underline" href={href.prices()}>Add or import one</a>.
              </p>
            )}
            {sorted.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={picked.has(p.id)}
                  onChange={() =>
                    setPicked((s) => {
                      const n = new Set(s)
                      if (n.has(p.id)) n.delete(p.id)
                      else n.add(p.id)
                      return n
                    })
                  }
                />
                <span className="w-20 shrink-0 font-mono text-xs text-slate-500">{p.code}</span>
                <span className="flex-1 truncate">{p.description}</span>
                <span className="text-xs text-slate-500">{p.unit}</span>
              </label>
            ))}
          </div>
          <Button
            variant="primary"
            className="mt-2"
            disabled={!picked.size}
            onClick={() => onAdd(prices.filter((p) => picked.has(p.id)).map(fromItem))}
          >
            Add {picked.size || ""} selected
          </Button>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!custom.description.trim()) return
            onAdd([
              {
                id: uid(),
                category: cat,
                description: custom.description.trim(),
                priceItemId: null,
                unit: custom.unit,
                qty: custom.qty,
                measurementIds: [],
                wastePct: 0,
                material: custom.material,
                labor: custom.labor,
                source: "manual",
                note: "",
              },
            ])
          }}
        >
          <p className="text-sm font-medium">Custom line or allowance</p>
          <Field label="Category">
            <Select value={cat} onChange={(e) => setCat(e.target.value)}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Description">
            <Input value={custom.description} onChange={(e) => setCustom({ ...custom, description: e.target.value })} placeholder="e.g. Appliance allowance" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Qty">
              <NumberInput value={custom.qty} onCommit={(n) => setCustom({ ...custom, qty: n })} />
            </Field>
            <Field label="Unit">
              <Select value={custom.unit} onChange={(e) => setCustom({ ...custom, unit: e.target.value as Unit })}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
            </Field>
            <Field label="Material / unit">
              <NumberInput value={custom.material} onCommit={(n) => setCustom({ ...custom, material: n })} />
            </Field>
            <Field label="Labor / unit">
              <NumberInput value={custom.labor} onCommit={(n) => setCustom({ ...custom, labor: n })} />
            </Field>
          </div>
          <Button type="submit" disabled={!custom.description.trim()}>
            Add custom line
          </Button>
        </form>
      </div>
    </Modal>
  )
}
