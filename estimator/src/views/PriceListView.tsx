import { Download, FileDown, ListOrdered, Plus, Tags, Trash2, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { Button, Card, EmptyState, Input, Modal, NumberInput, Select } from "../components/ui"
import { downloadBlob, uid } from "../lib/format"
import { TEMPLATE_CSV, mergePriceItems, priceListCsv, readPriceFile } from "../lib/priceImport"
import { useCategories, usePriceList } from "../lib/store"
import { DEFAULT_CATEGORIES, UNITS, UNIT_LABELS, type PriceItem, type Unit } from "../lib/types"

export function PriceListView() {
  const [items, setItems] = usePriceList()
  const [categories] = useCategories()
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [editingCats, setEditingCats] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const patch = (id: string, change: Partial<PriceItem>) => setItems((list) => list.map((p) => (p.id === id ? { ...p, ...change } : p)))
  const remove = (id: string) => setItems((list) => list.filter((p) => p.id !== id))
  const add = () => {
    const category = cat || categories[0] || "General Conditions"
    const n = items.filter((p) => p.category === category).length + 1
    setItems((list) => [
      { id: uid(), code: `${category.slice(0, 4).toUpperCase().replace(/\W/g, "")}-${n}`, description: "", category, unit: "EA", material: 0, labor: 0, wastePct: 0, notes: "" },
      ...list,
    ])
  }

  async function importFile(file: File) {
    try {
      const incoming = await readPriceFile(file)
      const result = mergePriceItems(items, incoming)
      setItems(result.items)
      setMessage(`Imported ${incoming.length} rows: ${result.added} added, ${result.updated} updated (matched by code).`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import failed.")
    }
  }

  const visible = items.filter(
    (p) => (!cat || p.category === cat) && (!q || `${p.code} ${p.description} ${p.notes}`.toLowerCase().includes(q.toLowerCase())),
  )

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Price list</h1>
          <p className="text-sm text-slate-500">
            Your unit costs. The AI takeoff matches quantities to these codes, and estimate lines pull material, labor and waste from here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadBlob(new Blob([TEMPLATE_CSV], { type: "text/csv" }), "price-list-template.csv")}>
            <FileDown size={16} /> Template
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Import CSV / Excel
          </Button>
          <Button disabled={!items.length} onClick={() => downloadBlob(new Blob([priceListCsv(items)], { type: "text/csv" }), "price-list.csv")}>
            <Download size={16} /> Export
          </Button>
          <Button onClick={() => setEditingCats(true)}>
            <Tags size={16} /> Categories
          </Button>
          <Button variant="primary" onClick={add}>
            <Plus size={16} /> Add item
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importFile(f)
              e.target.value = ""
            }}
          />
        </div>
      </div>

      {message && <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">{message}</p>}

      <Card>
        {items.length === 0 ? (
          <EmptyState icon={<ListOrdered size={36} />} title="Your price list is empty">
            Download the template, fill in your material and labor unit costs, and import it. You can also add items one at a time. Columns: code,
            description, category, unit ({UNITS.join(", ")}), material, labor, waste_pct, notes.
          </EmptyState>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <Input className="max-w-xs" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
              <Select className="max-w-[220px]" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <span className="self-center text-sm text-slate-500">
                {visible.length} of {items.length}
              </span>
            </div>
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-32 px-2 py-2 font-medium">Code</th>
                    <th className="px-2 py-2 font-medium">Description</th>
                    <th className="w-48 px-2 py-2 font-medium">Category</th>
                    <th className="w-24 px-2 py-2 font-medium">Unit</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">Material</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">Labor</th>
                    <th className="w-20 px-2 py-2 text-right font-medium">Waste %</th>
                    <th className="w-56 px-2 py-2 font-medium">Notes</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((p) => (
                    <tr key={p.id}>
                      <td className="px-2 py-1.5">
                        <Input className="h-8 font-mono text-xs" value={p.code} onChange={(e) => patch(p.id, { code: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input className="h-8" value={p.description} onChange={(e) => patch(p.id, { description: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select className="h-8" value={p.category} onChange={(e) => patch(p.id, { category: e.target.value })}>
                          {[...new Set([...categories, p.category])].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Select className="h-8" value={p.unit} onChange={(e) => patch(p.id, { unit: e.target.value as Unit })} title={UNIT_LABELS[p.unit]}>
                          {UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <NumberInput className="h-8" value={p.material} onCommit={(n) => patch(p.id, { material: n })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <NumberInput className="h-8" value={p.labor} onCommit={(n) => patch(p.id, { labor: n })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <NumberInput className="h-8" value={p.wastePct} onCommit={(n) => patch(p.id, { wastePct: n })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input className="h-8" value={p.notes} onChange={(e) => patch(p.id, { notes: e.target.value })} />
                      </td>
                      <td className="pr-2">
                        <button className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove(p.id)} aria-label="Delete item">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {editingCats && <CategoriesModal onClose={() => setEditingCats(false)} />}
    </div>
  )
}

function CategoriesModal({ onClose }: { onClose: () => void }) {
  const [categories, setCategories] = useCategories()
  const [name, setName] = useState("")
  const move = (i: number, d: number) =>
    setCategories((list) => {
      const next = [...list]
      const j = i + d
      if (j < 0 || j >= next.length) return list
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  return (
    <Modal title="Categories" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">The order here is the order on the estimate and proposal. Add categories for custom upgrades or new trades.</p>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const n = name.trim()
          if (n && !categories.includes(n)) setCategories([...categories, n])
          setName("")
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" />
        <Button type="submit">Add</Button>
      </form>
      <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded border border-slate-200">
        {categories.map((c, i) => (
          <li key={c} className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <span className="flex-1">{c}</span>
            <button className="px-1 text-slate-400 hover:text-slate-800" onClick={() => move(i, -1)} aria-label="Move up">
              ↑
            </button>
            <button className="px-1 text-slate-400 hover:text-slate-800" onClick={() => move(i, 1)} aria-label="Move down">
              ↓
            </button>
            <button className="px-1 text-slate-400 hover:text-red-600" onClick={() => setCategories(categories.filter((x) => x !== c))} aria-label="Remove">
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <button className="mt-2 text-xs text-slate-500 underline" onClick={() => setCategories(DEFAULT_CATEGORIES)}>
        Reset to defaults
      </button>
    </Modal>
  )
}
