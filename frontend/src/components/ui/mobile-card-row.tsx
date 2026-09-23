import type { ReactNode } from "react"
import { cn } from "cn"

/** A single row rendered as a card, for the `lg:hidden` mobile view that
 * sits alongside an unchanged `<table>` (see table-bearing screens). Not a
 * table abstraction — each screen still writes its own fields. */
export function MobileRow({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border border-border bg-card p-4",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function MobileField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-0.5 text-sm", className)}>
      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <span className="text-right">{children}</span>
    </div>
  )
}
