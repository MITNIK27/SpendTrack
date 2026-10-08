import { useDisplayCurrency } from "@/context/CurrencyContext"
import { cn } from "@/lib/utils"

/** Global ₹/$ display-currency switch — replaces the Topbar's old "About" info
 * button. A two-segment toggle rather than a dropdown, since there are only
 * ever two options. */
export function CurrencyToggle() {
  const { currency, setCurrency } = useDisplayCurrency()

  return (
    <div
      role="group"
      aria-label="Display currency"
      className="flex items-center rounded-md border border-border bg-muted/40 p-0.5 text-xs font-semibold"
    >
      {(["INR", "USD"] as const).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setCurrency(c)}
          aria-pressed={currency === c}
          title={c === "INR" ? "Indian Rupee" : "US Dollar"}
          className={cn(
            "grid size-6 place-items-center rounded transition-colors",
            currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {c === "INR" ? "₹" : "$"}
        </button>
      ))}
    </div>
  )
}
