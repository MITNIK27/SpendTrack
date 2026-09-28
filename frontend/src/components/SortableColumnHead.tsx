import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { cn } from "cn"
import { TableHead } from "@/components/ui/table"

interface Props {
  label: string
  /** null = not the active sort column right now. */
  direction: "asc" | "desc" | null
  onClick: () => void
  className?: string
}

/** A table column header that's also its own sort toggle — click to cycle
 * through ascending → descending → off, the modern Notion/Airtable/Linear
 * table convention (sort lives on the column itself, not a separate
 * control above the table). */
export function SortableColumnHead({ label, direction, onClick, className }: Props) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 font-medium text-foreground hover:text-primary-text",
          direction && "text-primary-text"
        )}
      >
        {label}
        {direction === "asc" && <ArrowUp className="size-3.5" />}
        {direction === "desc" && <ArrowDown className="size-3.5" />}
        {!direction && <ArrowUpDown className="size-3.5 text-muted-foreground" />}
      </button>
    </TableHead>
  )
}
