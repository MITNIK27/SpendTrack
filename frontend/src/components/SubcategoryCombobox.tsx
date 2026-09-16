import { useMemo, useState } from "react"
import { SearchableCombobox } from "@/components/SearchableCombobox"
import type { Category } from "@/types/domain"

export interface SubcategorySelection {
  categoryId: string
  subcategoryId: string
}

interface Props {
  categories: Category[] | undefined
  categoriesLoading?: boolean
  value: SubcategorySelection | null
  onChange: (value: SubcategorySelection | null) => void
}

/** Type-to-search "what are you spending on" field — replaces separate
 * Category/Subcategory dropdowns with one box: type a word ("hotel", "booth")
 * and pick the closest match, which resolves both the category and
 * subcategory in one step. Wraps the existing SearchableCombobox shell
 * (same one RequesterCombobox uses) rather than reintroducing a new pattern. */
export function SubcategoryCombobox({ categories, categoriesLoading, value, onChange }: Props) {
  const [query, setQuery] = useState("")

  const flattened = useMemo(
    () =>
      (categories ?? []).flatMap((c) =>
        c.subcategories.length > 0
          ? c.subcategories.map((s) => ({
              id: `${c.id}:${s.id}`,
              label: s.name,
              sublabel: c.name,
              categoryId: c.id,
              subcategoryId: s.id,
            }))
          // Categories with no subcategories (e.g. the catch-all "Other") still
          // need to be reachable — surface the category itself as an option.
          : [{ id: `${c.id}:`, label: c.name, sublabel: "Other", categoryId: c.id, subcategoryId: "" }],
      ),
    [categories],
  )

  const selected = value ? flattened.find((o) => o.categoryId === value.categoryId && o.subcategoryId === value.subcategoryId) : undefined

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Don't dump all ~80 subcategories on focus — only surface matches once
    // the user actually starts typing.
    if (!q) return []
    return flattened.filter((o) => o.label.toLowerCase().includes(q) || o.sublabel.toLowerCase().includes(q))
  }, [flattened, query])

  return (
    <SearchableCombobox
      value={value ? `${value.categoryId}:${value.subcategoryId}` : ""}
      onChange={(id) => {
        if (!id) return onChange(null)
        const match = flattened.find((o) => o.id === id)
        onChange(match ? { categoryId: match.categoryId, subcategoryId: match.subcategoryId } : null)
      }}
      options={options}
      isLoading={categoriesLoading}
      query={query}
      onQueryChange={setQuery}
      placeholder="Start typing…"
      selectedLabel={selected?.label}
      emptyMessage={query.trim() ? "No matches." : "Start typing to search — e.g. hotel, booth."}
    />
  )
}
