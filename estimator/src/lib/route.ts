import { useEffect, useState } from "react"

export type Route =
  | { name: "projects" }
  | { name: "prices" }
  | { name: "company" }
  | { name: "help" }
  | { name: "project"; id: string; tab: ProjectTab; panel?: "ai" }

export const PROJECT_TABS = ["plans", "estimate", "proposal", "details"] as const
export type ProjectTab = (typeof PROJECT_TABS)[number]

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean)
  if (parts[0] === "prices") return { name: "prices" }
  if (parts[0] === "company") return { name: "company" }
  if (parts[0] === "help") return { name: "help" }
  if (parts[0] === "p" && parts[1]) {
    const tab = (PROJECT_TABS as readonly string[]).includes(parts[2]) ? (parts[2] as ProjectTab) : "plans"
    return { name: "project", id: parts[1], tab, panel: parts[3] === "ai" ? "ai" : undefined }
  }
  return { name: "projects" }
}

export const href = {
  projects: () => "#/",
  prices: () => "#/prices",
  company: () => "#/company",
  help: () => "#/help",
  /** panel "ai" opens the AI Takeoff side panel on the Plans tab. */
  project: (id: string, tab: ProjectTab = "plans", panel?: "ai") => `#/p/${id}/${tab}${panel ? `/${panel}` : ""}`,
}

export function navigate(to: string) {
  window.location.hash = to
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash))
    window.addEventListener("hashchange", onChange)
    return () => window.removeEventListener("hashchange", onChange)
  }, [])
  return route
}
