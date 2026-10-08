import { Fragment, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter } from "lucide-react"
import { cn } from "cn"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { MobileRow, MobileField } from "@/components/ui/mobile-card-row"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { StatusBadge } from "@/components/StatusBadge"
import { FilterableColumnHead } from "@/components/FilterableColumnHead"
import { SortableColumnHead } from "@/components/SortableColumnHead"
import { SearchableCombobox, type ComboboxOption } from "@/components/SearchableCombobox"
import { currencySymbol, formatMoney, type Currency } from "@/lib/money"
import { ApiError } from "@/api/client"
import { useApproveBatch, useRejectSpendRequest } from "@/api/queries"
import { VoiceInputButton } from "@/components/VoiceInputButton"
import { ClearFieldButton } from "@/components/ClearFieldButton"
import type { SpendRequest, SpendRequestStatus } from "@/types/domain"

interface FilterOption<T extends string> {
  value: T
  label: string
  count: number
  dotClassName?: string
}

/** Column-header filter/sort controls — only meaningful on the
 * cross-initiative Approvals queue (grouped view); a single-initiative page
 * passes none of these and gets today's plain, unfiltered/unsorted table. */
interface QueueControls {
  status: { value: SpendRequestStatus | "all"; onChange: (v: SpendRequestStatus | "all") => void; options: FilterOption<SpendRequestStatus | "all">[] }
  /** Type-to-search, not a browsable list — nothing shown until you type,
   * same convention as the Dashboard's Requester filter. */
  reportedBy: {
    value: string
    onChange: (id: string, label?: string) => void
    query: string
    onQueryChange: (q: string) => void
    options: ComboboxOption[]
    selectedLabel?: string
  }
  amountSort: { direction: "asc" | "desc" | null; onClick: () => void }
}

/** Selection + remarks + approve-mutation state behind the checklist table —
 * split out so a page that wants its own "Approve" button placement (e.g. up
 * in the page header, since approving there reads as one initiative-level
 * action, not a table action) can still reuse the exact same logic. */
