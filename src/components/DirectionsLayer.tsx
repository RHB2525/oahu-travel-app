import { useEffect, useRef } from "react"
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps"

export function DirectionsLayer({
  origin,
  destination,
  onResult,
}: {
  origin: { lat: number; lng: number } | null
  destination: { lat: number; lng: number } | null
  onResult: (route: { distanceText: string; durationText: string } | null) => void
}) {
  const map = useMap()
  const routesLib = useMapsLibrary("routes")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendererRef = useRef<any>(null)

  useEffect(() => {
    if (!map || !routesLib) return
    if (!rendererRef.current) {
      rendererRef.current = new routesLib.DirectionsRenderer({
        map,
        suppressMarkers: true,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: "#0ea5e9",
          strokeWeight: 5,
          strokeOpacity: 0.9,
        },
      })
    }
    const renderer = rendererRef.current

    if (!origin || !destination) {
      renderer.set("directions", null)
      onResult(null)
      return
    }

    const service = new routesLib.DirectionsService()
    service
      .route({
        origin,
        destination,
        travelMode: routesLib.TravelMode.DRIVING,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((result: any) => {
        renderer.setDirections(result)
        const leg = result?.routes?.[0]?.legs?.[0]
        if (leg) {
          onResult({
            distanceText: leg.distance?.text ?? "",
            durationText: leg.duration?.text ?? "",
          })
        } else {
          onResult(null)
        }
      })
      .catch((e: unknown) => {
        console.error("directions error", e)
        onResult(null)
      })
  }, [map, routesLib, origin?.lat, origin?.lng, destination?.lat, destination?.lng, onResult])

  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        rendererRef.current.setMap(null)
        rendererRef.current = null
      }
    }
  }, [])

  return null
}
