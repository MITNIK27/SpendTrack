import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/money"
import { ApiError } from "@/api/client"
import { useApproveBatch } from "@/api/queries"
import type { SpendRequest } from "@/types/domain"

/** Selection + remarks + approve-mutation state behind the checklist table —
 * split out so a page that wants its own "Approve" button placement (e.g. up
 * in the page header, since approving there reads as one initiative-level
 * action, not a table action) can still reuse the exact same logic. */
export function useApprovalChecklist(spendRequests: SpendRequest[], initiativeId?: string) {
  const [selected, setSelected] = useState<Set<string>>(new Set(spendRequests.map((sr) => sr.id)))
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const approveBatch = useApproveBatch(initiativeId)

  // Re-sync selection when the underlying pending *set* actually changes (e.g.
  // after a prior approve, or navigating between initiatives) — always start
  // fully checked. Keyed on the joined ids, not the array reference, since the
  // caller may recompute a fresh-but-equal array every render (a `.filter()`
  // inline) — depending on the array itself would re-fire this every render
  // and loop forever.
  const idsKey = spendRequests.map((sr) => sr.id).join(",")
  useEffect(() => {
    setSelected(new Set(idsKey ? idsKey.split(",") : []))
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

  const approve = async () => {
    try {
      await approveBatch.mutateAsync(
        spendRequests
          .filter((sr) => selected.has(sr.id))
          .map((sr) => ({ spend_request_id: sr.id, comment: remarks[sr.id]?.trim() || undefined })),
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't approve these spend requests.")
    }
  }

  return {
    selected,
    remarks,
    allSelected,
    toggleAll,
    toggleOne,
    setRemark,
    approve,
    isPending: approveBatch.isPending,
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
}

/** Just the table — no button, no outer border — for a page that places
 * "Approve" elsewhere and wants to control its own container styling. */
export function ApprovalTable({ spendRequests, state, initiativeNames }: TableProps) {
  if (spendRequests.length === 0) return null
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox checked={state.allSelected} onCheckedChange={(v) => state.toggleAll(!!v)} aria-label="Select all" />
          </TableHead>
          <TableHead>Description</TableHead>
          {initiativeNames && <TableHead>Initiative</TableHead>}
          <TableHead>Category</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Approval Remarks</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {spendRequests.map((sr) => (
          <TableRow key={sr.id}>
            <TableCell>
              <Checkbox
                checked={state.selected.has(sr.id)}
                onCheckedChange={(v) => state.toggleOne(sr.id, !!v)}
                aria-label={`Select ${sr.description ?? sr.category.name}`}
              />
            </TableCell>
            <TableCell>
              <Link to={`/spend-requests/${sr.id}`} className="font-medium text-primary-text hover:underline">
                {sr.description ?? sr.category.name}
              </Link>
            </TableCell>
            {initiativeNames && (
              <TableCell>
                <Link to={`/initiatives/${sr.initiative_id}`} className="hover:underline">
                  {initiativeNames.get(sr.initiative_id) ?? "—"}
                </Link>
              </TableCell>
            )}
            <TableCell>{sr.category.name}</TableCell>
            <TableCell className="tabular-nums">{formatMoney(sr.requested_amount, sr.currency)}</TableCell>
            <TableCell>
              <Input
                value={state.remarks[sr.id] ?? ""}
                onChange={(e) => state.setRemark(sr.id, e.target.value)}
                placeholder="Optional"
                className="h-8"
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface Props {
  spendRequests: SpendRequest[]
  /** Scopes cache invalidation when every row belongs to one initiative. */
  initiativeId?: string
  initiativeNames?: Map<string, string>
}

/** The everyday approval action, as a self-contained table+button: every
 * currently-pending spend request, pre-selected, with an optional one-line
 * remark per row. Used where "Approve" reads as a table action on its own
 * (the cross-initiative Approvals queue) — a single-initiative page instead
 * uses `useApprovalChecklist` + `ApprovalTable` directly so it can put the
 * button up in its own header. */
export function ApprovalChecklist({ spendRequests, initiativeId, initiativeNames }: Props) {
  const state = useApprovalChecklist(spendRequests, initiativeId)
  if (spendRequests.length === 0) return null
  return (
    <div className="border border-border bg-card">
      <ApprovalTable spendRequests={spendRequests} state={state} initiativeNames={initiativeNames} />
      <div className="flex items-center gap-3 border-t border-border p-3">
        <Button onClick={state.approve} disabled={state.selectedCount === 0 || state.isPending}>
          {state.isPending ? "Approving…" : "Approve"}
        </Button>
      </div>
    </div>
  )
}
