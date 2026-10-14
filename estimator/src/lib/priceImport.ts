import { toNumber, uid } from "./format"
import { UNITS, type PriceItem, type Unit } from "./types"

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""))
}

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n")

export const PRICE_COLUMNS = ["code", "description", "category", "unit", "material", "labor", "waste_pct", "notes"]

export function priceListCsv(items: PriceItem[]) {
  return toCsv([
    PRICE_COLUMNS,
    ...items.map((p) => [p.code, p.description, p.category, p.unit, p.material, p.labor, p.wastePct, p.notes]),
  ])
}

export const TEMPLATE_CSV = toCsv([
  PRICE_COLUMNS,
  ["ROOF-SHG", "Architectural asphalt shingles incl. underlayment", "Roofing", "SQ", "", "", 10, "Per 100 SF of roof area"],
  ["ROOF-RIDGE", "Ridge vent / ridge cap", "Roofing", "LF", "", "", 5, ""],
  ["ELEC-REC", "Duplex receptacle, installed", "Electrical", "EA", "", "", 0, ""],
  ["ELEC-SW", "Single-pole switch, installed", "Electrical", "EA", "", "", 0, ""],
  ["ELEC-CAN", "LED recessed can light", "Electrical", "EA", "", "", 0, ""],
  ["PLB-WC", "Toilet set, rough + trim", "Plumbing", "EA", "", "", 0, ""],
  ["PLB-LAV", "Lavatory sink rough + trim", "Plumbing", "EA", "", "", 0, ""],
  ["CAB-BASE", "Base cabinets", "Cabinets", "LF", "", "", 0, ""],
  ["CAB-WALL", "Wall cabinets", "Cabinets", "LF", "", "", 0, ""],
  ["FLR-LVP", "Luxury vinyl plank flooring", "Flooring", "SF", "", "", 8, ""],
  ["FLR-TILE", "Porcelain floor tile", "Flooring", "SF", "", "", 10, ""],
])

/** Reads a CSV or Excel price sheet. Header names are matched loosely. */
export async function readPriceFile(file: File): Promise<PriceItem[]> {
  let rows: string[][]
  if (/\.xlsx$/i.test(file.name)) {
    const ExcelJS = (await import("exceljs")).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await file.arrayBuffer())
    const ws = wb.worksheets[0]
    rows = []
    ws.eachRow((r) => {
      const values = (r.values as unknown[]).slice(1)
      rows.push(values.map((v) => (v && typeof v === "object" && "result" in v ? String((v as any).result ?? "") : v == null ? "" : String(v))))
    })
  } else {
    rows = parseCsv(await file.text())
  }
  if (rows.length < 2) throw new Error("The file has no data rows.")
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""))
  const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.startsWith(n)))
  const idx = {
    code: col("code", "item", "sku", "id"),
    description: col("description", "desc", "name"),
    category: col("category", "trade", "division"),
    unit: col("unit", "uom"),
    material: col("material", "mat"),
    labor: col("labor", "labour", "install"),
    waste: col("wastepct", "waste"),
    notes: col("notes", "note", "comment"),
  }
  if (idx.description === -1) throw new Error('Could not find a "description" column. Download the template to see the expected columns.')
  return rows.slice(1).map((r, i) => {
    const get = (k: number) => (k >= 0 ? (r[k] ?? "").trim() : "")
    const unitRaw = get(idx.unit).toUpperCase()
    const unit: Unit = (UNITS as readonly string[]).includes(unitRaw) ? (unitRaw as Unit) : "EA"
    return {
      id: uid(),
      code: get(idx.code) || `ITEM-${i + 1}`,
      description: get(idx.description),
      category: get(idx.category) || "General Conditions",
      unit,
      material: toNumber(get(idx.material)),
      labor: toNumber(get(idx.labor)),
      wastePct: toNumber(get(idx.waste)),
      notes: get(idx.notes),
    }
  })
}

/** Merges imported rows into the list: same code updates the existing item. */
export function mergePriceItems(existing: PriceItem[], incoming: PriceItem[]) {
  const byCode = new Map(existing.map((p) => [p.code.toLowerCase(), p]))
  let added = 0
  let updated = 0
  const result = [...existing]
  for (const item of incoming) {
    const match = byCode.get(item.code.toLowerCase())
    if (match) {
      const updatedItem = { ...item, id: match.id }
      result[result.indexOf(match)] = updatedItem
      byCode.set(item.code.toLowerCase(), updatedItem)
      updated++
    } else {
      result.push(item)
      byCode.set(item.code.toLowerCase(), item)
      added++
    }
  }
  return { items: result, added, updated }
}
