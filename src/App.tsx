import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react"
import { APIProvider } from "@vis.gl/react-google-maps"
import { Plus, LogOut } from "lucide-react"
import HawaiiMap from "@/components/HawaiiMap"
import { AddPlaceSheet } from "@/components/AddPlaceSheet"
import { PlaceDetailSheet } from "@/components/PlaceDetailSheet"
import { ItineraryView } from "@/components/ItineraryView"
import { AddStopSheet } from "@/components/AddStopSheet"
import { LoginScreen } from "@/components/LoginScreen"
import { AddMemorySheet } from "@/components/AddMemorySheet"
import { MemoryGallery } from "@/components/MemoryGallery"
import { usePlaces } from "@/lib/usePlaces"
import { useItinerary } from "@/lib/useItinerary"
import { useMemories } from "@/lib/useMemories"
import { useAuth } from "@/lib/useAuth"
import type { StopMemory } from "@/lib/supabase"

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

type Tab = "map" | "trip"

export default function App() {
  const { session, loading: authLoading, signOut } = useAuth()

  if (authLoading) {
    return <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
  }
  if (!session) {
    return <LoginScreen />
  }
  return <AuthedApp signOut={signOut} />
}

function AuthedApp({ signOut }: { signOut: () => void }) {
  const [tab, setTab] = useState<Tab>("map")
  const [placeSheetOpen, setPlaceSheetOpen] = useState(false)
  const [stopSheetOpen, setStopSheetOpen] = useState(false)
  const [stopSheetDate, setStopSheetDate] = useState<string | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showingDirections, setShowingDirections] = useState(false)
  const [routeInfo, setRouteInfo] = useState<{ distanceText: string; durationText: string } | null>(null)
  const { places, addPlace, removePlace } = usePlaces()
  const { stops, addStop, removeStop, moveStop } = useItinerary()
  const { memories, urls: memoryUrls, addMemory, removeMemory } = useMemories()

  const [captureStopId, setCaptureStopId] = useState<string | null>(null)
  const [captureFile, setCaptureFile] = useState<File | null>(null)
  const [galleryStopId, setGalleryStopId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const memoriesByStop = useMemo(() => {
    const m = new Map<string, StopMemory[]>()
    memories.forEach((mem) => {
      const arr = m.get(mem.stop_id) ?? []
      arr.push(mem)
      m.set(mem.stop_id, arr)
    })
    return m
  }, [memories])

  const triggerCapture = useCallback((stopId: string) => {
    setCaptureStopId(stopId)
    fileInputRef.current?.click()
  }, [])

  const onFilePicked = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setCaptureFile(file)
    e.target.value = ""
  }, [])

  const closeCapture = useCallback(() => {
    setCaptureFile(null)
    setCaptureStopId(null)
  }, [])

  const saveMemory = useCallback(
    async (caption: string | null) => {
      if (!captureStopId || !captureFile) return
      await addMemory({ stop_id: captureStopId, file: captureFile, caption })
      closeCapture()
    },
    [captureStopId, captureFile, addMemory, closeCapture]
  )

  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedId) ?? null,
    [places, selectedId]
  )

  const homeBase = useMemo(
    () => places.find((p) => p.category === "stay") ?? null,
    [places]
  )

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id)
    setShowingDirections(false)
    setRouteInfo(null)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedId(null)
    setShowingDirections(false)
    setRouteInfo(null)
  }, [])

  const handleDelete = useCallback(async () => {
    if (!selectedPlace) return
    await removePlace(selectedPlace.id)
    handleClose()
  }, [selectedPlace, removePlace, handleClose])

  const openAddStop = useCallback((date?: string) => {
    setStopSheetDate(date)
    setStopSheetOpen(true)
  }, [])

  const directionsTo = showingDirections && selectedPlace
    ? { lat: selectedPlace.lat, lng: selectedPlace.lng }
    : null

  const homeBaseCoords = homeBase ? { lat: homeBase.lat, lng: homeBase.lng } : null

  if (!API_KEY) {
    return (
      <div className="p-6 text-sm">
        Missing <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env.local</code>
      </div>
    )
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <div className="h-full w-full flex flex-col">
        <header className="border-b bg-card">
          <div className="px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-semibold">O‘ahu Travel</h1>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {places.length} place{places.length === 1 ? "" : "s"}
              </span>
              <button
                onClick={signOut}
                aria-label="Sign out"
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex border-t">
            <button
              onClick={() => setTab("map")}
              className={`flex-1 py-2 text-sm font-medium ${
                tab === "map"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Map
            </button>
            <button
              onClick={() => setTab("trip")}
              className={`flex-1 py-2 text-sm font-medium ${
                tab === "trip"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Trip {stops.length > 0 && <span className="text-xs">({stops.length})</span>}
            </button>
          </div>
        </header>
        <main className="flex-1 relative overflow-hidden">
          <div className={`absolute inset-0 ${tab === "map" ? "" : "hidden"}`}>
            <HawaiiMap
              places={places}
              selectedId={selectedId}
              onSelect={handleSelect}
              directionsTo={directionsTo}
              homeBase={homeBaseCoords}
              onRouteResult={setRouteInfo}
            />
            <button
              onClick={() => setPlaceSheetOpen(true)}
              className="absolute bottom-6 right-6 z-10 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-transform"
              aria-label="Add a place"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
          <div className={`absolute inset-0 ${tab === "trip" ? "" : "hidden"}`}>
            <ItineraryView
              stops={stops}
              places={places}
              homeBase={homeBase}
              memoriesByStop={memoriesByStop}
              memoryUrls={memoryUrls}
              onAddStop={openAddStop}
              onRemoveStop={removeStop}
              onMoveStop={moveStop}
              onCapture={triggerCapture}
              onOpenGallery={setGalleryStopId}
            />
          </div>
        </main>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFilePicked}
          className="hidden"
        />
        <AddPlaceSheet
          open={placeSheetOpen}
          onClose={() => setPlaceSheetOpen(false)}
          addPlace={addPlace}
        />
        <AddStopSheet
          open={stopSheetOpen}
          onClose={() => setStopSheetOpen(false)}
          onAdd={addStop}
          places={places}
          initialDate={stopSheetDate}
        />
        <PlaceDetailSheet
          place={selectedPlace}
          homeBase={homeBase}
          routeInfo={routeInfo}
          showingDirections={showingDirections}
          onClose={handleClose}
          onDelete={handleDelete}
          onGetDirections={() => setShowingDirections(true)}
          onClearDirections={() => {
            setShowingDirections(false)
            setRouteInfo(null)
          }}
        />
        <MemoryGallery
          open={!!galleryStopId}
          memories={galleryStopId ? (memoriesByStop.get(galleryStopId) ?? []) : []}
          urls={memoryUrls}
          onClose={() => setGalleryStopId(null)}
          onDelete={removeMemory}
          onAddPhoto={() => {
            if (galleryStopId) triggerCapture(galleryStopId)
          }}
        />
        <AddMemorySheet
          open={!!captureFile}
          file={captureFile}
          onClose={closeCapture}
          onSave={saveMemory}
        />
      </div>
    </APIProvider>
  )
}
