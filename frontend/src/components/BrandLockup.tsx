import { Logo } from "@/components/Logo"
import { cn } from "@/lib/utils"

/**
 * The product's own brand lockup: a clean "SpendTrack" wordmark with a
 * crimson underline accent, a thin divider, and the real InfoBeans logo
 * beside it — one horizontal row, so nothing stacks or centers oddly at
 * any scale (sidebar's small size or the About page's large hero size).
 */
export function BrandLockup({
  on = "light",
  size = "default",
  className,
}: {
  on?: "light" | "dark"
  size?: "default" | "lg"
  className?: string
}) {
  const isDark = on === "dark"
  const isLarge = size === "lg"

  return (
    <div className={cn("flex items-center", isLarge ? "gap-5" : "gap-2.5", className)}>
      <div className="flex flex-col">
        <span
          className={cn(
            "font-bold leading-none tracking-tight",
            isLarge ? "text-4xl" : "text-lg",
            isDark ? "text-white" : "text-foreground"
          )}
        >
          Spend<span className="text-primary-text">Track</span>
        </span>
        <span className={cn("bg-primary", isLarge ? "mt-2.5 h-1 w-28" : "mt-1 h-[3px] w-12")} />
      </div>
      <span className={cn("self-stretch w-px", isDark ? "bg-white/20" : "bg-border")} />
      <Logo on={on} className={isLarge ? "h-7 w-auto" : "h-4 w-auto"} />
    </div>
  )
}
