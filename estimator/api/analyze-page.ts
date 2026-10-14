import type Anthropic from "@anthropic-ai/sdk"
import { HttpError, PAGE_SCHEMA, handle, structuredCall } from "./_lib/claude.js"

interface Body {
  page: number
  text: string
  overview: string
  tiles: { label: string; data: string }[]
  categories: string[]
  projectNotes?: string
}

const SYSTEM = `You are a senior residential construction estimator doing a quantity takeoff from one sheet of a house plan set.

Report quantities a contractor would price, organized by trade. Cover whatever this sheet shows, especially:
- Roofing: roof area (SF, or SQ = 100 SF), pitch, ridge/hip/valley/eave/rake lengths (LF), underlayment, flashing, vents, gutters.
- Electrical: counts of receptacles, GFCI/AFCI, switches (single, 3-way, dimmer), light fixtures by type, recessed cans, fans, smoke/CO detectors, low-voltage, panel size, dedicated appliance/EV/HVAC circuits.
- Plumbing: fixture counts (toilets, lavatory sinks, kitchen sink, tubs, showers, hose bibbs, laundry, dishwasher, disposal, water heater type), gas outlets.
- Cabinets: base, wall, tall cabinet linear feet; vanity LF; island; countertop SF or LF.
- Flooring: SF by material and room (tile, LVP, carpet, wood), plus wet-area wall tile SF if shown.
- Also windows/doors (counts by size/type from schedules), framing, drywall, insulation, siding, concrete, HVAC when the sheet shows them.

Rules:
- Read dimensions, room areas, schedules, legends, and general notes from the text layer and the images. Prefer stated numbers (area tables, schedules, dimension strings) over visual estimates.
- Count symbols carefully using the legend. The high-resolution quadrant images overlap slightly: do not double count symbols in the overlap.
- In "basis", say exactly how you got each number (e.g. "Living 18'-0\\" x 22'-6\\" = 405 SF", "counted 14 duplex receptacle symbols per legend").
- If a quantity is visible but cannot be determined, return quantity null with a basis explaining what is missing.
- Use low confidence for anything estimated from proportions rather than read or counted.
- Do not invent items the sheet does not show. A cover or detail sheet may legitimately have few or no findings.
- Use these categories where they fit: {CATEGORIES}.`

export async function POST(request: Request) {
  return handle(request, async (body: Body) => {
    if (!body?.overview || !Array.isArray(body.tiles)) throw new HttpError(400, "Missing page images.")
    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      { type: "text", text: `Sheet: PDF page ${body.page}. Full-sheet overview:` },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: body.overview } },
    ]
    for (const tile of body.tiles) {
      content.push({ type: "text", text: `High-resolution ${tile.label} quadrant:` })
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: tile.data } })
    }
    content.push({
      type: "text",
      text: [
        body.text ? `Text layer extracted from the PDF (may be empty for scanned sheets):\n<text_layer>\n${body.text}\n</text_layer>` : "This sheet has no text layer (scanned); read everything from the images.",
        body.projectNotes ? `Estimator notes for this project:\n${body.projectNotes}` : "",
        "Do the takeoff for this sheet.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    })
    const result = await structuredCall<Record<string, unknown>>({
      system: SYSTEM.replace("{CATEGORIES}", (body.categories ?? []).join(", ")),
      content,
      schema: PAGE_SCHEMA,
      effort: "high",
    })
    return { page: body.page, ...result }
  })
}
