import type { EstimateLine, Measurement, PageScale, Project, Unit } from "./types"

export function measurementBaseUnit(type: Measurement["type"]): Unit {
  return type === "length" ? "LF" : type === "area" ? "SF" : "EA"
}

function pathLength(points: [number, number][]) {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  }
  return total
}

function polygonArea(points: [number, number][]) {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    sum += x1 * y2 - x2 * y1
  }
  return Math.abs(sum) / 2
}

export function distanceUnits(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** Real-world quantity of a measurement in its base unit, or null if the page has no scale yet. */
export function measurementValue(m: Measurement, scale: PageScale | undefined): number | null {
  const mult = m.multiplier || 1
  if (m.type === "count") return m.points.length * mult
  if (!scale) return null
  if (m.type === "length") return pathLength(m.points) * scale.feetPerUnit * mult
  if (m.points.length < 3) return 0
  return polygonArea(m.points) * scale.feetPerUnit * scale.feetPerUnit * mult
}

const AREA_FACTORS: Partial<Record<Unit, number>> = { SF: 1, SQ: 100, SY: 9 }

/** Converts a quantity between compatible units; null when the units don't convert. */
export function convertQty(value: number, from: Unit, to: Unit): number | null {
  if (from === to) return value
  const f = AREA_FACTORS[from]
  const t = AREA_FACTORS[to]
  if (f && t) return (value * f) / t
  if (to === "LS" || to === "ALLOW") return 1
  return null
}

export interface LineQty {
  qty: number
  /** Set when linked measurements are missing a scale or have an incompatible unit. */
  warning: string | null
}

export function lineQty(line: EstimateLine, project: Project): LineQty {
  if (!line.measurementIds.length) return { qty: line.qty, warning: null }
  let qty = 0
  const warnings: string[] = []
  for (const id of line.measurementIds) {
    const m = project.measurements.find((x) => x.id === id)
    if (!m) continue
    const v = measurementValue(m, project.scales[m.page])
    if (v === null) {
      warnings.push(`"${m.label}" page ${m.page} has no scale`)
      continue
    }
    const converted = convertQty(v, measurementBaseUnit(m.type), line.unit)
    if (converted === null) {
      warnings.push(`"${m.label}" is ${measurementBaseUnit(m.type)}, line is ${line.unit}`)
      continue
    }
    qty += converted
  }
  return { qty, warning: warnings.length ? warnings.join("; ") : null }
}

export interface LineTotals {
  qty: number
  qtyWithWaste: number
  material: number
  labor: number
  total: number
  warning: string | null
}

export function lineTotals(line: EstimateLine, project: Project): LineTotals {
  const { qty, warning } = lineQty(line, project)
  const qtyWithWaste = qty * (1 + (line.wastePct || 0) / 100)
  const material = qtyWithWaste * (line.material || 0)
  const labor = qtyWithWaste * (line.labor || 0)
  return { qty, qtyWithWaste, material, labor, total: material + labor, warning }
}

export interface CategoryTotal {
  category: string
  material: number
  labor: number
  direct: number
  /** Direct cost with overhead, profit, contingency and tax spread proportionally. */
  sell: number
  lines: number
}

export interface ProjectTotals {
  material: number
  labor: number
  direct: number
  overhead: number
  profit: number
  contingency: number
  tax: number
  total: number
  perSf: number | null
  categories: CategoryTotal[]
}

export function projectTotals(project: Project, categoryOrder: string[]): ProjectTotals {
  const s = project.settings
  const byCat = new Map<string, CategoryTotal>()
  let material = 0
  let labor = 0
  for (const line of project.lines) {
    const t = lineTotals(line, project)
    material += t.material
    labor += t.labor
    const c = byCat.get(line.category) ?? { category: line.category, material: 0, labor: 0, direct: 0, sell: 0, lines: 0 }
    c.material += t.material
    c.labor += t.labor
    c.direct += t.total
    c.lines += 1
    byCat.set(line.category, c)
  }
  const direct = material + labor
  const overhead = direct * (s.overheadPct / 100)
  const profit = (direct + overhead) * (s.profitPct / 100)
  const contingency = direct * (s.contingencyPct / 100)
  const tax = (direct + overhead + profit + contingency) * (s.taxPct / 100)
  const total = direct + overhead + profit + contingency + tax
  const ratio = direct > 0 ? total / direct : 0
  const order = (cat: string) => {
    const i = categoryOrder.indexOf(cat)
    return i === -1 ? 999 : i
  }
  const categories = [...byCat.values()]
    .map((c) => ({ ...c, sell: c.direct * ratio }))
    .sort((a, b) => order(a.category) - order(b.category) || a.category.localeCompare(b.category))
  return {
    material,
    labor,
    direct,
    overhead,
    profit,
    contingency,
    tax,
    total,
    perSf: s.conditionedSf > 0 ? total / s.conditionedSf : null,
    categories,
  }
}
