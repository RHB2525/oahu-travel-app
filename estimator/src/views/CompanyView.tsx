import { Button, Card, Field, Input, Textarea } from "../components/ui"
import { DEFAULT_COMPANY, useCompany } from "../lib/store"
import type { Company } from "../lib/types"

export function CompanyView() {
  const [company, setCompany] = useCompany()
  const set = (change: Partial<Company>) => setCompany((c) => ({ ...c, ...change }))

  function onLogo(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set({ logoDataUrl: reader.result as string })
    reader.readAsDataURL(file)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold">Company</h1>
        <p className="text-sm text-slate-500">Shown on the header of every client proposal.</p>
      </div>
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company name">
            <Input value={company.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Contractor license #">
            <Input value={company.license} onChange={(e) => set({ license: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={company.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input value={company.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea rows={2} value={company.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="Logo" className="sm:col-span-2">
            <div className="flex items-center gap-3">
              {company.logoDataUrl && <img src={company.logoDataUrl} alt="Logo" className="max-h-16 max-w-[160px] rounded border border-slate-200 object-contain p-1" />}
              <input type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0])} className="text-sm" />
              {company.logoDataUrl && (
                <Button size="sm" variant="ghost" onClick={() => set({ logoDataUrl: null })}>
                  Remove
                </Button>
              )}
            </div>
          </Field>
          <Field label="Proposal terms" className="sm:col-span-2">
            <Textarea rows={6} value={company.terms} onChange={(e) => set({ terms: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <button className="text-xs text-slate-500 underline" onClick={() => set({ terms: DEFAULT_COMPANY.terms })}>
              Reset terms to default
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
