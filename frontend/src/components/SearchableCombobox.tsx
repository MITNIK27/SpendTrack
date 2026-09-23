import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

export interface ComboboxOption {
  id: string
  label: string
  sublabel?: string
}

interface Props {
  value: string
  /** `label` is passed too (when selecting an option) so the caller can display
   * the selection without needing the full option object hoisted into its state. */
  onChange: (id: string, label?: string) => void
  options: ComboboxOption[]
  isLoading?: boolean
  query: string
  onQueryChange: (q: string) => void
  placeholder: string
  emptyMessage?: string
  /** Label of the currently selected option, shown when the field isn't focused
   * (the option itself may not be in the current filtered `options` list). */
  selectedLabel?: string
}

/** A type-to-search select — for a directory (Requester) or a list (Initiative)
 * too long to dump into a plain dropdown. The caller owns fetching/filtering
 * `options` for the current `query`; this component is just the input +
 * dropdown shell and open/close/keyboard-dismiss behavior.
 *
 * The dropdown itself is portaled to <body> and positioned from the input's
 * bounding rect, rather than absolutely positioned inside this component's own
 * DOM position — a plain `absolute` dropdown gets silently clipped by any
 * scrollable ancestor (e.g. the shadcn Table wrapper's `overflow-x-auto`,
 * which per the CSS spec forces `overflow-y: auto` too once any overflow-x
 * value is set), which is exactly what happened when this sat inside a
 * spend-request table row. */
export function SearchableCombobox({
  value,
  onChange,
  options,
  isLoading,
  query,
  onQueryChange,
  placeholder,
  emptyMessage = "No matches.",
  selectedLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const updateRect = () => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (!r) return
      // Never let the dropdown be narrower than ~14rem, but on a narrow phone
      // screen never let that minimum push it past the viewport's right edge
      // either — a `position: fixed` portal isn't clipped by any ancestor, so
      // an unclamped width/left would visibly hang off-screen.
      const width = Math.max(r.width, Math.min(224, window.innerWidth - 32))
      const left = Math.min(r.left, window.innerWidth - width - 8)
      setRect({ top: r.bottom, left: Math.max(left, 8), width })
    }
    updateRect()
    window.addEventListener("scroll", updateRect, true)
    window.addEventListener("resize", updateRect)
    window.visualViewport?.addEventListener("resize", updateRect)
    return () => {
      window.removeEventListener("scroll", updateRect, true)
      window.removeEventListener("resize", updateRect)
      window.visualViewport?.removeEventListener("resize", updateRect)
    }
  }, [open])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (wrapRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const select = (option: ComboboxOption) => {
    onChange(option.id, option.label)
    onQueryChange("")
    setOpen(false)
  }

  const clear = () => {
    onChange("")
    onQueryChange("")
  }

  const displayValue = open ? query : (value ? selectedLabel ?? "" : query)

  return (
    <div ref={wrapRef} className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={displayValue}
        onChange={(e) => {
          onQueryChange(e.target.value)
          if (value) onChange("")
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="pl-8 pr-7"
      />
      {value && !open && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear selection"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}

      {open && rect &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
            className="z-50 mt-1 max-h-64 overflow-y-auto border border-border bg-card shadow-md"
          >
            {isLoading && <p className="px-3 py-2 text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && options.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</p>
            )}
            {!isLoading &&
              options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => select(o)}
                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-secondary/50"
                >
                  <span>
                    {o.label}
                    {o.sublabel && <span className="text-muted-foreground"> ({o.sublabel})</span>}
                  </span>
                </button>
              ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
