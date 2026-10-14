import { Printer } from "lucide-react"
import { Button, Card, Field, Textarea } from "../components/ui"
import { projectTotals } from "../lib/calc"
import { fmtMoney } from "../lib/format"
import { href } from "../lib/route"
import { useCategories, useCompany } from "../lib/store"
import type { Project } from "../lib/types"
import type { UpdateProject } from "./ProjectView"

export function ProposalTab({ project, update }: { project: Project; update: UpdateProject }) {
  const [categories] = useCategories()
  const [company] = useCompany()
  const totals = projectTotals(project, categories)
  // Markups are spread across categories so the client sees all-in prices per trade.
  // Tax charged on the whole price is shown on its own line; materials tax is already inside each price.
  const showTaxLine = !totals.taxOnMaterials && totals.tax > 0
  const pre = showTaxLine ? totals.total - totals.tax : totals.total
  const setProposal = (change: Partial<Project["proposal"]>) => update((p) => ({ ...p, proposal: { ...p.proposal, ...change } }))
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 lg:grid-cols-[320px_1fr] print:block print:p-0">
      <div className="no-print space-y-4">
        <Card title="Proposal options">
          <div className="space-y-3">
            <Button variant="primary" className="w-full" onClick={() => window.print()}>
              <Printer size={16} /> Print / Save as PDF
            </Button>
            <p className="text-xs text-slate-500">In the print dialog choose "Save as PDF" as the destination.</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={project.proposal.showLineItems} onChange={(e) => setProposal({ showLineItems: e.target.checked })} />
              List scope items under each trade (no unit prices)
            </label>
            <Field label="Scope notes">
              <Textarea
                rows={5}
                value={project.proposal.scopeNotes}
                onChange={(e) => setProposal({ scopeNotes: e.target.value })}
                placeholder="Summary of work, finish level, allowances…"
              />
            </Field>
            <Field label="Exclusions">
              <Textarea
                rows={4}
                value={project.proposal.exclusions}
                onChange={(e) => setProposal({ exclusions: e.target.value })}
                placeholder="One per line, e.g. Landscaping&#10;Window coverings"
              />
            </Field>
            {!company.name && (
              <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">
                Add your company name, license and logo on the <a className="underline" href={href.company()}>Company</a> page.
              </p>
            )}
          </div>
        </Card>
      </div>

      <article className="print-page mx-auto w-full max-w-[8.5in] rounded-lg border border-slate-200 bg-white p-10 text-[13px] leading-relaxed text-slate-800 shadow-sm">
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
          <div className="flex items-start gap-4">
            {company.logoDataUrl && <img src={company.logoDataUrl} alt="" className="max-h-16 max-w-[160px] object-contain" />}
            <div>
              <p className="text-lg font-bold">{company.name || "Your Company"}</p>
              {company.license && <p>Lic. {company.license}</p>}
              {company.address && <p className="whitespace-pre-line">{company.address}</p>}
              <p>{[company.phone, company.email].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-wide">PROPOSAL</p>
            <p>No. {project.number}</p>
            <p>{today}</p>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prepared for</p>
            <p className="font-medium">{project.client.name || "—"}</p>
            {project.client.address && <p className="whitespace-pre-line">{project.client.address}</p>}
            <p>{[project.client.phone, project.client.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project</p>
            <p className="font-medium">{project.name}</p>
            {project.siteAddress && <p className="whitespace-pre-line">{project.siteAddress}</p>}
            {project.settings.conditionedSf > 0 && <p>{project.settings.conditionedSf.toLocaleString()} SF living area</p>}
          </div>
        </section>

        {project.proposal.scopeNotes && (
          <section className="avoid-break mt-5">
            <h3 className="mb-1 font-semibold">Scope of work</h3>
            <p className="whitespace-pre-line">{project.proposal.scopeNotes}</p>
          </section>
        )}

        <section className="mt-5">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1.5 font-semibold">Trade / Division</th>
                <th className="py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {totals.categories.map((c) => (
                <tr key={c.category} className="avoid-break border-b border-slate-100 align-top">
                  <td className="py-1.5 pr-4">
                    <p className="font-medium">{c.category}</p>
                    {project.proposal.showLineItems && (
                      <ul className="mt-0.5 list-disc pl-5 text-[12px] text-slate-600">
                        {project.lines
                          .filter((l) => l.category === c.category)
                          .map((l) => (
                            <li key={l.id}>{l.description}</li>
                          ))}
                      </ul>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{fmtMoney(c.sell)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="avoid-break">
              {showTaxLine && (
                <>
                  <tr>
                    <td className="pt-3 text-right font-medium">Subtotal</td>
                    <td className="pt-3 text-right tabular-nums">{fmtMoney(pre)}</td>
                  </tr>
                  <tr>
                    <td className="text-right">Tax ({project.settings.taxPct}%)</td>
                    <td className="text-right tabular-nums">{fmtMoney(totals.tax)}</td>
                  </tr>
                </>
              )}
              <tr>
                <td className="pt-2 text-right text-base font-bold">Total</td>
                <td className="pt-2 text-right text-base font-bold tabular-nums">{fmtMoney(totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {project.proposal.exclusions && (
          <section className="avoid-break mt-5">
            <h3 className="mb-1 font-semibold">Exclusions</h3>
            <ul className="list-disc pl-5">
              {project.proposal.exclusions
                .split("\n")
                .filter((x) => x.trim())
                .map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
            </ul>
          </section>
        )}

        {company.terms && (
          <section className="avoid-break mt-5">
            <h3 className="mb-1 font-semibold">Terms</h3>
            <p className="whitespace-pre-line text-[12px] text-slate-600">{company.terms}</p>
          </section>
        )}

        <section className="avoid-break mt-10 grid grid-cols-2 gap-10">
          {["Accepted by (Owner)", company.name || "Contractor"].map((who) => (
            <div key={who}>
              <div className="h-10 border-b border-slate-400" />
              <p className="mt-1 text-xs text-slate-600">{who}</p>
              <div className="mt-6 h-6 border-b border-slate-400" />
              <p className="mt-1 text-xs text-slate-600">Date</p>
            </div>
          ))}
        </section>
      </article>
    </div>
  )
}
