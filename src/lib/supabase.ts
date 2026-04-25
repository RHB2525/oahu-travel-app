import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key)

export type Place = {
  id: string
  user_id: string
  name: string
  category: string
  lat: number
  lng: number
  notes: string | null
  hours: string | null
  cost: string | null
  photo_url: string | null
  google_place_id: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export type NewPlace = Omit<Place, "id" | "user_id" | "created_at" | "updated_at">

export type ItineraryStop = {
  id: string
  user_id: string
  date: string
  order_index: number
  place_id: string
  notes: string | null
  created_at: string
}

export type StopMemory = {
  id: string
  user_id: string
  stop_id: string
  storage_path: string
  caption: string | null
  recorded_at: string
  lat: number | null
  lng: number | null
  created_at: string
}
