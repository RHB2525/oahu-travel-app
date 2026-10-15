import { convertQty } from "./calc"
import { uid } from "./format"
import { pageImagesForAi, pageText, type PDFDocumentProxy } from "./pdf"
import { UNITS, type AiConsolidation, type AiLine, type AiPageResult, type EstimateLine, type PriceItem, type Unit } from "./types"

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
  const text = await res.text()
  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(res.ok ? "Unexpected server response." : `Server error ${res.status}: ${text.slice(0, 200)}`)
  }
  if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`)
  return json as T
}

export async function analyzePage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  opts: { categories: string[]; projectNotes: string; highDetail: boolean; signal?: AbortSignal },
): Promise<AiPageResult> {
  const page = await doc.getPage(pageNumber)
  const [text, { overview, tiles }] = await Promise.all([pageText(page), pageImagesForAi(page, opts.highDetail)])
  return post<AiPageResult>(
    "/api/analyze-page",
    { page: pageNumber, text, overview, tiles, categories: opts.categories, projectNotes: opts.projectNotes },
    opts.signal,
  )
}

export async function consolidate(
  pages: AiPageResult[],
  priceList: PriceItem[],
  categories: string[],
  projectNotes: string,
  signal?: AbortSignal,
): Promise<AiConsolidation> {
  return post<AiConsolidation>(
    "/api/consolidate",
    {
      pages,
      priceList: priceList.map((p) => ({ code: p.code, description: p.description, category: p.category, unit: p.unit })),
      categories,
      projectNotes,
    },
    signal,
  )
}

/** Runs async jobs with limited parallelism, reporting each result as it lands. */
export async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
  onDone: (item: T, result: R | null, error: Error | null) => void,
) {
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      try {
        onDone(item, await worker(item), null)
      } catch (err) {
        onDone(item, null, err instanceof Error ? err : new Error(String(err)))
      }
    }
  })
  await Promise.all(runners)
}

const asUnit = (u: string): Unit => ((UNITS as readonly string[]).includes(u) ? (u as Unit) : "EA")

/** Turns an AI line into an estimate line, pulling costs from the matched price list item. */
export function aiLineToEstimate(line: AiLine, priceList: PriceItem[]): EstimateLine {
  const item = line.price_item_code ? priceList.find((p) => p.code.toLowerCase() === line.price_item_code!.toLowerCase()) : undefined
  const aiUnit = asUnit(line.unit)
  let qty = line.quantity
  let unit = aiUnit
  let note = `${line.basis}${line.source_sheets.length ? ` [${line.source_sheets.join(", ")}]` : ""}`
  if (item) {
    const converted = convertQty(line.quantity, aiUnit, item.unit)
    if (converted !== null) {
      qty = converted
      unit = item.unit
    } else {
      note += ` (AI unit ${aiUnit} does not match price item unit ${item.unit}; check quantity)`
    }
  } else {
    note += " (no price list match: set costs)"
  }
  return {
    id: uid(),
    category: item?.category ?? line.category,
    description: line.description,
    priceItemId: item?.id ?? null,
    unit,
    qty: Math.round(qty * 100) / 100,
    measurementIds: [],
    wastePct: item?.wastePct ?? 0,
    material: item?.material ?? 0,
    labor: item?.labor ?? 0,
    source: "ai",
    note,
    confidence: line.confidence,
  }
}
