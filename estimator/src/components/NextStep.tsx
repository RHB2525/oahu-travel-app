import clsx from "clsx"
import { ArrowRight, Check, ChevronDown, ChevronUp, Lightbulb } from "lucide-react"
import { useState } from "react"
import type { PDFDocumentProxy } from "../lib/pdf"
import { href } from "../lib/route"
import { usePriceList } from "../lib/store"
import type { Project } from "../lib/types"

interface Step {
  label: string
  done: boolean
  action: string
  to: string
  button: string
}

const COLLAPSE_KEY = "nextStepCollapsed"

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1"
  } catch {
    return false
  }
}

/** Works out where this job stands and points at the one thing to do next. */
export function projectSteps(project: Project, priceCount: number, hasPlans: boolean): Step[] {
  const id = project.id
  const consolidation = project.ai?.consolidation
  const unpriced = project.lines.filter((l) => l.material === 0 && l.labor === 0).length
  const aiUnmatched = project.lines.filter((l) => l.source === "ai" && !l.priceItemId).length

  let priceAction = `${unpriced} line${unpriced === 1 ? " has" : "s have"} no cost. Type the material and labor cost per unit on the Estimate tab.`
  let priceTo = href.project(id, "estimate")
  let priceButton = "Open Estimate"
  if (priceCount > 0 && consolidation && aiUnmatched > 0) {
    priceAction = `${unpriced} line${unpriced === 1 ? " has" : "s have"} no cost. If you imported your price list after the AI takeoff: open AI Takeoff, click Re-combine, then "Add lines to estimate" again. Anything still unmatched, price on the Estimate tab.`
    priceTo = href.project(id, "plans", "ai")
    priceButton = "Open AI Takeoff"
  }

  return [
    {
      label: "Upload plans",
      done: hasPlans,
      action: "Upload the PDF plan set (drag it onto the Plans & Takeoff tab).",
      to: href.project(id, "plans"),
      button: "Open Plans",
    },
    {
      label: "Price list",
      done: priceCount > 0,
      action:
        "Load your price list before the AI takeoff so its lines are priced automatically: Price List → Import CSV / Excel (download the Template there if you need one).",
      to: href.prices(),
      button: "Open Price List",
    },
    {
      label: "Take off",
      done: !!consolidation || project.measurements.length > 0 || project.lines.length > 0,
      action:
        'Open AI Takeoff (right side of Plans & Takeoff), keep High-detail mode on and click Analyze. You can switch pages while it runs; don\'t close the tab. Or measure by hand with the Length / Area / Count tools.',
      to: href.project(id, "plans", "ai"),
      button: "Open AI Takeoff",
    },
    {
      label: "Add lines",
      done: project.lines.length > 0,
      action: consolidation
        ? `Review the ${consolidation.lines.length} proposed lines in AI Takeoff (uncheck anything wrong) and click "Add lines to estimate".`
        : "Add lines on the Estimate tab, or link your measurements to estimate lines.",
      to: consolidation ? href.project(id, "plans", "ai") : href.project(id, "estimate"),
      button: consolidation ? "Open AI Takeoff" : "Open Estimate",
    },
    {
      label: "Price every line",
      done: project.lines.length > 0 && unpriced === 0,
      action: priceAction,
      to: priceTo,
      button: priceButton,
    },
    {
      label: "Client & markups",
      done: !!project.client.name.trim(),
      action: "Enter the client's name and address, then check overhead, profit, contingency and tax on Job Details.",
      to: href.project(id, "details"),
      button: "Open Job Details",
    },
    {
      label: "Proposal",
      done: false,
      action:
        'Check quantities against the plans, then open Proposal and click "Print / Save as PDF" to send it. Use Excel on the Estimate tab for your own records.',
      to: href.project(id, "proposal"),
      button: "Open Proposal",
    },
  ]
}

export function NextStep({ project, doc }: { project: Project; doc: PDFDocumentProxy | null }) {
  const [prices] = usePriceList()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const steps = projectSteps(project, prices.length, !!doc || !!project.pdfName)
  const nextIndex = steps.findIndex((s) => !s.done)
  const next = steps[nextIndex]

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1")
      } catch {
        /* storage unavailable: keep in memory only */
      }
      return !c
    })
  }

  return (
    <div className="no-print border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <Lightbulb size={16} className="shrink-0 text-amber-600" />
        <p className="min-w-0 flex-1 text-sm text-amber-950">
          <strong>
            Next step {nextIndex + 1} of {steps.length}: {next.label}.
          </strong>{" "}
          {next.action}
        </p>
        <a
          href={next.to}
          className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
        >
          {next.button} <ArrowRight size={14} />
        </a>
        <button
          onClick={toggle}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-amber-900 hover:bg-amber-100"
          aria-expanded={!collapsed}
        >
          {collapsed ? "Show all steps" : "Hide steps"} {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {!collapsed && (
        <ol className="mx-auto flex max-w-[1600px] flex-wrap gap-1.5 px-4 pb-2">
          {steps.map((s, i) => (
            <li key={s.label}>
              <a
                href={s.to}
                title={s.action}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                  s.done && "border-emerald-200 bg-emerald-50 text-emerald-800",
                  !s.done && i === nextIndex && "border-amber-500 bg-white font-semibold text-amber-900",
                  !s.done && i !== nextIndex && "border-amber-200 bg-white/60 text-slate-600",
                )}
              >
                {s.done ? <Check size={12} /> : <span className="tabular-nums">{i + 1}</span>}
                {s.label}
              </a>
            </li>
          ))}
          <li>
            <a href={href.help()} className="inline-flex items-center rounded-full px-2.5 py-1 text-xs text-amber-900 underline">
              Full instructions
            </a>
          </li>
        </ol>
      )}
    </div>
  )
}