export function useApprovalChecklist(spendRequests: SpendRequest[], initiativeId?: string) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const [approvedAmounts, setApprovedAmounts] = useState<Record<string, string>>({})
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectComment, setRejectComment] = useState("")
  const approveBatch = useApproveBatch(initiativeId)
  const rejectSpendRequest = useRejectSpendRequest(initiativeId)

  // Re-sync selection when the underlying pending *set* actually changes (e.g.
  // after a prior approve, or navigating between initiatives) — always back to
  // nothing selected, so the approver chooses explicitly every time rather
  // than everything starting pre-checked. Keyed on the joined ids, not the
  // array reference, since the caller may recompute a fresh-but-equal array
  // every render (a `.filter()` inline) — depending on the array itself would
  // re-fire this every render and loop forever.
  const idsKey = spendRequests.map((sr) => sr.id).join(",")
  useEffect(() => {
    setSelected(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const allSelected = selected.size === spendRequests.length && spendRequests.length > 0
  const toggleAll = (checked: boolean) => setSelected(checked ? new Set(spendRequests.map((sr) => sr.id)) : new Set())
  const toggleOne = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  const setRemark = (id: string, value: string) => setRemarks((prev) => ({ ...prev, [id]: value }))
  const appendRemark = (id: string, spoken: string) =>
    setRemarks((prev) => ({ ...prev, [id]: [prev[id], spoken].filter(Boolean).join(" ") }))
  const setApprovedAmount = (id: string, value: string) => setApprovedAmounts((prev) => ({ ...prev, [id]: value }))

  const approve = async () => {
    const targets = spendRequests.filter((sr) => selected.has(sr.id))
    const decisions: { spend_request_id: string; approved_amount?: number; comment?: string }[] = []
    for (const sr of targets) {
      const label = sr.description ?? sr.category.name
      const raw = approvedAmounts[sr.id]
      const resolved = raw?.trim() ? Number(raw) : Number(sr.requested_amount)
      if (!Number.isFinite(resolved) || resolved <= 0) {
        toast.error(`Enter a valid approved amount for "${label}".`)
        return
      }
      const isOverride = resolved !== Number(sr.requested_amount)
      if (isOverride && !remarks[sr.id]?.trim()) {
        toast.error(`Add a remark for "${label}" — required when approving a different amount.`)
        return
      }
      decisions.push({
        spend_request_id: sr.id,
        approved_amount: isOverride ? resolved : undefined,
        comment: remarks[sr.id]?.trim() || undefined,
      })
    }
    try {
      await approveBatch.mutateAsync(decisions)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't approve these spend requests.")
    }
  }

  // Reject asks for one shared comment via a confirm dialog instead of
  // requiring every selected row's own remark field to be pre-filled — much
  // less friction when rejecting a whole batch (e.g. an entire initiative) at
  // once. The per-row remark input stays, but going forward it's exclusively
  // the Approve-time remark/override-justification field.
  const openRejectDialog = () => {
    setRejectComment("")
    setRejectDialogOpen(true)
  }
  const closeRejectDialog = () => setRejectDialogOpen(false)
  const appendRejectComment = (spoken: string) =>
    setRejectComment((prev) => [prev, spoken].filter(Boolean).join(" "))

  const confirmReject = async () => {
    if (!rejectComment.trim()) {
      toast.error("Add a comment before rejecting — it's required to reject.")
      return
    }
    const targets = spendRequests.filter((sr) => selected.has(sr.id))
    try {
      await Promise.all(
        targets.map((sr) =>
          rejectSpendRequest.mutateAsync({ spendRequestId: sr.id, comment: rejectComment.trim() }),
        ),
      )
      setRejectDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't reject these spend requests.")
    }
  }

  return {
    selected,
    remarks,
    approvedAmounts,
    rejectDialogOpen,
    rejectComment,
    allSelected,
    toggleAll,
    toggleOne,
    setRemark,
    appendRemark,
    setApprovedAmount,
    setRejectComment,
    appendRejectComment,
    approve,
    openRejectDialog,
    closeRejectDialog,
    confirmReject,
    isPending: approveBatch.isPending || rejectSpendRequest.isPending,
    selectedCount: selected.size,
  }
}

type ChecklistState = ReturnType<typeof useApprovalChecklist>

interface TableProps {
  spendRequests: SpendRequest[]
  state: ChecklistState
  /** Cross-initiative context (the Approvals queue) needs to say which
   * initiative each row belongs to — a single-initiative page doesn't. */
  initiativeNames?: Map<string, string>
  /** Column-header filter/sort — only the cross-initiative queue passes this. */
  controls?: QueueControls
  /** A single-initiative page shows the request's one overall owner in its own
   * header instead — the per-line "Requested By" here would be redundant (and
   * can differ line to line, which doesn't fit a single top-of-page name). */
  hideRequestedBy?: boolean
}

interface Group {
  key: string
  name: string | null
  rows: SpendRequest[]
}

/** Groups by initiative when `initiativeNames` is given (the cross-initiative
 * Approvals queue) — a single-initiative page passes no map and gets one
 * ungrouped group back, unchanged from before grouping existed. */
function groupByInitiative(spendRequests: SpendRequest[], initiativeNames?: Map<string, string>): Group[] {
  if (!initiativeNames) return [{ key: "all", name: null, rows: spendRequests }]
  const byInitiative = new Map<string, SpendRequest[]>()
  for (const sr of spendRequests) {
    const rows = byInitiative.get(sr.initiative_id) ?? []
    rows.push(sr)
    byInitiative.set(sr.initiative_id, rows)
  }
  return [...byInitiative.entries()]
    .map(([initiativeId, rows]) => ({ key: initiativeId, name: initiativeNames.get(initiativeId) ?? "—", rows }))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
}

/** Live sum of the SELECTED rows' approved amounts (edited value if touched,
 * else the requested amount) — recomputed on every render so it tracks
 * keystrokes in the amount inputs. Grouped by currency since the
 * cross-initiative queue can mix currencies across initiatives; almost
 * always resolves to a single entry in practice. */
function selectedTotals(spendRequests: SpendRequest[], state: ChecklistState): { currency: Currency; amount: number }[] {
  const byCurrency = new Map<Currency, number>()
  for (const sr of spendRequests) {
    if (!state.selected.has(sr.id)) continue
    const raw = state.approvedAmounts[sr.id]
    const parsed = raw?.trim() ? Number(raw) : Number(sr.requested_amount)
    if (!Number.isFinite(parsed)) continue
    const currency = sr.currency as Currency
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + parsed)
  }
  return [...byCurrency.entries()].map(([currency, amount]) => ({ currency, amount }))
}

/** Just the table — no button, no outer border — for a page that places
 * "Approve" elsewhere and wants to control its own container styling. */
export function ApprovalTable({ spendRequests, state, initiativeNames, controls, hideRequestedBy }: TableProps) {
  if (spendRequests.length === 0) return null
  const groups = groupByInitiative(spendRequests, initiativeNames)
  const columnCount = controls ? 6 : 5

  return (
    <>
      {controls && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2 lg:hidden">
          <MobileFilterButton icon={ListFilter} value={controls.status.value} onChange={controls.status.onChange} options={controls.status.options} placeholder="Status" />
          <div className="w-40">
            <SearchableCombobox
              value={controls.reportedBy.value}
              onChange={controls.reportedBy.onChange}
              options={controls.reportedBy.options}
              query={controls.reportedBy.query}
              onQueryChange={controls.reportedBy.onQueryChange}
              placeholder="Requested by…"
              selectedLabel={controls.reportedBy.selectedLabel}
              emptyMessage={controls.reportedBy.query.trim() ? "No matching people." : "Start typing a name…"}
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-card text-muted-foreground" onClick={controls.amountSort.onClick}>
            {controls.amountSort.direction === "asc" && <ArrowUp className="size-3.5" />}
            {controls.amountSort.direction === "desc" && <ArrowDown className="size-3.5" />}
            {!controls.amountSort.direction && <ArrowUpDown className="size-3.5" />}
            Amount
          </Button>
        </div>
      )}

      <Table className="hidden lg:table">
        <TableHeader className="bg-muted/60 [&_th]:font-semibold">
          <TableRow className="divide-x divide-border border-b-2 border-border">
            <TableHead className="w-10">
              <Checkbox checked={state.allSelected} onCheckedChange={(v) => state.toggleAll(!!v)} aria-label="Select all" />
            </TableHead>
            <TableHead className="max-w-[130px]">Description</TableHead>
            <TableHead className="max-w-[100px]">Category</TableHead>
            {controls ? (
              <FilterableColumnHead label="Status" value={controls.status.value} onChange={controls.status.onChange} options={controls.status.options} />
            ) : null}
            {controls ? (
              <SortableColumnHead label="Amount" direction={controls.amountSort.direction} onClick={controls.amountSort.onClick} />
            ) : (
              <TableHead>Amount</TableHead>
            )}
            <TableHead className="min-w-[180px]">Approval Remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const groupTotals = selectedTotals(group.rows, state)
            return (
            <Fragment key={group.key}>
              {group.name !== null && (
                <TableRow key={`${group.key}-header`} className="border-b-2 border-border bg-accent/50 hover:bg-accent/50">
                  <TableCell colSpan={columnCount} className="py-2">
                    <Link to={`/initiatives/${group.key}`} className="text-sm font-bold text-foreground hover:text-primary-text hover:underline">
                      {group.name}
                    </Link>
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      {group.rows.length} spend request{group.rows.length === 1 ? "" : "s"}
                    </span>
                    {!hideRequestedBy && group.rows[0] && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · {group.rows[0].created_by.name}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {group.rows.map((sr) => (
                <TableRow key={sr.id} className="hover:bg-primary/5">
                  <TableCell>
                    <Checkbox
                      checked={state.selected.has(sr.id)}
                      onCheckedChange={(v) => state.toggleOne(sr.id, !!v)}
                      aria-label={`Select ${sr.description ?? sr.category.name}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-[130px]">
                    <Link
                      to={`/spend-requests/${sr.id}`}
                      className="block truncate font-medium text-primary-text hover:underline"
                      title={sr.description ?? sr.category.name}
                    >
                      {sr.description ?? sr.category.name}
                    </Link>
                    {sr.other_description && (
                      <div className="mt-0.5 truncate text-xs text-foreground" title={sr.other_description}>
                        {sr.other_description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[100px] truncate">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate">{sr.category.name}</span>
                        </TooltipTrigger>
                        <TooltipContent>{sr.category.name}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  {controls && (
                    <TableCell>
                      <StatusBadge status={sr.status} />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="relative w-28">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {currencySymbol(sr.currency)}
                      </span>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={state.approvedAmounts[sr.id] ?? sr.requested_amount}
                        onChange={(e) => state.setApprovedAmount(sr.id, e.target.value)}
                        className="h-8 w-full pl-5 tabular-nums"
                        aria-label={`Approved amount for ${sr.description ?? sr.category.name}, in ${sr.currency}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Input
                        value={state.remarks[sr.id] ?? ""}
                        onChange={(e) => state.setRemark(sr.id, e.target.value)}
                        placeholder="Optional"
                        className="h-8"
                      />
                      <VoiceInputButton
                        ariaLabel={`Speak remark for ${sr.description ?? sr.category.name}`}
                        onTranscript={(text) => state.appendRemark(sr.id, text)}
                      />
                      {!!state.remarks[sr.id] && (
                        <ClearFieldButton
                          ariaLabel={`Clear remark for ${sr.description ?? sr.category.name}`}
                          onClear={() => state.setRemark(sr.id, "")}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow key={`${group.key}-total`} className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={columnCount - 2} className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.name !== null ? `${group.name} — ` : ""}
                  Total Approved Amount ({group.rows.filter((sr) => state.selected.has(sr.id)).length} selected)
                </TableCell>
                <TableCell className="font-bold tabular-nums">
                  {groupTotals.length === 0
                    ? "—"
                    : groupTotals.map((t) => <div key={t.currency}>{formatMoney(t.amount, t.currency)}</div>)}
                </TableCell>
                <TableCell />
              </TableRow>
            </Fragment>
            )
          })}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-3 p-3 lg:hidden">
        <label className="flex items-center gap-2 px-1 text-sm">
          <Checkbox checked={state.allSelected} onCheckedChange={(v) => state.toggleAll(!!v)} aria-label="Select all" />
          Select all
        </label>
        {groups.map((group) => {
          const groupTotals = selectedTotals(group.rows, state)
          return (
          <div key={group.key} className="flex flex-col gap-3">
            {group.name !== null && (
              <div className="flex items-baseline gap-2 px-1">
                <Link to={`/initiatives/${group.key}`} className="text-sm font-bold text-foreground hover:text-primary-text hover:underline">
                  {group.name}
                </Link>
                <span className="text-xs font-medium text-muted-foreground">
                  {group.rows.length} spend request{group.rows.length === 1 ? "" : "s"}
                </span>
                {!hideRequestedBy && group.rows[0] && (
                  <span className="text-xs text-muted-foreground">· {group.rows[0].created_by.name}</span>
                )}
              </div>
            )}
            {group.rows.map((sr) => (
              <MobileRow key={sr.id}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-0.5"
                    checked={state.selected.has(sr.id)}
                    onCheckedChange={(v) => state.toggleOne(sr.id, !!v)}
                    aria-label={`Select ${sr.description ?? sr.category.name}`}
                  />
                  <Link to={`/spend-requests/${sr.id}`} className="font-medium text-primary-text hover:underline">
                    {sr.description ?? sr.category.name}
                  </Link>
                </div>
                {sr.other_description && <p className="text-xs text-foreground">{sr.other_description}</p>}
                <MobileField label="Category">{sr.category.name}</MobileField>
                {controls && <MobileField label="Status"><StatusBadge status={sr.status} /></MobileField>}
                <MobileField label={`Approved Amount (${sr.currency})`}>
                  <div className="relative w-28">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {currencySymbol(sr.currency)}
                    </span>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={state.approvedAmounts[sr.id] ?? sr.requested_amount}
                      onChange={(e) => state.setApprovedAmount(sr.id, e.target.value)}
                      className="h-8 w-full pl-5 tabular-nums"
                      aria-label={`Approved amount for ${sr.description ?? sr.category.name}, in ${sr.currency}`}
                    />
                  </div>
                </MobileField>
                <div className="mt-1 flex items-center gap-1">
                  <Input
                    value={state.remarks[sr.id] ?? ""}
                    onChange={(e) => state.setRemark(sr.id, e.target.value)}
                    placeholder="Remark (optional)"
                    className="h-8"
                  />
                  <VoiceInputButton
                    ariaLabel={`Speak remark for ${sr.description ?? sr.category.name}`}
                    onTranscript={(text) => state.appendRemark(sr.id, text)}
                  />
                  {!!state.remarks[sr.id] && (
                    <ClearFieldButton
                      ariaLabel={`Clear remark for ${sr.description ?? sr.category.name}`}
                      onClear={() => state.setRemark(sr.id, "")}
                    />
                  )}
                </div>
              </MobileRow>
            ))}
            <div className="flex items-center justify-between border-t border-border px-1 pt-2 text-sm">
              <span className="font-semibold text-muted-foreground">
                {group.name !== null ? `${group.name} — ` : ""}
                Total Approved Amount ({group.rows.filter((sr) => state.selected.has(sr.id)).length} selected)
              </span>
              <span className="font-bold tabular-nums">
                {groupTotals.length === 0
                  ? "—"
                  : groupTotals.map((t) => <span key={t.currency} className="ml-2">{formatMoney(t.amount, t.currency)}</span>)}
              </span>
            </div>
          </div>
          )
        })}
      </div>
    </>
  )
}

interface RejectConfirmDialogProps {
  state: ChecklistState
  spendRequests: SpendRequest[]
  /** When every row being decided belongs to one known initiative (e.g.
   * Initiative Detail's own Reject button, rejecting its whole "Awaiting
   * Decision" list), collapses the confirmation into one plain-language
   * question about that initiative instead of itemizing every row. */
  initiativeName?: string
}

const REJECT_LIST_LIMIT = 5

/** Confirms a reject with ONE shared comment applied to every selected row —
 * far less friction than requiring each row's own remark before rejecting a
 * whole batch (e.g. every spend request under one initiative) at once. Render
 * this once wherever `state.openRejectDialog` is wired to a Reject button. */
export function RejectConfirmDialog({ state, spendRequests, initiativeName }: RejectConfirmDialogProps) {
  const targets = spendRequests.filter((sr) => state.selected.has(sr.id))
  const isWholeInitiative = !!initiativeName && targets.length > 0 && targets.length === spendRequests.length
  const visible = targets.slice(0, REJECT_LIST_LIMIT)
  const overflowCount = targets.length - visible.length

  return (
    <Dialog open={state.rejectDialogOpen} onOpenChange={(open) => !open && state.closeRejectDialog()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isWholeInitiative
              ? `Reject "${initiativeName}"?`
              : `Reject ${targets.length} spend request${targets.length === 1 ? "" : "s"}?`}
          </DialogTitle>
          <DialogDescription>
            {isWholeInitiative
              ? "Every pending spend request under this request will be rejected with the comment below."
              : "The spend requests below will be rejected with the comment below."}
          </DialogDescription>
        </DialogHeader>
        {!isWholeInitiative && (
          <ul className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            {visible.map((sr) => (
              <li key={sr.id} className="flex items-baseline gap-2">
                <span aria-hidden className="text-muted-foreground">•</span>
                <span className="truncate">{sr.description ?? sr.category.name}</span>
              </li>
            ))}
            {overflowCount > 0 && (
              <li className="flex items-baseline gap-2 text-muted-foreground">
                <span aria-hidden>•</span>
                <span>+{overflowCount} more</span>
              </li>
            )}
          </ul>
        )}
        <div className="flex items-start gap-1">
          <Textarea
            value={state.rejectComment}
            onChange={(e) => state.setRejectComment(e.target.value)}
            placeholder="Reason for rejecting (required)"
            aria-label="Rejection comment"
            className="min-h-20"
          />
          <div className="flex flex-col gap-1 pt-1">
            <VoiceInputButton ariaLabel="Speak rejection comment" onTranscript={state.appendRejectComment} />
            {!!state.rejectComment && (
              <ClearFieldButton ariaLabel="Clear rejection comment" onClear={() => state.setRejectComment("")} />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={state.closeRejectDialog}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={state.confirmReject} disabled={state.isPending}>
            {state.isPending ? "Rejecting…" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MobileFilterButton<T extends string>({
  icon: Icon,
  value,
  onChange,
  options,
  placeholder,
}: {
  icon: typeof ListFilter
  value: T
  onChange: (v: T) => void
  options: FilterOption<T>[]
  placeholder: string
}) {
  const current = options.find((o) => o.value === value)
  const isDefault = options[0]?.value === value
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-card text-muted-foreground">
          <Icon className="size-3.5" />
          {isDefault ? placeholder : current?.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
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
  )
}

interface Props {
  spendRequests: SpendRequest[]
  /** Scopes cache invalidation when every row belongs to one initiative. */
  initiativeId?: string
  initiativeNames?: Map<string, string>
  controls?: QueueControls
}

/** The everyday approval action, as a self-contained table+button: every
 * currently-pending spend request, pre-selected, with an optional one-line
 * remark per row. Used where "Approve" reads as a table action on its own
 * (the cross-initiative Approvals queue) — a single-initiative page instead
 * uses `useApprovalChecklist` + `ApprovalTable` directly so it can put the
 * button up in its own header. */
export function ApprovalChecklist({ spendRequests, initiativeId, initiativeNames, controls }: Props) {
  const state = useApprovalChecklist(spendRequests, initiativeId)
  if (spendRequests.length === 0) return null
  return (
    <div className="border border-border bg-card">
      <ApprovalTable spendRequests={spendRequests} state={state} initiativeNames={initiativeNames} controls={controls} />
      <div className="flex items-center gap-3 border-t border-border p-3">
        <Button onClick={state.approve} disabled={state.selectedCount === 0 || state.isPending}>
          {state.isPending ? "Approving…" : "Approve"}
        </Button>
        <Button
          variant="outline"
          onClick={state.openRejectDialog}
          disabled={state.selectedCount === 0 || state.isPending}
        >
          Reject
        </Button>
      </div>
      <RejectConfirmDialog state={state} spendRequests={spendRequests} />
    </div>
  )
}
