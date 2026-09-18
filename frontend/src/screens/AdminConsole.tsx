import { Tags } from "lucide-react"

export default function AdminConsole() {
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Admin</div>
        <h1 className="text-3xl font-bold">Admin Console</h1>
        <p className="mt-1 text-base text-muted-foreground">System configuration and reference data.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ComingSoonTile icon={Tags} title="Category Management" description="Manage the spend category taxonomy." />
      </div>
    </div>
  )
}

function ComingSoonTile({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Tags
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4 border border-border bg-card p-5">
      <div className="grid size-10 shrink-0 place-items-center bg-secondary">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-base font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Coming soon</p>
      </div>
    </div>
  )
}
