import { Building2, Calculator, CircleHelp, FolderOpen, ListOrdered } from "lucide-react"
import clsx from "clsx"
import { href, useRoute } from "./lib/route"
import { ProjectsView } from "./views/ProjectsView"
import { ProjectView } from "./views/ProjectView"
import { PriceListView } from "./views/PriceListView"
import { CompanyView } from "./views/CompanyView"
import { HelpView } from "./views/HelpView"

export default function App() {
  const route = useRoute()
  const nav = [
    { to: href.projects(), label: "Projects", icon: FolderOpen, active: route.name === "projects" || route.name === "project" },
    { to: href.prices(), label: "Price List", icon: ListOrdered, active: route.name === "prices" },
    { to: href.company(), label: "Company", icon: Building2, active: route.name === "company" },
    { to: href.help(), label: "Help", icon: CircleHelp, active: route.name === "help" },
  ]
  return (
    <div className="flex min-h-full flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4">
          <a href={href.projects()} className="flex items-center gap-2 font-semibold text-brand-700">
            <Calculator size={20} />
            <span className="hidden sm:inline">Home Construction Estimator</span>
          </a>
          <nav className="ml-auto flex gap-1">
            {nav.map((n) => (
              <a
                key={n.to}
                href={n.to}
                className={clsx(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                  n.active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <n.icon size={16} />
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        {route.name === "projects" && <ProjectsView />}
        {route.name === "project" && <ProjectView key={route.id} id={route.id} tab={route.tab} panel={route.panel} />}
        {route.name === "prices" && <PriceListView />}
        {route.name === "company" && <CompanyView />}
        {route.name === "help" && <HelpView />}
      </main>
    </div>
  )
}
