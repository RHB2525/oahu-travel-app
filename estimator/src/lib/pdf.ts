import * as pdfjs from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type { PDFDocumentProxy, PDFPageProxy }

export async function loadPdf(blob: Blob): Promise<PDFDocumentProxy> {
  const data = new Uint8Array(await blob.arrayBuffer())
  return pdfjs.getDocument({ data }).promise
}

/** Renders a page into a fresh canvas at the given zoom (1 = 72 dpi). */
export async function renderToCanvas(page: PDFPageProxy, zoom: number, canvas = document.createElement("canvas")) {
  const viewport = page.getViewport({ scale: zoom })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const task = page.render({ canvasContext: canvas.getContext("2d")!, viewport })
  await task.promise
  return canvas
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function canvasToJpegBase64(canvas: HTMLCanvasElement, quality: number) {
  return canvas.toDataURL("image/jpeg", quality).split(",")[1]
}

/** Long edge (px) for images sent to the model; larger images get downscaled on its side anyway. */
const AI_IMAGE_EDGE = 1568
/** Roughly how many inches of paper each zoomed section covers (~105 dpi at AI_IMAGE_EDGE). */
const SECTION_INCHES = 15
/** Stay well under the 4.5 MB request-body limit of Vercel functions (base64 characters). */
const PAYLOAD_BUDGET = 3_600_000

/**
 * Images of one sheet for the AI takeoff: a full-sheet overview, plus (in high-detail mode)
 * overlapping zoomed sections sized to the paper so small notes, dimensions and symbols stay
 * legible. Big sheets (36x24, 42x30) get a 3x2 grid; letter-size sheets need none.
 * JPEG quality steps down only if the request would be too large to upload.
 */
export async function pageImagesForAi(page: PDFPageProxy, highDetail: boolean) {
  const base = page.getViewport({ scale: 1 })
  const overviewCanvas = await renderToCanvas(page, AI_IMAGE_EDGE / Math.max(base.width, base.height))

  const sections: { label: string; canvas: HTMLCanvasElement }[] = []
  const cols = Math.ceil(base.width / 72 / SECTION_INCHES)
  const rows = Math.ceil(base.height / 72 / SECTION_INCHES)
  if (highDetail && cols * rows > 1) {
    const overlap = 0.06
    const secW = cols > 1 ? (base.width / cols) * (1 + overlap) : base.width
    const secH = rows > 1 ? (base.height / rows) * (1 + overlap) : base.height
    const full = await renderToCanvas(page, AI_IMAGE_EDGE / Math.max(secW, secH))
    const z = full.width / base.width
    const tw = Math.min(full.width, Math.ceil(secW * z))
    const th = Math.min(full.height, Math.ceil(secH * z))
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sx = cols > 1 ? Math.round(((full.width - tw) * c) / (cols - 1)) : 0
        const sy = rows > 1 ? Math.round(((full.height - th) * r) / (rows - 1)) : 0
        const tile = document.createElement("canvas")
        tile.width = tw
        tile.height = th
        tile.getContext("2d")!.drawImage(full, sx, sy, tw, th, 0, 0, tw, th)
        sections.push({ label: `row ${r + 1} of ${rows}, column ${c + 1} of ${cols}`, canvas: tile })
      }
    }
    full.width = full.height = 0
  }

  let result = { overview: "", tiles: [] as { label: string; data: string }[] }
  for (const quality of [0.82, 0.7, 0.58, 0.46]) {
    result = {
      overview: canvasToJpegBase64(overviewCanvas, quality),
      tiles: sections.map((s) => ({ label: s.label, data: canvasToJpegBase64(s.canvas, quality) })),
    }
    const size = result.overview.length + result.tiles.reduce((sum, t) => sum + t.data.length, 0)
    if (size <= PAYLOAD_BUDGET) break
  }
  overviewCanvas.width = overviewCanvas.height = 0
  sections.forEach((s) => (s.canvas.width = s.canvas.height = 0))
  return result
}

/** Text drawn on the page (CAD exports carry dimensions, schedules and notes as real text). */
export async function pageText(page: PDFPageProxy): Promise<string> {
  const content = await page.getTextContent()
  const parts: string[] = []
  for (const item of content.items) {
    if ("str" in item && item.str.trim()) parts.push(item.str)
  }
  return parts.join(" ").replace(/\s+/g, " ").slice(0, 20000)
}

export const COMMON_SCALES: { label: string; feetPerPaperInch: number }[] = [
  { label: '1/16" = 1\'-0"', feetPerPaperInch: 16 },
  { label: '3/32" = 1\'-0"', feetPerPaperInch: 32 / 3 },
  { label: '1/8" = 1\'-0"', feetPerPaperInch: 8 },
  { label: '3/16" = 1\'-0"', feetPerPaperInch: 16 / 3 },
  { label: '1/4" = 1\'-0"', feetPerPaperInch: 4 },
  { label: '3/8" = 1\'-0"', feetPerPaperInch: 8 / 3 },
  { label: '1/2" = 1\'-0"', feetPerPaperInch: 2 },
  { label: '3/4" = 1\'-0"', feetPerPaperInch: 4 / 3 },
  { label: '1" = 1\'-0"', feetPerPaperInch: 1 },
  { label: '1" = 10\'', feetPerPaperInch: 10 },
  { label: '1" = 20\'', feetPerPaperInch: 20 },
  { label: '1" = 30\'', feetPerPaperInch: 30 },
  { label: '1" = 40\'', feetPerPaperInch: 40 },
  { label: '1" = 50\'', feetPerPaperInch: 50 },
]
