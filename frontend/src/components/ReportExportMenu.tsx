import { useState } from "react"
import { toast } from "sonner"
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ApiError, downloadFile } from "@/api/client"
import { spendSummaryQueryString } from "@/api/queries"
import { cn } from "@/lib/utils"
import type { SpendSummaryFilters } from "@/types/domain"

type Download = { path: string; filename: string }

const DOWNLOADS = {
  xlsx: { path: "/reports/export?format=xlsx", filename: "spend-report.xlsx" },
  pdf: { path: "/reports/export?format=pdf", filename: "spend-report.pdf" },
  requestsCsv: { path: "/reports/spend-requests/export", filename: "spend-requests.csv" },
  summaryCsv: { path: "/reports/spend-summary/export", filename: "spend-summary.csv" },
} satisfies Record<string, Download>

/** Download menu for the spend report — Excel and PDF are the formatted
 * versions, CSV is the raw data. The server decides what's in it from the
 * caller's role (a requester only ever gets their own requests), and the
 * filters passed in are the ones currently on screen, so what's downloaded
 * matches what's being looked at. */
export function ReportExportMenu({ filters, className }: { filters: SpendSummaryFilters; className?: string }) {
  const [busy, setBusy] = useState(false)

  const run = async ({ path, filename }: Download) => {
    const qs = spendSummaryQueryString(filters)
    setBusy(true)
    try {
      await downloadFile(`${path}${qs ? `${path.includes("?") ? "&" : "?"}${qs}` : ""}`, filename)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't export this report.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          // A deliberately stronger outline + tinted fill than the neighbouring
          // filter controls — this is the page's one download action and was easy to miss.
          className={cn(
            "h-8 shrink-0 gap-1.5 border-foreground/40 bg-secondary text-xs font-medium text-foreground shadow-sm hover:bg-secondary/70",
            className,
          )}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          Export
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem className="gap-2 text-xs" onClick={() => run(DOWNLOADS.xlsx)}>
          <FileSpreadsheet className="size-3.5" /> Excel report (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-xs" onClick={() => run(DOWNLOADS.pdf)}>
          <FileText className="size-3.5" /> PDF report (.pdf)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 text-xs" onClick={() => run(DOWNLOADS.requestsCsv)}>
          <Table2 className="size-3.5" /> Spend requests (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-xs" onClick={() => run(DOWNLOADS.summaryCsv)}>
          <Table2 className="size-3.5" /> Category summary (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
