export function uid(): string {
  return crypto.randomUUID()
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const money0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })

export const fmtMoney = (n: number) => money.format(Number.isFinite(n) ? n : 0)
export const fmtMoney0 = (n: number) => money0.format(Number.isFinite(n) ? n : 0)
export const fmtNum = (n: number) => num.format(Number.isFinite(n) ? n : 0)

export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const n = parseFloat(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? n : 0
}

/** Parses "12", "12.5", "12'", "12' 6\"", "12-6", "12'6" into decimal feet. */
export function parseFeet(input: string): number | null {
  const s = input.trim()
  if (!s) return null
  const ftIn = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|-|\s)\s*(\d+(?:\.\d+)?)?\s*(?:"|in)?$/i)
  if (ftIn) return parseFloat(ftIn[1]) + (ftIn[2] ? parseFloat(ftIn[2]) / 12 : 0)
  const inchesOnly = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in)$/i)
  if (inchesOnly) return parseFloat(inchesOnly[1]) / 12
  const plain = parseFloat(s)
  return Number.isFinite(plain) ? plain : null
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFilename(name: string) {
  return name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "estimate"
}
