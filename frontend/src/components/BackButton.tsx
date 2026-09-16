import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

interface Props {
  /** Navigate to a specific route instead of the browser history — use this
   * whenever there's one correct place to go back to (e.g. a spend request's
   * own initiative), since history can be wrong if the page was reached via
   * search or a direct link rather than by drilling down. */
  to?: string
  label?: string
}

/** Consistent "go back" affordance for any page reached by drilling down from
 * somewhere else (a detail view, a form) — not for top-level pages already
 * reachable from the sidebar, which don't need one. */
export function BackButton({ to, label = "Back" }: Props) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="mb-3 flex items-center gap-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" /> {label}
    </button>
  )
}
