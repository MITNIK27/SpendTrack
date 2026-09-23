import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ref: externalRef, ...props }: React.ComponentProps<"input">) {
  const ref = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (type !== "number") return
    const el = ref.current
    if (!el) return
    // Scrolling over a focused number input silently changes its value — a
    // browser default nobody expects in a form; manual entry should be the
    // only way to change it. React attaches wheel listeners as passive, so
    // calling preventDefault() through a JSX onWheel prop is silently
    // ignored — only a native, non-passive listener actually stops it.
    const blockWheelChange = (event: WheelEvent) => event.preventDefault()
    el.addEventListener("wheel", blockWheelChange, { passive: false })
    return () => el.removeEventListener("wheel", blockWheelChange)
  }, [type])

  return (
    <input
      ref={(node) => {
        ref.current = node
        if (typeof externalRef === "function") externalRef(node)
        else if (externalRef) externalRef.current = node
      }}
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
