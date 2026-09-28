import { TableHead } from "@/components/ui/table"
import { SearchableCombobox, type ComboboxOption } from "@/components/SearchableCombobox"

interface Props {
  value: string
  onChange: (id: string, label?: string) => void
  options: ComboboxOption[]
  query: string
  onQueryChange: (q: string) => void
  placeholder: string
  selectedLabel?: string
  emptyMessage?: string
  className?: string
}

/** A table column header that's a type-to-search filter — for a field with
 * too many distinct values to browse as a flat list (e.g. "Requested By"
 * across every reporter). Nothing is shown until you actually type; the
 * matching name comes up directly instead of scrolling a dropdown of
 * everyone. Same combobox already used on the Dashboard's Requester filter
 * (`RequesterCombobox.tsx`), just placed inside a column header. */
export function SearchableColumnHead({ className, ...comboboxProps }: Props) {
  return (
    <TableHead className={className}>
      <SearchableCombobox {...comboboxProps} />
    </TableHead>
  )
}
