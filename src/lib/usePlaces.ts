import { useEffect, useState, useCallback } from "react"
import { supabase, type Place, type NewPlace } from "./supabase"

export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("places")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) setError(error.message)
    else setPlaces(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addPlace = useCallback(async (p: NewPlace) => {
    const { data, error } = await supabase.from("places").insert(p).select().single()
    if (error) {
      setError(error.message)
      return null
    }
    setPlaces((prev) => [data as Place, ...prev])
    return data as Place
  }, [])

  const removePlace = useCallback(async (id: string) => {
    const { error } = await supabase.from("places").delete().eq("id", id)
    if (error) {
      setError(error.message)
      return false
    }
    setPlaces((prev) => prev.filter((p) => p.id !== id))
    return true
  }, [])

  return { places, loading, error, refresh, addPlace, removePlace }
}
