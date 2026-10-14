import type { ReactNode } from "react"
import { Card } from "../components/ui"
import { href } from "../lib/route"

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">{children}</ol>
}

function Tip({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">{children}</p>
}

function Warn({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{children}</p>
}

const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-slate-900">{children}</strong>

export function HelpView() {
  const sections = [
    ["setup", "One-time setup"],
    ["job", "Estimating a job"],
    ["houses", "Several houses in one PDF"],
    ["manual", "Measuring by hand"],
    ["safe", "Keeping your work safe"],
    ["problems", "Fixing common problems"],
    ["units", "Units"],
  ]
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold">How to use the estimator</h1>
        <p className="text-sm text-slate-500">
          Inside each estimate, the yellow <B>Next step</B> bar always tells you what to do next. This page has the full instructions.
        </p>
        <nav className="mt-3 flex flex-wrap gap-2 text-sm">
          {sections.map(([id, label]) => (
            <a key={id} href={`#/help`} onClick={(e) => (e.preventDefault(), document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }))} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50">
              {label}
            </a>
          ))}
        </nav>
      </div>

      <Card title={<span id="setup">One-time setup</span>}>
        <Steps>
          <li>
            <B>Company:</B> open <a className="text-brand-700 underline" href={href.company()}>Company</a> and enter your name, license number,
            phone, address and logo. These print on every proposal.
          </li>
          <li>
            <B>Price list:</B> open <a className="text-brand-700 underline" href={href.prices()}>Price List</a>, click <B>Template</B> (or use
            the sample Excel file), fill in your <B>material</B> and <B>labor</B> cost per unit for each item, then click <B>Import CSV / Excel</B>.
            You only do this once; edit prices any time on the same page.
          </li>
          <li>
            <B>Categories (optional):</B> on Price List, click <B>Categories</B> to add trades such as a new type of custom upgrade, or change the
            order they appear on the estimate and proposal.
          </li>
        </Steps>
        <Tip>Load the price list before running the AI takeoff. The AI matches its lines to your item codes, so they come out priced.</Tip>
      </Card>

      <Card title={<span id="job">Estimating a job</span>}>
        <Steps>
          <li>
            <B>Create the estimate:</B> on <a className="text-brand-700 underline" href={href.projects()}>Projects</a> click <B>New estimate</B>,
            enter the name, client and address, and choose the plan set PDF.
          </li>
          <li>
            <B>Run the AI takeoff:</B> on <B>Plans &amp; Takeoff</B>, click <B>AI Takeoff</B> on the right. All sheets are selected; leave{" "}
            <B>High-detail mode</B> on. Optionally add notes the plans don't show (for example "standing seam metal roof, LVP throughout except
            tile in baths"). Click <B>Analyze</B>.
          </li>
          <li>
            <B>Wait:</B> each sheet takes about 30–90 seconds and three run at a time. You can look at other pages of the estimator while it
            works, but <B>don't close the browser tab</B>.
          </li>
          <li>
            <B>Review:</B> the AI lists proposed lines with the quantity, where it came from (sheet numbers), and a confidence level. Read the
            yellow <B>Verify / ask about</B> list. Uncheck anything wrong, then click <B>Add lines to estimate</B>.
          </li>
          <li>
            <B>Prices:</B> lines with a green price code are priced from your list. Lines marked <B>no price match</B> need a cost: either add
            that item to your price list, import it, then click <B>Re-combine</B> and <B>Add lines to estimate</B> again, or type the costs
            directly on the <B>Estimate</B> tab.
          </li>
          <li>
            <B>Check the estimate:</B> on the <B>Estimate</B> tab, fix any quantity by typing over it, change waste %, and add your own lines
            with <B>Add line</B> (for allowances or anything the plans don't show). Totals update instantly.
          </li>
          <li>
            <B>Markups and client:</B> on <B>Job Details</B>, enter the client and check overhead, profit, contingency and tax (O‘ahu GET
            4.712% by default).
          </li>
          <li>
            <B>Send it:</B> on <B>Proposal</B>, add scope notes and exclusions, then click <B>Print / Save as PDF</B> and choose "Save as PDF".
            For your own records, click <B>Excel</B> on the Estimate tab.
          </li>
        </Steps>
        <Warn>
          AI quantities are a first draft. Always check the big-dollar items (roof, flooring, cabinets) against the plans before sending a
          proposal. Low-confidence lines deserve the closest look.
        </Warn>
      </Card>

      <Card title={<span id="houses">Several houses in one PDF</span>}>
        <Steps>
          <li>
            On <B>Plans &amp; Takeoff</B>, click <B>Several houses in this PDF? Split them</B> (bottom right).
          </li>
          <li>Name each house (Plan A, Plan B…). Pick a house, then click its sheets. Shift-click selects a range.</li>
          <li>
            Mark sheets every house uses (cover, general notes, schedules) as <B>Shared by all</B>. Click <B>Create</B>.
          </li>
          <li>You get one estimate per house on the Projects page. Each one only shows and analyzes its own sheets.</li>
        </Steps>
        <Tip>
          To start a similar job from an existing one, click the copy icon next to it on the Projects page (<B>Duplicate</B>).
        </Tip>
      </Card>

      <Card title={<span id="manual">Measuring by hand</span>}>
        <Steps>
          <li>
            Click <B>Set scale</B>. Best: <B>Calibrate on sheet</B>, click both ends of a long dimension, and type its real length (for example
            24' 6"). Or pick the printed scale if the PDF is full size.
          </li>
          <li>
            Use <B>Length</B> (walls, eaves, ridges), <B>Area</B> (floors, roof planes, slabs) or <B>Count</B> (outlets, fixtures). Click
            points; double-click or press Enter to finish; Esc cancels; Backspace undoes a point.
          </li>
          <li>
            In the <B>Measurements</B> list, rename it and click <B>Link to estimate</B>. The linked line's quantity follows the measurement.
            Use the <B>×</B> multiplier for wall height (feet of wall → square feet) or both sides.
          </li>
        </Steps>
        <Tip>Ctrl / ⌘ + mouse wheel zooms. Drag with Pan to move around the sheet.</Tip>
      </Card>

      <Card title={<span id="safe">Keeping your work safe</span>}>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          <li>
            Your work saves automatically, but <B>only in this browser, at this exact web address</B>. Bookmark{" "}
            <B>{window.location.origin}</B> and always open it from that bookmark. A different address, another computer, or a private window
            starts empty.
          </li>
          <li>
            <B>Use one tab.</B> Two tabs on the same estimate can overwrite each other's changes.
          </li>
          <li>
            <B>Back up finished jobs:</B> on Projects, click the download icon next to an estimate. <B>Import backup</B> restores it on any
            computer (plans included).
          </li>
          <li>Clearing your browser's history and site data deletes saved estimates. Back up first.</li>
        </ul>
      </Card>

      <Card title={<span id="problems">Fixing common problems</span>}>
        <dl className="space-y-3 text-sm leading-relaxed text-slate-700">
          <div>
            <dt className="font-semibold text-slate-900">The estimate total is $0</dt>
            <dd>
              Lines have no cost. Import your price list, then on AI Takeoff click <B>Re-combine</B> and <B>Add lines to estimate</B> (keep
              "Replace lines from earlier AI runs" checked). Or type costs on the Estimate tab.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">"No price match" on a line</dt>
            <dd>Your price list has no item for that work. Add one (same unit), import, and Re-combine, or price the line by hand.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">My estimates disappeared</dt>
            <dd>
              Check the address bar: it must be the same address you used before (see "Keeping your work safe"). Open it from your bookmark.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">A sheet shows a red ✕ in AI Takeoff</dt>
            <dd>
              Hover over it to see the reason. Select just that sheet and click Analyze again. "Rate limited" means wait a minute and retry.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">A quantity looks wrong</dt>
            <dd>
              Open <B>Per-sheet findings</B> at the bottom of AI Takeoff to see how it was counted. Type the correct quantity on the Estimate
              tab, or measure it by hand and link the measurement.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">I changed prices but the estimate didn't change</dt>
            <dd>
              On the Estimate tab click <B>Update … lines to current prices</B>.
            </dd>
          </div>
        </dl>
      </Card>

      <Card title={<span id="units">Units</span>}>
        <dl className="grid grid-cols-[4rem_1fr] gap-x-3 gap-y-1 text-sm text-slate-700">
          <dt className="font-semibold">SF</dt>
          <dd>square feet</dd>
          <dt className="font-semibold">LF</dt>
          <dd>linear feet</dd>
          <dt className="font-semibold">EA</dt>
          <dd>each</dd>
          <dt className="font-semibold">SQ</dt>
          <dd>roofing square = 100 SF of roof</dd>
          <dt className="font-semibold">SY / CY</dt>
          <dd>square yard / cubic yard</dd>
          <dt className="font-semibold">LS</dt>
          <dd>lump sum (one price for the whole item)</dd>
          <dt className="font-semibold">ALLOW</dt>
          <dd>allowance (a budget amount, e.g. appliances)</dd>
          <dt className="font-semibold">HR</dt>
          <dd>hour</dd>
        </dl>
      </Card>
    </div>
  )
}
