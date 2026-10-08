import { useState } from "react"
import { Check, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { RequesterCombobox } from "@/components/RequesterCombobox"
import { fiscalYearOptions, fyLabel } from "@/lib/fiscal"
import type { Category } from "@/types/domain"
import type { InitiativeOutcome } from "@/components/InitiativeStatusBadge"

export const ALL = "__all__"
export const ALL_TIME = "__all_time__"

export const QUARTERS = [
  { value: "1", label: "Q1 (Apr–Jun)" },
  { value: "2", label: "Q2 (Jul–Sep)" },
  { value: "3", label: "Q3 (Oct–Dec)" },
  { value: "4", label: "Q4 (Jan–Mar)" },
]

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

type SortBy = "date" | "name-asc" | "name-desc"

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "date", label: "Latest date" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
]

interface StatusOption {
  value: InitiativeOutcome | "all"
  label: string
  count: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  fiscalYear: string
  onFiscalYearChange: (v: string) => void
  quarter: string
  onQuarterChange: (v: string) => void
  month: string
  onMonthChange: (v: string) => void
  categoryId: string
  onCategoryIdChange: (v: string) => void
  categories: Category[] | undefined
  requesterId: string
  onRequesterIdChange: (v: string) => void
  statusFilter: InitiativeOutcome | "all"
  onStatusFilterChange: (v: InitiativeOutcome | "all") => void
  statusOptions: StatusOption[]
  sortBy: SortBy
  onSortByChange: (v: SortBy) => void
  onClear: () => void
  activeCount: number
  /** Member view: hides Fiscal Year/Quarter/Month/Requester (meaningless —
   * a member only ever sees their own requests, and "search by any member's
   * name" is reserved for approver/admin) — only Category/Status (+ Sort). */
  restrictedToBasicFilters?: boolean
}

/** Mobile "Filter & Sort" drawer — a shopping-app-style bottom sheet bundling
 * every filter (plus sort) the desktop version spreads across an inline bar
 * and clickable column headers, since there's no room for either on a phone
 * screen. */
export function RequestsFilterSheet({
  open,
  onOpenChange,
  fiscalYear,
  onFiscalYearChange,
  quarter,
  onQuarterChange,
  month,
  onMonthChange,
  categoryId,
  onCategoryIdChange,
  categories,
  requesterId,
  onRequesterIdChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  sortBy,
  onSortByChange,
  onClear,
  activeCount,
  restrictedToBasicFilters,
}: Props) {
  const [tab, setTab] = useState<"filter" | "sort">("filter")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-card text-muted-foreground lg:hidden">
          <SlidersHorizontal className="size-3.5" /> Filter & Sort
          {activeCount > 0 && (
            <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-4">
        <SheetTitle className="mb-3">Filter & Sort</SheetTitle>

        <div className="mb-4 flex gap-1 rounded-md border border-border bg-muted/40 p-0.5">
          {(["filter", "sort"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded py-1.5 text-sm font-medium capitalize transition-colors",
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Both panels occupy the same grid cell (overlaid) so the container
           sizes itself to the taller one (Filter) always — switching to the
           shorter Sort panel never shrinks the sheet, with no hardcoded
           height guess needed. The inactive panel is hidden via
           visibility/pointer-events, not removed from the layout. */}
        <div className="grid">
          <div
            className={cn(
              "col-start-1 row-start-1 flex flex-col gap-4",
              tab !== "filter" && "invisible pointer-events-none",
            )}
          >
            {!restrictedToBasicFilters && (
              <>
                <Select value={fiscalYear} onValueChange={onFiscalYearChange}>
                  <SelectTrigger className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_TIME}>All Time</SelectItem>
                    {fiscalYearOptions().map((y) => (
                      <SelectItem key={y} value={String(y)}>{fyLabel(y)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={quarter || ALL} onValueChange={(v) => onQuarterChange(v === ALL ? "" : v)}>
                  <SelectTrigger className="h-11 w-full text-base"><SelectValue placeholder="All Quarters" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All Quarters</SelectItem>
                    {QUARTERS.map((q) => (
                      <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={month || ALL} onValueChange={(v) => onMonthChange(v === ALL ? "" : v)}>
                  <SelectTrigger className="h-11 w-full text-base"><SelectValue placeholder="All Months" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All Months</SelectItem>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            <Select value={categoryId || ALL} onValueChange={(v) => onCategoryIdChange(v === ALL ? "" : v)}>
              <SelectTrigger className="h-11 w-full text-base"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Categories</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as InitiativeOutcome | "all")}>
              <SelectTrigger className="h-11 w-full text-base"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label} ({s.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!restrictedToBasicFilters && (
              <RequesterCombobox value={requesterId} onChange={onRequesterIdChange} inputClassName="h-11 text-base" />
            )}
          </div>

          <div
            className={cn(
              "col-start-1 row-start-1 flex flex-col gap-1",
              tab !== "sort" && "invisible pointer-events-none",
            )}
          >
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onSortByChange(o.value)}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-3 text-left text-base",
                  sortBy === o.value ? "bg-secondary/60 font-medium" : "hover:bg-muted/60",
                )}
              >
                {o.label}
                {sortBy === o.value && <Check className="size-4 text-primary" />}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClear}>Clear all</Button>
          <Button className="flex-1" onClick={() => onOpenChange(false)}>Apply</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
