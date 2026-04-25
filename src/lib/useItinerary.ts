import { useCallback, useEffect, useState } from "react"
import { supabase, type ItineraryStop } from "./supabase"

const sortStops = (a: ItineraryStop, b: ItineraryStop) => {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return a.order_index - b.order_index
}

export function useItinerary() {
  const [stops, setStops] = useState<ItineraryStop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("itinerary_stops")
      .select("*")
      .order("date")
      .order("order_index")
    if (error) setError(error.message)
    else setStops(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addStop = useCallback(
    async (input: { place_id: string; date: string; notes?: string | null }) => {
      const sameDay = stops.filter((s) => s.date === input.date)
      const order = sameDay.length
        ? Math.max(...sameDay.map((s) => s.order_index)) + 1
        : 0
      const { data, error } = await supabase
        .from("itinerary_stops")
        .insert({
          place_id: input.place_id,
          date: input.date,
          order_index: order,
          notes: input.notes ?? null,
        })
        .select()
        .single()
      if (error) {
        setError(error.message)
        return null
      }
      setStops((prev) => [...prev, data as ItineraryStop].sort(sortStops))
      return data as ItineraryStop
    },
    [stops]
  )

  const removeStop = useCallback(async (id: string) => {
    const { error } = await supabase.from("itinerary_stops").delete().eq("id", id)
    if (error) {
      setError(error.message)
      return
    }
    setStops((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const moveStop = useCallback(
    async (id: string, direction: "up" | "down") => {
      const stop = stops.find((s) => s.id === id)
      if (!stop) return
      const sameDay = stops
        .filter((s) => s.date === stop.date)
        .sort((a, b) => a.order_index - b.order_index)
      const idx = sameDay.findIndex((s) => s.id === id)
      const swapIdx = direction === "up" ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= sameDay.length) return
      const other = sameDay[swapIdx]
      // Swap order_index values
      await supabase
        .from("itinerary_stops")
        .update({ order_index: -1 })
        .eq("id", stop.id)
      await supabase
        .from("itinerary_stops")
        .update({ order_index: stop.order_index })
        .eq("id", other.id)
      await supabase
        .from("itinerary_stops")
        .update({ order_index: other.order_index })
        .eq("id", stop.id)
      await refresh()
    },
    [stops, refresh]
  )

  return { stops, loading, error, addStop, removeStop, moveStop, refresh }
}
