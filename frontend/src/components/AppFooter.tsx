import { APP_VERSION, COPYRIGHT_OWNER, COPYRIGHT_YEAR } from "@/lib/app-meta"
import { cn } from "@/lib/utils"

export function AppFooter({ className }: { className?: string }) {
  return (
    <footer className={cn(
      // sm:h-14 (+ sm:py-0) matches AppSidebar.tsx's own "About SpendTrack"
      // band height exactly, so the two border-top lines line up across the
      // sidebar/content boundary instead of drifting apart.
      "flex flex-col items-center gap-1.5 border-t border-border px-4 py-4 text-center text-xs text-muted-foreground sm:h-14 sm:flex-row sm:justify-between sm:gap-2 sm:px-8 sm:py-0 sm:text-left",
      className,
    )}>
      <span>
        © {COPYRIGHT_YEAR} <span className="font-medium text-foreground">{COPYRIGHT_OWNER}</span>. All rights reserved.
      </span>
      <span className="text-muted-foreground/80">Version {APP_VERSION}</span>
    </footer>
  )
}
