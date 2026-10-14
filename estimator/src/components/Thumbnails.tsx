import clsx from "clsx"
import { useEffect, useState } from "react"
import { renderToCanvas, type PDFDocumentProxy } from "../lib/pdf"

/** Page strip; thumbnails render one at a time so a 60-sheet set doesn't stall the UI. */
export function Thumbnails({
  doc,
  current,
  onSelect,
  badges,
}: {
  doc: PDFDocumentProxy
  current: number
  onSelect: (page: number) => void
  badges: Record<number, string>
}) {
  const [thumbs, setThumbs] = useState<Record<number, string>>({})

  useEffect(() => {
    let cancelled = false
    setThumbs({})
    void (async () => {
      for (let i = 1; i <= doc.numPages && !cancelled; i++) {
        const page = await doc.getPage(i)
        const vp = page.getViewport({ scale: 1 })
        const canvas = await renderToCanvas(page, 160 / Math.max(vp.width, vp.height))
        const url = canvas.toDataURL("image/jpeg", 0.7)
        canvas.width = canvas.height = 0
        if (!cancelled) setThumbs((t) => ({ ...t, [i]: url }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [doc])

  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: doc.numPages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          onClick={() => onSelect(n)}
          className={clsx(
            "block w-full rounded border-2 bg-white p-1 text-left",
            n === current ? "border-brand-500" : "border-transparent hover:border-slate-300",
          )}
        >
          {thumbs[n] ? (
            <img src={thumbs[n]} alt={`Page ${n}`} className="mx-auto max-h-24 w-auto" />
          ) : (
            <div className="h-16 animate-pulse rounded bg-slate-100" />
          )}
          <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-slate-600">
            <span>p. {n}</span>
            {badges[n] && <span className="truncate font-medium text-slate-800">{badges[n]}</span>}
          </div>
        </button>
      ))}
    </div>
  )
}
