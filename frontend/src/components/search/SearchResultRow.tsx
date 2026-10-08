import { InitiativeStatusBadge } from "@/components/InitiativeStatusBadge"
import { formatMoney } from "@/lib/money"
import type { SearchRequestResult } from "@/types/domain"

interface Props {
  result: SearchRequestResult
  onSelect: () => void
}

/** A single global-search hit — shared between the desktop inline dropdown
 * (GlobalSearch.tsx) and the mobile full-screen overlay (MobileSearchOverlay.tsx)
 * so both surfaces render results identically. */
export function SearchResultRow({ result, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full flex-col px-4 py-2 text-left text-sm hover:bg-secondary/50"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{result.name}</span>
        <InitiativeStatusBadge initiative={result} />
      </span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {result.category_name && <span>{result.category_name}</span>}
        {result.category_name && <span>·</span>}
        <span className="tabular-nums">{formatMoney(result.estimated_total_budget, result.currency)}</span>
        {result.owner_name && (<><span>·</span><span>{result.owner_name}</span></>)}
      </span>
    </button>
  )
}
