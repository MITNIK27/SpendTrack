import { Logo } from "@/components/Logo"
import brandIcon from "@/assets/brand-icon.png"
import { cn } from "@/lib/utils"

/**
 * The product's own brand lockup: a clean "SpendTrack" wordmark with a
 * crimson underline accent — either paired with the InfoBeans logo (a thin
 * divider, then the InfoBeans mark; used on Login/About, where the app is
 * shown as an InfoBeans-built tool) or, with `variant="icon"`, led by
 * SpendTrack's own $ mark as a standalone brand (sidebar) — no divider,
 * since there's no second party being co-branded there.
 */
export function BrandLockup({
  on = "light",
  size = "default",
  logo = true,
  logoPosition = "after",
  variant = "cobrand",
  showIcon = false,
  className,
}: {
  on?: "light" | "dark"
  size?: "default" | "md" | "lg"
  logo?: boolean
  logoPosition?: "before" | "after"
  variant?: "cobrand" | "icon"
  /** Shows SpendTrack's own $ icon next to the wordmark in "cobrand" mode too
   * (it's always shown in "icon" mode already) — for places that want both
   * SpendTrack's own mark and the InfoBeans co-brand logo together. */
  showIcon?: boolean
  className?: string
}) {
  const isDark = on === "dark"
  const isLarge = size === "lg"
  const isMedium = size === "md"
  const isIcon = variant === "icon"
  const withIcon = isIcon || showIcon

  const wordmark = (
    <div className="flex min-w-0 flex-col">
      <span
        className={cn(
          "truncate font-bold leading-none tracking-tight",
          isLarge ? "text-4xl" : isMedium ? "text-xl" : "text-lg",
          isDark ? "text-white" : "text-foreground"
        )}
      >
        Spend<span className="text-primary-text">Track</span>
      </span>
      <span
        className={cn(
          "bg-primary",
          isLarge ? "mt-2.5 h-1 w-28" : isMedium ? "mt-1.5 h-[3px] w-14" : "mt-1 h-[3px] w-12",
        )}
      />
    </div>
  )

  const wordmarkWithIcon = withIcon ? (
    <div className={cn("flex min-w-0 items-center", isLarge ? "gap-4" : isMedium ? "gap-1.5" : "gap-2")}>
      <img
        src={brandIcon}
        alt="SpendTrack"
        className={cn("shrink-0", isLarge ? "size-10" : isMedium ? "size-7" : "size-6")}
      />
      {wordmark}
    </div>
  ) : (
    wordmark
  )

  if (isIcon) {
    return <div className={cn("flex min-w-0 items-center", className)}>{wordmarkWithIcon}</div>
  }

  const divider = <span className={cn("self-stretch w-px shrink-0", isDark ? "bg-white/20" : "bg-border")} />
  const mark = <Logo on={on} className={cn("shrink-0", isLarge ? "h-9 w-auto" : "h-4 w-auto")} />

  return (
    <div className={cn("flex min-w-0 items-center", isLarge ? "gap-5" : "gap-2.5", className)}>
      {logo && logoPosition === "before" && (
        <>
          {mark}
          {divider}
        </>
      )}
      {wordmarkWithIcon}
      {logo && logoPosition === "after" && (
        <>
          {divider}
          {mark}
        </>
      )}
    </div>
  )
}
