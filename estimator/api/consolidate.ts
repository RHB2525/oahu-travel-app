import { CONSOLIDATION_SCHEMA, HttpError, handle, structuredCall } from "./_lib/claude.js"

interface Body {
  pages: unknown[]
  priceList: { code: string; description: string; category: string; unit: string }[]
  categories: string[]
  projectNotes?: string
}

const SYSTEM = `You are a senior residential construction estimator. You receive per-sheet takeoff findings from a house plan set and the contractor's own price list. Merge them into one set of estimate line items.

Rules:
- The same item often appears on several sheets (e.g. floor area on the floor plan and the finish schedule; fixtures on the floor plan and the plumbing plan). Do not add duplicates together. Keep the most authoritative source: schedules and dimensioned plans beat overview sheets; the trade sheet beats the architectural sheet for that trade.
- Do add quantities that are genuinely separate (e.g. first floor + second floor flooring, receptacles on E1 + E2).
- Match each line to the price list by setting price_item_code to the code of the item that prices it. Only match when the work and unit are compatible; convert the quantity to the price item's unit when needed (e.g. SF to SQ divides by 100). Use null when nothing fits.
- Each price list item should normally appear at most once. If one item would be matched by several lines, combine them.
- Skip findings with null quantity, but mention important ones in "questions".
- Keep "basis" short and cite the sheets. List anything the estimator must verify, any scope that seems missing from the plans, and any assumptions in "questions".
- Use these categories: {CATEGORIES}.`

export async function POST(request: Request) {
  return handle(request, async (body: Body) => {
    if (!Array.isArray(body?.pages) || body.pages.length === 0) throw new HttpError(400, "No page results to consolidate.")
    const priceList = (body.priceList ?? []).map((p) => `${p.code}\t${p.unit}\t${p.category}\t${p.description}`).join("\n")
    return structuredCall({
      system: SYSTEM.replace("{CATEGORIES}", (body.categories ?? []).join(", ")),
      content: [
        {
          type: "text",
          text: [
            `<price_list>\ncode\tunit\tcategory\tdescription\n${priceList || "(empty: set price_item_code to null)"}\n</price_list>`,
            `<sheet_findings>\n${JSON.stringify(body.pages, null, 1)}\n</sheet_findings>`,
            body.projectNotes ? `<estimator_notes>\n${body.projectNotes}\n</estimator_notes>` : "",
            "Produce the consolidated estimate lines.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      schema: CONSOLIDATION_SCHEMA,
      effort: "high",
    })
  })
}
