import { useEffect, useRef, useState } from "react"
import { useMapsLibrary } from "@vis.gl/react-google-maps"
import { X } from "lucide-react"
import type { NewPlace, Place } from "@/lib/supabase"

const CATEGORIES = [
  { id: "beach", label: "Beach" },
  { id: "food", label: "Food" },
  { id: "hike", label: "Hike" },
  { id: "snorkel", label: "Snorkel" },
  { id: "view", label: "View" },
  { id: "shop", label: "Shop" },
  { id: "stay", label: "Stay" },
  { id: "other", label: "Other" },
]

const OAHU_BOUNDS = {
  north: 21.75,
  south: 21.20,
  east: -157.60,
  west: -158.35,
}

type Suggestion = {
  text: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  placePrediction: any
}

type SelectedPlace = {
  name: string
  lat: number
  lng: number
  address: string | null
  google_place_id: string
  hours: string | null
}

export function AddPlaceSheet({
  open,
  onClose,
  addPlace,
}: {
  open: boolean
  onClose: () => void
  addPlace: (p: NewPlace) => Promise<Place | null>
}) {
  const placesLib = useMapsLibrary("places")
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<SelectedPlace | null>(null)
  const [category, setCategory] = useState("other")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokenRef = useRef<any>(null)

  useEffect(() => {
    if (!open) {
      setQuery("")
      setSuggestions([])
      setSelected(null)
      setNotes("")
      setCategory("other")
      setSearchError(null)
      tokenRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!placesLib || !query || query.length < 2 || selected) {
      setSuggestions([])
      return
    }
    if (!tokenRef.current) {
      tokenRef.current = new placesLib.AutocompleteSessionToken()
    }
    const timer = setTimeout(async () => {
      try {
        setSearchError(null)
        const { suggestions: fetched } =
          await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            sessionToken: tokenRef.current,
            locationRestriction: OAHU_BOUNDS,
          })
        setSuggestions(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (fetched ?? []).map((s: any) => ({
            text: s.placePrediction?.text?.text ?? "",
            placePrediction: s.placePrediction,
          }))
        )
      } catch (e) {
        console.error("autocomplete error", e)
        setSearchError(
          "Search failed. Make sure Places API (New) is enabled in Google Cloud."
        )
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, placesLib, selected])

  const selectSuggestion = async (s: Suggestion) => {
    if (!s.placePrediction) return
    try {
      const place = s.placePrediction.toPlace()
      await place.fetchFields({
        fields: ["displayName", "location", "formattedAddress", "regularOpeningHours", "id"],
      })
      setSelected({
        name: place.displayName ?? s.text,
        lat: place.location?.lat() ?? 0,
        lng: place.location?.lng() ?? 0,
        address: place.formattedAddress ?? null,
        google_place_id: place.id ?? "",
        hours: place.regularOpeningHours?.weekdayDescriptions?.join("; ") ?? null,
      })
      setQuery(place.displayName ?? s.text)
      setSuggestions([])
    } catch (e) {
      console.error("place details error", e)
      setSearchError("Couldn't load place details.")
    }
  }

  const submit = async () => {
    if (!selected) return
    setSaving(true)
    await addPlace({
      ...selected,
      category,
      notes: notes || null,
      cost: null,
      photo_url: null,
    })
    setSaving(false)
    onClose()
  }

  if (!open) return null

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
          <h2 className="font-semibold text-lg">Add a place</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(null)
          }}
          placeholder="Search O‘ahu — beaches, restaurants, sights…"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-2"
          autoFocus
        />

        {searchError && (
          <div className="text-xs text-destructive mb-2 px-1">{searchError}</div>
        )}

        {suggestions.length > 0 && (
          <ul className="border rounded-md mb-3 max-h-60 overflow-y-auto bg-background">
            {suggestions.map((s, i) => (
              <li
                key={i}
                onClick={() => selectSuggestion(s)}
                className="px-3 py-2 hover:bg-accent cursor-pointer text-sm border-b last:border-0"
              >
                {s.text}
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <div className="text-xs text-muted-foreground mb-3 px-1">{selected.address}</div>
        )}

        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">Category</label>
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`px-3 py-1 rounded-md text-xs border ${
                  category === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tip, reminder, what to order…"
            className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          disabled={!selected || saving}
          onClick={submit}
          className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : selected ? "Save place" : "Pick a place from search"}
        </button>
      </div>
    </div>
  )
}
