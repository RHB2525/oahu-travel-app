import { Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps"
import type { Place } from "@/lib/supabase"
import { DirectionsLayer } from "./DirectionsLayer"

const OAHU_CENTER = { lat: 21.48, lng: -157.97 }

export const CATEGORY_COLOR: Record<string, { bg: string; border: string; glyph: string }> = {
  stay: { bg: "#facc15", border: "#a16207", glyph: "#000" },
  beach: { bg: "#0ea5e9", border: "#0369a1", glyph: "#fff" },
  food: { bg: "#f97316", border: "#c2410c", glyph: "#fff" },
  hike: { bg: "#16a34a", border: "#15803d", glyph: "#fff" },
  snorkel: { bg: "#06b6d4", border: "#0e7490", glyph: "#fff" },
  view: { bg: "#a855f7", border: "#7e22ce", glyph: "#fff" },
  shop: { bg: "#ec4899", border: "#be185d", glyph: "#fff" },
  other: { bg: "#64748b", border: "#334155", glyph: "#fff" },
}

export default function HawaiiMap({
  places,
  selectedId,
  onSelect,
  directionsTo,
  homeBase,
  onRouteResult,
}: {
  places: Place[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  directionsTo: { lat: number; lng: number } | null
  homeBase: { lat: number; lng: number } | null
  onRouteResult: (route: { distanceText: string; durationText: string } | null) => void
}) {
  return (
    <Map
      defaultCenter={OAHU_CENTER}
      defaultZoom={10}
      gestureHandling="greedy"
      disableDefaultUI={false}
      mapId="hawaii-travel"
      className="h-full w-full"
      onClick={() => onSelect(null)}
    >
      {places.map((p) => {
        const c = CATEGORY_COLOR[p.category] ?? CATEGORY_COLOR.other
        const isSelected = p.id === selectedId
        return (
          <AdvancedMarker
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            title={p.name}
            onClick={() => onSelect(p.id)}
          >
            <Pin
              background={c.bg}
              borderColor={c.border}
              glyphColor={c.glyph}
              scale={isSelected ? 1.4 : 1.0}
            />
          </AdvancedMarker>
        )
      })}
      <DirectionsLayer
        origin={homeBase}
        destination={directionsTo}
        onResult={onRouteResult}
      />
    </Map>
  )
}
