import { useMemo, useState } from "react"
import { SearchableCombobox } from "@/components/SearchableCombobox"
import { useUsers } from "@/api/queries"

interface Props {
  value: string
  onChange: (userId: string) => void
}

/** Type-to-search Requester filter — filters the already-fetched user directory
 * client-side (small dataset, same tradeoff TeamMemberPicker.tsx makes), showing
 * "Name (email)" so a search like "paarth" finds the right person unambiguously.
 * Shows nothing until you actually type — the point is "search and the name
 * comes up directly," not browsing the whole directory as a dropdown. */
export function RequesterCombobox({ value, onChange }: Props) {
  const { data: users, isLoading } = useUsers()
  const [query, setQuery] = useState("")

  const selected = users?.find((u) => u.id === value)

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return (users ?? [])
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .map((u) => ({ id: u.id, label: u.name, sublabel: u.email }))
  }, [users, query])

  return (
    <SearchableCombobox
      value={value}
      onChange={onChange}
      options={options}
      isLoading={isLoading}
      query={query}
      onQueryChange={setQuery}
      placeholder="Type a name…"
      selectedLabel={selected?.name}
      emptyMessage={query.trim() ? "No matching people." : "Start typing a name…"}
    />
  )
}
