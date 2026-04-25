import { useEffect, useRef, useState } from "react"
import { X, Mic, MicOff } from "lucide-react"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognition: any =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
  null

export function AddMemorySheet({
  open,
  file,
  onClose,
  onSave,
}: {
  open: boolean
  file: File | null
  onClose: () => void
  onSave: (caption: string | null) => Promise<void>
}) {
  const [caption, setCaption] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (open && file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setCaption("")
      return () => URL.revokeObjectURL(url)
    }
  }, [open, file])

  const toggleMic = () => {
    if (!SpeechRecognition) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.continuous = false
    recognition.interimResults = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setCaption((prev) => (prev ? prev + " " + transcript : transcript))
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  const submit = async (skipCaption = false) => {
    setSaving(true)
    await onSave(skipCaption ? null : caption.trim() || null)
    setSaving(false)
  }

  if (!open || !file) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60">
      <div className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-lg">Add a memory</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {previewUrl && (
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full max-h-60 object-cover rounded-md mb-3"
          />
        )}

        <div className="relative mb-3">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="The shave ice here was unreal…"
            className="w-full border rounded-md px-3 py-2 pr-12 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {SpeechRecognition && (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              className={`absolute top-2 right-2 h-9 w-9 rounded-full flex items-center justify-center ${
                listening ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-accent"
              }`}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
        </div>

        <button
          disabled={saving}
          onClick={() => submit(false)}
          className="w-full bg-primary text-primary-foreground rounded-md py-3 text-sm font-medium disabled:opacity-50 mb-2"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          disabled={saving}
          onClick={() => submit(true)}
          className="w-full text-xs text-muted-foreground py-1"
        >
          Skip caption
        </button>
      </div>
    </div>
  )
}
