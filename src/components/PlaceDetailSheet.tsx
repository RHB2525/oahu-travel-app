import { X, Trash2, Navigation } from "lucide-react"
import type { Place } from "@/lib/supabase"
import { CATEGORY_COLOR } from "./HawaiiMap"

export function PlaceDetailSheet({
  place,
  homeBase,
  routeInfo,
  showingDirections,
  onClose,
  onDelete,
  onGetDirections,
  onClearDirections,
}: {
  place: Place | null
  homeBase: Place | null
  routeInfo: { distanceText: string; durationText: string } | null
  showingDirections: boolean
  onClose: () => void
  onDelete: () => void
  onGetDirections: () => void
  onClearDirections: () => void
}) {
  if (!place) return null

  const c = CATEGORY_COLOR[place.category] ?? CATEGORY_COLOR.other
  const isHome = place.category === "stay"

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 bg-card border-t shadow-2xl rounded-t-2xl max-h-[60vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, borderStyle: "solid" }}
            />
            <h2 className="font-semibold text-base truncate">{place.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="text-xs text-muted-foreground mb-2 capitalize">{place.category}</div>

        {place.address && (
          <div className="text-xs text-muted-foreground mb-2">{place.address}</div>
        )}

        {place.notes && (
          <p className="text-sm mb-3 whitespace-pre-wrap">{place.notes}</p>
        )}

        {place.hours && (
          <details className="text-xs text-muted-foreground mb-3">
            <summary className="cursor-pointer">Hours</summary>
            <div className="mt-1 whitespace-pre-line">{place.hours.replace(/; /g, "\n")}</div>
          </details>
        )}

        {showingDirections && routeInfo && (
          <div className="bg-primary/10 rounded-md px-3 py-2 mb-3 text-sm">
            <div className="font-medium">From {homeBase?.name ?? "home"}</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              {routeInfo.durationText} · {routeInfo.distanceText}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isHome && homeBase && !showingDirections && (
            <button
              onClick={onGetDirections}
              className="flex-1 bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium flex items-center justify-center gap-1.5"
            >
              <Navigation className="h-4 w-4" />
              Directions from {homeBase.name.split(",")[0]}
            </button>
          )}
          {showingDirections && (
            <button
              onClick={onClearDirections}
              className="flex-1 border rounded-md py-2 text-sm font-medium"
            >
              Clear route
            </button>
          )}
          {!isHome && (
            <button
              onClick={onDelete}
              aria-label="Delete place"
              className="border rounded-md py-2 px-3 text-destructive flex items-center justify-center"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
