import { useCallback, useEffect, useState } from "react"
import { supabase, type StopMemory } from "./supabase"
import { compressImage } from "./compressImage"

export function useMemories() {
  const [memories, setMemories] = useState<StopMemory[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("stop_memories")
      .select("*")
      .order("recorded_at", { ascending: false })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setMemories(data ?? [])

    if (data && data.length > 0) {
      const paths = data.map((m) => m.storage_path)
      const { data: signed } = await supabase.storage
        .from("trip-photos")
        .createSignedUrls(paths, 3600)
      const map: Record<string, string> = {}
      signed?.forEach((s, i) => {
        if (s.signedUrl) map[paths[i]] = s.signedUrl
      })
      setUrls(map)
    } else {
      setUrls({})
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addMemory = useCallback(
    async (input: { stop_id: string; file: File; caption: string | null }) => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) {
        setError("Not signed in")
        return null
      }

      const blob = await compressImage(input.file)
      const ext = "jpg"
      const path = `${userId}/${input.stop_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error: upErr } = await supabase.storage
        .from("trip-photos")
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: false,
        })
      if (upErr) {
        setError(upErr.message)
        return null
      }

      const coords = await getCurrentPosition()

      const { data, error } = await supabase
        .from("stop_memories")
        .insert({
          stop_id: input.stop_id,
          storage_path: path,
          caption: input.caption,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        })
        .select()
        .single()

      if (error) {
        setError(error.message)
        return null
      }

      const memory = data as StopMemory
      setMemories((prev) => [memory, ...prev])

      const { data: signed } = await supabase.storage
        .from("trip-photos")
        .createSignedUrl(path, 3600)
      if (signed?.signedUrl) {
        setUrls((prev) => ({ ...prev, [path]: signed.signedUrl }))
      }
      return memory
    },
    []
  )

  const removeMemory = useCallback(
    async (memory: StopMemory) => {
      await supabase.storage.from("trip-photos").remove([memory.storage_path])
      const { error } = await supabase.from("stop_memories").delete().eq("id", memory.id)
      if (error) {
        setError(error.message)
        return
      }
      setMemories((prev) => prev.filter((m) => m.id !== memory.id))
      setUrls((prev) => {
        const { [memory.storage_path]: _, ...rest } = prev
        return rest
      })
    },
    []
  )

  return { memories, urls, loading, error, addMemory, removeMemory, refresh }
}

function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60_000 }
    )
  })
}
