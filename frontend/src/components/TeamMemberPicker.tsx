import { Checkbox } from "@/components/ui/checkbox"
import { useUsers } from "@/api/queries"

interface Props {
  value: string[]
  onChange: (ids: string[]) => void
  /** Usually the current user — hidden from the list since they're already implicitly involved. */
  excludeUserId?: string
}

/** Registered-user checklist for picking accompanying colleagues on an initiative or spend
 * request — deliberately a plain list (not a searchable combobox) since the org directory
 * is small; revisit if the user count grows large enough that scrolling a checklist stops
 * being the easiest way to find someone. */
export function TeamMemberPicker({ value, onChange, excludeUserId }: Props) {
  const { data: users, isLoading } = useUsers()
  const candidates = (users ?? []).filter((u) => u.id !== excludeUserId)

  const toggle = (userId: string, checked: boolean) => {
    onChange(checked ? [...value, userId] : value.filter((id) => id !== userId))
  }

  if (isLoading) {
    return <div className="my-2 h-20 w-full bg-muted motion-safe:animate-pulse" />
  }

  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">No other registered users yet.</p>
  }

  return (
    <div className="flex max-h-48 flex-col gap-2 overflow-y-auto border border-border bg-background p-3">
      {candidates.map((u) => {
        const checked = value.includes(u.id)
        return (
          <div
            key={u.id}
            role="checkbox"
            aria-checked={checked}
            tabIndex={0}
            onClick={() => toggle(u.id, !checked)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault()
                toggle(u.id, !checked)
              }
            }}
            className="flex cursor-pointer items-center gap-3 py-1"
          >
            <Checkbox checked={checked} className="pointer-events-none" tabIndex={-1} />
            <span className="text-sm">
              {u.display_name} <span className="text-muted-foreground">({u.email})</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function TeamMemberChips({ members }: { members: { id: string; display_name: string }[] }) {
  if (members.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => (
        <span key={m.id} className="border border-border bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
          {m.display_name}
        </span>
      ))}
    </div>
  )
}
