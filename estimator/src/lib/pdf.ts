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

/** Whole page as one JPEG whose long edge is at most maxEdge px. */
export async function pageToJpeg(page: PDFPageProxy, maxEdge: number, quality = 0.8) {
  const base = page.getViewport({ scale: 1 })
  const zoom = maxEdge / Math.max(base.width, base.height)
  const canvas = await renderToCanvas(page, zoom)
  const data = canvasToJpegBase64(canvas, quality)
  canvas.width = canvas.height = 0
  return data
}

/**
 * Splits the page into a 2x2 grid of overlapping, high-resolution JPEG crops so
 * small symbols (outlets, fixtures, dimension text) stay legible to the model.
 */
export async function pageToTiles(page: PDFPageProxy, tileEdge = 1600, quality = 0.82) {
  const base = page.getViewport({ scale: 1 })
  const overlap = 0.06
  const zoom = (tileEdge * 2 * (1 - overlap)) / Math.max(base.width, base.height)
  const full = await renderToCanvas(page, zoom)
  const tiles: { label: string; data: string }[] = []
  const tw = Math.ceil(full.width * (0.5 + overlap / 2))
  const th = Math.ceil(full.height * (0.5 + overlap / 2))
  const labels = [
    ["top-left", "top-right"],
    ["bottom-left", "bottom-right"],
  ]
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const sx = col === 0 ? 0 : full.width - tw
      const sy = row === 0 ? 0 : full.height - th
      const tile = document.createElement("canvas")
      tile.width = tw
      tile.height = th
      tile.getContext("2d")!.drawImage(full, sx, sy, tw, th, 0, 0, tw, th)
      tiles.push({ label: labels[row][col], data: canvasToJpegBase64(tile, quality) })
      tile.width = tile.height = 0
    }
  }
  full.width = full.height = 0
  return tiles
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
