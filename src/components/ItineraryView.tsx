import { useMemo, useState } from "react"
import { ChevronUp, ChevronDown, Trash2, Plus, Camera } from "lucide-react"
import type { ItineraryStop, Place, StopMemory } from "@/lib/supabase"
import { CATEGORY_COLOR } from "./HawaiiMap"
import { DayDriveTime } from "./DayDriveTime"

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}

export function ItineraryView({
  stops,
  places,
  homeBase,
  memoriesByStop,
  memoryUrls,
  onAddStop,
  onRemoveStop,
  onMoveStop,
  onCapture,
  onOpenGallery,
}: {
  stops: ItineraryStop[]
  places: Place[]
  homeBase: Place | null
  memoriesByStop: Map<string, StopMemory[]>
  memoryUrls: Record<string, string>
  onAddStop: (date?: string) => void
  onRemoveStop: (id: string) => void
  onMoveStop: (id: string, dir: "up" | "down") => void
  onCapture: (stopId: string) => void
  onOpenGallery: (stopId: string) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const placeById = useMemo(() => {
    const m = new Map<string, Place>()
    places.forEach((p) => m.set(p.id, p))
    return m
  }, [places])

  const stopsByDate = useMemo(() => {
    const grouped = new Map<string, ItineraryStop[]>()
    stops.forEach((s) => {
      if (!grouped.has(s.date)) grouped.set(s.date, [])
      grouped.get(s.date)!.push(s)
    })
    return Array.from(grouped.entries()).sort(([a], [b]) => (a < b ? -1 : 1))
  }, [stops])

  if (stops.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center h-full">
        <p className="text-muted-foreground text-sm mb-4">
          No days planned yet. Pick saved places and group them by day.
        </p>
        <button
          onClick={() => onAddStop()}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add first stop
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full pb-24">
      {stopsByDate.map(([date, dayStops]) => {
        const dayPlaces = dayStops
          .map((s) => placeById.get(s.place_id))
          .filter((p): p is Place => !!p)
        const expandedDay = expanded[date] !== false
        return (
          <section key={date} className="border rounded-lg bg-card overflow-hidden">
            <button
              onClick={() => setExpanded((e) => ({ ...e, [date]: !expandedDay }))}
              className="w-full flex justify-between items-center p-3 text-left"
            >
              <div>
                <div className="font-semibold text-sm">{formatDate(date)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {dayStops.length} stop{dayStops.length === 1 ? "" : "s"}
                  {homeBase && dayPlaces.length > 0 && (
                    <>
                      {" · "}
                      <DayDriveTime homeBase={homeBase} stops={dayPlaces} />
                    </>
                  )}
                </div>
              </div>
              {expandedDay ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {expandedDay && (
              <div className="border-t">
                {dayStops.map((s, idx) => {
                  const place = placeById.get(s.place_id)
                  if (!place) return null
                  const c = CATEGORY_COLOR[place.category] ?? CATEGORY_COLOR.other
                  const stopMemories = memoriesByStop.get(s.id) ?? []
                  const firstThumb = stopMemories[0]
                  const thumbUrl = firstThumb ? memoryUrls[firstThumb.storage_path] : undefined
                  return (
                    <div
                      key={s.id}
                      className="flex items-start gap-3 p-3 border-b last:border-b-0"
                    >
                      <div className="flex flex-col items-center pt-1">
                        <div className="text-xs text-muted-foreground w-5 text-center">
                          {idx + 1}
                        </div>
                        <span
                          className="block h-3 w-3 rounded-full mt-1"
                          style={{
                            backgroundColor: c.bg,
                            borderColor: c.border,
                            borderWidth: 1,
                            borderStyle: "solid",
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{place.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {place.category}
                          {place.address ? ` · ${place.address}` : ""}
                        </div>
                        {s.notes && (
                          <div className="text-xs mt-1 text-muted-foreground">{s.notes}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {stopMemories.length > 0 ? (
                          <button
                            onClick={() => onOpenGallery(s.id)}
                            aria-label={`Open ${stopMemories.length} photo${stopMemories.length === 1 ? "" : "s"}`}
                            className="relative h-11 w-11 rounded-md overflow-hidden border bg-muted"
                          >
                            {thumbUrl ? (
                              <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Camera className="h-4 w-4 m-auto" />
                            )}
                            {stopMemories.length > 1 && (
                              <span className="absolute bottom-0 right-0 bg-primary text-primary-foreground text-[10px] font-medium px-1 rounded-tl">
                                {stopMemories.length}
                              </span>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => onCapture(s.id)}
                            aria-label="Add a photo"
                            className="h-11 w-11 rounded-md border border-dashed flex items-center justify-center text-muted-foreground hover:bg-accent"
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                        )}
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => onMoveStop(s.id, "up")}
                            disabled={idx === 0}
                            aria-label="Move up"
                            className="p-1 disabled:opacity-30"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onMoveStop(s.id, "down")}
                            disabled={idx === dayStops.length - 1}
                            aria-label="Move down"
                            className="p-1 disabled:opacity-30"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onRemoveStop(s.id)}
                            aria-label="Remove stop"
                            className="p-1 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <button
                  onClick={() => onAddStop(date)}
                  className="w-full text-xs text-primary py-2 flex items-center justify-center gap-1 hover:bg-accent"
                >
                  <Plus className="h-3 w-3" />
                  Add stop to this day
                </button>
              </div>
            )}
          </section>
        )
      })}
      <button
        onClick={() => onAddStop()}
        className="w-full border-2 border-dashed rounded-lg py-3 text-sm text-muted-foreground flex items-center justify-center gap-1.5 hover:bg-accent"
      >
        <Plus className="h-4 w-4" />
        Add stop on a new day
      </button>
    </div>
  )
}
