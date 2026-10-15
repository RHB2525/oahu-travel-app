import Anthropic from "@anthropic-ai/sdk"

export const MODEL = "claude-opus-5-5"

let client: Anthropic | null = null
export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(500, "ANTHROPIC_API_KEY is not set on the server. Add it to .env.local (dev) or the Vercel project settings.")
  }
  client ??= new Anthropic()
  return client
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] }
const confidence = { type: "string", enum: ["low", "medium", "high"] }

export const PAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sheet_number", "sheet_title", "discipline", "scale_text", "findings", "notes"],
  properties: {
    sheet_number: { type: "string", description: "Sheet ID from the title block, e.g. A-101, E1.0. Empty if none." },
    sheet_title: { type: "string" },
    discipline: {
      type: "string",
      enum: ["cover", "site", "architectural", "structural", "roof", "electrical", "plumbing", "mechanical", "interior elevations / cabinets", "finish / schedules", "details", "other"],
    },
    scale_text: { type: "string", description: "Drawing scale as printed, e.g. 1/4\" = 1'-0\". Empty if none." },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "item", "quantity", "unit", "basis", "confidence"],
        properties: {
          category: { type: "string" },
          item: { type: "string" },
          quantity: nullableNumber,
          unit: { type: "string", enum: ["SF", "LF", "EA", "SQ", "SY", "CY", "LS", "HR", "ALLOW"] },
          basis: { type: "string", description: "How the number was derived: dimensions used, symbols counted, schedule rows." },
          confidence,
        },
      },
    },
    notes: { type: "string", description: "Specs, materials, finish selections, or anything an estimator should know." },
  },
} as const

export const CONSOLIDATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "lines", "questions"],
  properties: {
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["conditioned_sf", "garage_sf", "roof_area_sf", "roof_pitch", "stories", "bedrooms", "bathrooms"],
      properties: {
        conditioned_sf: nullableNumber,
        garage_sf: nullableNumber,
        roof_area_sf: nullableNumber,
        roof_pitch: { type: "string" },
        stories: nullableNumber,
        bedrooms: nullableNumber,
        bathrooms: nullableNumber,
      },
    },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "description", "quantity", "unit", "price_item_code", "basis", "confidence", "source_sheets"],
        properties: {
          category: { type: "string" },
          description: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string", enum: ["SF", "LF", "EA", "SQ", "SY", "CY", "LS", "HR", "ALLOW"] },
          price_item_code: { anyOf: [{ type: "string" }, { type: "null" }] },
          basis: { type: "string" },
          confidence,
          source_sheets: { type: "array", items: { type: "string" } },
        },
      },
    },
    questions: {
      type: "array",
      items: { type: "string" },
      description: "Items the estimator must verify or ask the client/designer about.",
    },
  },
} as const

/**
 * Runs one structured-output request and returns the parsed JSON.
 * Streams under the hood so long plan sheets don't hit HTTP timeouts.
 */
export async function structuredCall<T>(opts: {
  system: string
  content: Anthropic.Beta.BetaContentBlockParam[]
  schema: Record<string, unknown>
  effort: "low" | "medium" | "high" | "xhigh" | "max"
}): Promise<T> {
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort, format: { type: "json_schema", schema: opts.schema } },
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
  })
  const message = await stream.finalMessage()
  if (message.stop_reason === "refusal") {
    throw new HttpError(422, `The model declined this sheet${message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : "."}`)
  }
  if (message.stop_reason === "max_tokens") {
    throw new HttpError(502, "The response was cut off before it finished. Try fewer pages at a time.")
  }
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("")
  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpError(502, "The model returned output that could not be parsed.")
  }
}

export async function handle(request: Request, fn: (body: any) => Promise<unknown>): Promise<Response> {
  try {
    const body = await request.json()
    return Response.json(await fn(body))
  } catch (err) {
    if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status })
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Rate limited by the Claude API. Wait a minute and retry." }, { status: 429 })
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY." }, { status: 500 })
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: `Claude API error ${err.status ?? ""}: ${err.message}` }, { status: 502 })
    }
    console.error(err)
    return Response.json({ error: err instanceof Error ? err.message : "Unexpected error" }, { status: 500 })
  }
}
