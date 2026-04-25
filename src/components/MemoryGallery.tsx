import { useEffect, useState } from "react"
import { X, Trash2, Camera } from "lucide-react"
import type { StopMemory } from "@/lib/supabase"

export function MemoryGallery({
  open,
  memories,
  urls,
  onClose,
  onDelete,
  onAddPhoto,
}: {
  open: boolean
  memories: StopMemory[]
  urls: Record<string, string>
  onClose: () => void
  onDelete: (memory: StopMemory) => Promise<void>
  onAddPhoto: () => void
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (open) setIndex(0)
  }, [open, memories.length])

  if (!open || memories.length === 0) return null

  const current = memories[Math.min(index, memories.length - 1)]
  const url = urls[current.storage_path]

  const handleDelete = async () => {
    if (!confirm("Delete this photo?")) return
    await onDelete(current)
    setIndex((i) => Math.max(0, i - 1))
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm">
          {index + 1} / {memories.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onAddPhoto}
            aria-label="Add another photo"
            className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center"
          >
            <Camera className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            aria-label="Delete photo"
            className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close gallery"
            className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {url ? (
          <img
            src={url}
            alt={current.caption ?? "Memory"}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-white/70 text-sm">Loading…</div>
        )}
      </div>
      {current.caption && (
        <div className="p-4 text-white text-sm bg-black/50 max-h-32 overflow-y-auto">
          {current.caption}
        </div>
      )}
      {memories.length > 1 && (
        <div className="flex items-center justify-between p-3 text-white">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="px-4 py-2 disabled:opacity-30"
          >
            ← Prev
          </button>
          <button
            onClick={() => setIndex((i) => Math.min(memories.length - 1, i + 1))}
            disabled={index === memories.length - 1}
            className="px-4 py-2 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
