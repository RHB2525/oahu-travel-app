import { useEffect, useState } from "react"
import { X } from "lucide-react"
import type { Place } from "@/lib/supabase"
import { CATEGORY_COLOR } from "./HawaiiMap"

export function AddStopSheet({
  open,
  onClose,
  onAdd,
  places,
  initialDate,
}: {
  open: boolean
  onClose: () => void
  onAdd: (input: { place_id: string; date: string; notes: string | null }) => Promise<unknown>
  places: Place[]
  initialDate?: string
}) {
  const [date, setDate] = useState("")
  const [placeId, setPlaceId] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(initialDate || new Date().toISOString().slice(0, 10))
      setPlaceId("")
      setNotes("")
    }
  }, [open, initialDate])

  const submit = async () => {
    if (!placeId || !date) return
    setSaving(true)
    await onAdd({ place_id: placeId, date, notes: notes || null })
    setSaving(false)
    onClose()
  }

  if (!open) return null

  const selectablePlaces = places.filter((p) => p.category !== "stay")

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Add to itinerary</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">Place</label>
          {selectablePlaces.length === 0 ? (
            <div className="text-xs text-muted-foreground border rounded-md px-3 py-3">
              No places saved yet. Add some pins on the map first.
            </div>
          ) : (
            <ul className="border rounded-md max-h-60 overflow-y-auto">
              {selectablePlaces.map((p) => {
                const c = CATEGORY_COLOR[p.category] ?? CATEGORY_COLOR.other
                const isSelected = p.id === placeId
                return (
                  <li
                    key={p.id}
                    onClick={() => setPlaceId(p.id)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm border-b last:border-0 ${
                      isSelected ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    <span
                      className="block h-3 w-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: c.bg,
                        borderColor: c.border,
                        borderWidth: 1,
                        borderStyle: "solid",
                      }}
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{p.category}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What time? Any reminders…"
            className="w-full border rounded-md px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          disabled={!placeId || !date || saving}
          onClick={submit}
          className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Add stop"}
        </button>
      </div>
    </div>
  )
}
