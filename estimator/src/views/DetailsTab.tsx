import { Card, Field, Input, NumberInput, Select, Textarea } from "../components/ui"
import type { ClientInfo, Project, TaxBasis } from "../lib/types"
import type { UpdateProject } from "./ProjectView"

export function DetailsTab({ project, update }: { project: Project; update: UpdateProject }) {
  const set = (change: Partial<Project>) => update((p) => ({ ...p, ...change }))
  const setClient = (change: Partial<ClientInfo>) => update((p) => ({ ...p, client: { ...p.client, ...change } }))
  const setSettings = (change: Partial<Project["settings"]>) => update((p) => ({ ...p, settings: { ...p.settings, ...change } }))

  return (
    <div className="mx-auto grid max-w-4xl gap-4 px-4 py-6 md:grid-cols-2">
      <Card title="Project">
        <div className="space-y-3">
          <Field label="Project name">
            <Input value={project.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Estimate number">
            <Input value={project.number} onChange={(e) => set({ number: e.target.value })} />
          </Field>
          <Field label="Site address">
            <Textarea rows={2} value={project.siteAddress} onChange={(e) => set({ siteAddress: e.target.value })} />
          </Field>
          <Field label="Living area (conditioned SF)" hint="Used for cost per square foot.">
            <NumberInput value={project.settings.conditionedSf} onCommit={(n) => setSettings({ conditionedSf: n })} />
          </Field>
        </div>
      </Card>
      <Card title="Client">
        <div className="space-y-3">
          <Field label="Name">
            <Input value={project.client.name} onChange={(e) => setClient({ name: e.target.value })} />
          </Field>
          <Field label="Mailing address">
            <Textarea rows={2} value={project.client.address} onChange={(e) => setClient({ address: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={project.client.phone} onChange={(e) => setClient({ phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={project.client.email} onChange={(e) => setClient({ email: e.target.value })} />
          </Field>
        </div>
      </Card>
      <Card title="Markups" className="md:col-span-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Overhead %">
            <NumberInput value={project.settings.overheadPct} onCommit={(n) => setSettings({ overheadPct: n })} />
          </Field>
          <Field label="Profit %">
            <NumberInput value={project.settings.profitPct} onCommit={(n) => setSettings({ profitPct: n })} />
          </Field>
          <Field label="Contingency %">
            <NumberInput value={project.settings.contingencyPct} onCommit={(n) => setSettings({ contingencyPct: n })} />
          </Field>
          <Field label="Sales tax %" hint="Georgetown, TX: 8.25% (6.25% state + 2% city).">
            <NumberInput value={project.settings.taxPct} onCommit={(n) => setSettings({ taxPct: n })} />
          </Field>
        </div>
        <Field label="How sales tax applies" className="mt-4">
          <Select value={project.settings.taxBasis} onChange={(e) => setSettings({ taxBasis: e.target.value as TaxBasis })}>
            <option value="materials">On materials only, as my cost (new residential, lump-sum contract)</option>
            <option value="total">On the whole price, charged to the client (e.g. separated remodel contract)</option>
          </Select>
        </Field>
        <p className="mt-2 text-xs text-slate-500">
          In Texas, new residential construction is usually a lump-sum contract: you pay sales tax when you buy materials and don't charge
          it on the contract price. Confirm with your accountant for remodel or commercial work.
        </p>
      </Card>
    </div>
  )
}
