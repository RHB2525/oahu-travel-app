import { useEffect, useState } from "react"
import { useMapsLibrary } from "@vis.gl/react-google-maps"
import type { Place } from "@/lib/supabase"

export function DayDriveTime({
  homeBase,
  stops,
}: {
  homeBase: Place
  stops: Place[]
}) {
  const routesLib = useMapsLibrary("routes")
  const [duration, setDuration] = useState<string | null>(null)
  const [errored, setErrored] = useState(false)

  const key = stops.map((s) => s.id).join(",")

  useEffect(() => {
    if (!routesLib || stops.length === 0) {
      setDuration(null)
      return
    }
    let cancelled = false
    const service = new routesLib.DirectionsService()
    const origin = { lat: homeBase.lat, lng: homeBase.lng }
    const destination = origin
    const waypoints = stops.map((s) => ({
      location: { lat: s.lat, lng: s.lng },
      stopover: true,
    }))
    service
      .route({
        origin,
        destination,
        waypoints,
        travelMode: routesLib.TravelMode.DRIVING,
        optimizeWaypoints: false,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res: any) => {
        if (cancelled) return
        const totalSec =
          res?.routes?.[0]?.legs?.reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sum: number, leg: any) => sum + (leg.duration?.value ?? 0),
            0
          ) ?? 0
        const hrs = Math.floor(totalSec / 3600)
        const mins = Math.round((totalSec % 3600) / 60)
        setDuration(hrs > 0 ? `${hrs}h ${mins}m drive` : `${mins}m drive`)
      })
      .catch(() => {
        if (!cancelled) setErrored(true)
      })
    return () => {
      cancelled = true
    }
  }, [routesLib, key, homeBase.lat, homeBase.lng])

  if (errored) return <span className="text-destructive">drive time err</span>
  if (!duration) return <span className="opacity-60">…</span>
  return <span>{duration}</span>
}
