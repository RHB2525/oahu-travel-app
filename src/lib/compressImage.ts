export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.85
): Promise<Blob> {
  const img = await loadImage(file)
  const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1)
  const w = Math.round(img.width * ratio)
  const h = Math.round(img.height * ratio)

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas 2d context unavailable")
  ctx.drawImage(img, 0, 0, w, h)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("compression failed"))),
      "image/jpeg",
      quality
    )
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}
