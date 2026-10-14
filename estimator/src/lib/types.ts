export const UNITS = ["SF", "LF", "EA", "SQ", "SY", "CY", "LS", "HR", "ALLOW"] as const
export type Unit = (typeof UNITS)[number]

export const UNIT_LABELS: Record<Unit, string> = {
  SF: "Square feet",
  LF: "Linear feet",
  EA: "Each",
  SQ: "Roofing square (100 SF)",
  SY: "Square yard",
  CY: "Cubic yard",
  LS: "Lump sum",
  HR: "Hour",
  ALLOW: "Allowance",
}

export const DEFAULT_CATEGORIES = [
  "General Conditions",
  "Sitework & Demo",
  "Foundation & Concrete",
  "Framing",
  "Roofing",
  "Exterior Finishes",
  "Windows & Doors",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Insulation",
  "Drywall",
  "Cabinets",
  "Countertops",
  "Flooring",
  "Interior Trim",
  "Paint",
  "Fixtures & Appliances",
  "Custom Upgrades",
]

/** One row of the contractor's own price list. Costs are per unit. */
export interface PriceItem {
  id: string
  code: string
  description: string
  category: string
  unit: Unit
  material: number
  labor: number
  wastePct: number
  notes: string
}

export type LineSource = "manual" | "ai" | "takeoff"

export interface EstimateLine {
  id: string
  category: string
  description: string
  priceItemId: string | null
  unit: Unit
  /** Manually entered quantity; ignored when measurementIds is non-empty. */
  qty: number
  measurementIds: string[]
  wastePct: number
  material: number
  labor: number
  source: LineSource
  /** How the quantity was derived (AI basis, sheet refs, or your own note). */
  note: string
  confidence?: "low" | "medium" | "high"
}

export type MeasureType = "length" | "area" | "count"

/** Points are in PDF user-space units at scale 1 (1 unit = 1/72 inch of paper). */
export interface Measurement {
  id: string
  page: number
  type: MeasureType
  label: string
  color: string
  points: [number, number][]
  /** Optional multiplier, e.g. wall height for length → wall SF, or 2 for both sides. */
  multiplier: number
}

export interface PageScale {
  /** Real-world feet represented by one PDF unit. */
  feetPerUnit: number
  label: string
}

export type TaxBasis = "materials" | "total"

export interface ProjectSettings {
  overheadPct: number
  profitPct: number
  contingencyPct: number
  taxPct: number
  /**
   * "materials": sales tax the builder pays on materials, carried as a cost (Texas new residential
   * construction, lump-sum contracts). "total": tax charged to the client on the whole price.
   */
  taxBasis: TaxBasis
  conditionedSf: number
}

export interface ClientInfo {
  name: string
  address: string
  phone: string
  email: string
}

export interface AiFinding {
  category: string
  item: string
  quantity: number | null
  unit: string
  basis: string
  confidence: "low" | "medium" | "high"
}

export interface AiPageResult {
  page: number
  sheet_number: string
  sheet_title: string
  discipline: string
  scale_text: string
  findings: AiFinding[]
  notes: string
}

export interface AiLine {
  category: string
  description: string
  quantity: number
  unit: string
  price_item_code: string | null
  basis: string
  confidence: "low" | "medium" | "high"
  source_sheets: string[]
}

export interface AiSummary {
  conditioned_sf: number | null
  garage_sf: number | null
  roof_area_sf: number | null
  roof_pitch: string
  stories: number | null
  bedrooms: number | null
  bathrooms: number | null
}

export interface AiConsolidation {
  summary: AiSummary
  lines: AiLine[]
  questions: string[]
}

export interface AiRun {
  at: string
  pages: AiPageResult[]
  consolidation: AiConsolidation | null
}

export interface Project {
  id: string
  name: string
  number: string
  client: ClientInfo
  siteAddress: string
  createdAt: string
  updatedAt: string
  settings: ProjectSettings
  lines: EstimateLine[]
  measurements: Measurement[]
  scales: Record<number, PageScale>
  pdfName: string | null
  /** IndexedDB key of the plan set; several estimates (houses) can share one PDF. Defaults to the project id. */
  pdfKey?: string
  /** Sheets that belong to this house. Undefined means every page of the PDF. */
  pages?: number[]
  pageCount: number
  ai: AiRun | null
  /** Notes passed to the AI takeoff, e.g. finish selections the plans don't show. */
  aiNotes?: string
  proposal: {
    scopeNotes: string
    exclusions: string
    showLineItems: boolean
  }
}

export interface Company {
  name: string
  license: string
  address: string
  phone: string
  email: string
  logoDataUrl: string | null
  terms: string
}
