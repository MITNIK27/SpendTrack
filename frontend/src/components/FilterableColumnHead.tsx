import { ListFilter } from "lucide-react"
import { cn } from "cn"
import { TableHead } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Option<T extends string> {
  value: T
  label: string
  count: number
  /** Solid-background utility class (e.g. "bg-chip-success-fg") for a small
   * color dot before the label — matches the same color language as the
   * status badge this filter narrows. Omit for a plain neutral dot. */
  dotClassName?: string
}

interface Props<T extends string> {
  label: string
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  className?: string
}

/** A table column header that's also its own filter — click the header to
 * open a dropdown of values with live counts, the modern Notion/Airtable/
 * Linear table convention (filtering lives on the column itself, not a
 * separate row of controls above the table). The header text stays
 * highlighted while a non-"all" value is active, so the filter is never
 * silently forgotten. */
export function FilterableColumnHead<T extends string>({ label, value, onChange, options, className }: Props<T>) {
  const active = value !== options[0]?.value
  return (
    <TableHead className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 font-medium text-foreground hover:text-primary-text",
              active && "text-primary-text"
            )}
          >
            {label}
            <ListFilter className={cn("size-3.5", active ? "text-primary-text" : "text-muted-foreground")} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[220px]">
          <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
            {options.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value} className="justify-between gap-6 py-1.5">
                <span className="flex items-center gap-2">
                  <span className={cn("size-1.5 shrink-0 rounded-full", o.dotClassName ?? "bg-muted-foreground")} />
                  {o.label}
                </span>
                <span className="tabular-nums text-muted-foreground">{o.count}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableHead>
  )
}
