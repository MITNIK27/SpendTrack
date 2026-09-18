import { useMemo, useState } from "react"
import { SearchableCombobox } from "@/components/SearchableCombobox"
import { useUsers } from "@/api/queries"

interface Props {
  value: string
  onChange: (userId: string) => void
}

/** Type-to-search Requester filter — filters the already-fetched user directory
 * client-side (small dataset, same tradeoff TeamMemberPicker.tsx makes), showing
 * "Name (email)" so a search like "paarth" finds the right person unambiguously. */
export function RequesterCombobox({ value, onChange }: Props) {
  const { data: users, isLoading } = useUsers()
  const [query, setQuery] = useState("")

  const selected = users?.find((u) => u.id === value)

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    const candidates = users ?? []
    const matches = q
      ? candidates.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : candidates
    return matches.map((u) => ({ id: u.id, label: u.name, sublabel: u.email }))
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
      emptyMessage="No matching people."
    />
  )
}
