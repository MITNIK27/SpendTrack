import { X } from "lucide-react"

interface Props {
  onClear: () => void
  ariaLabel: string
}

/** One-click "clear this field" — pairs with VoiceInputButton so a misheard
 * recording is a single click to wipe and retry, not manual text selection.
 * Caller is responsible for only rendering this when the field is non-empty. */
export function ClearFieldButton({ onClear, ariaLabel }: Props) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={ariaLabel}
      className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <X className="size-3.5" />
    </button>
  )
}
