import { useNavigate, useParams } from "react-router-dom"
import { InitiativeForm } from "@/components/InitiativeForm"
import { BackButton } from "@/components/BackButton"
import { useInitiative, useUpdateInitiative } from "@/api/queries"

export default function EditInitiative() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: initiative, isLoading, isError } = useInitiative(id)
  const updateInitiative = useUpdateInitiative(id)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="my-2 h-10 w-full bg-muted motion-safe:animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError || !initiative) {
    return (
      <div className="border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Couldn't load this initiative. It may not exist, or you may not have access to it.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="mb-4">
        <BackButton to={`/initiatives/${id}`} label={initiative.name} />
        <h1 className="text-3xl font-bold">Edit Marketing Initiative</h1>
      </div>

      <InitiativeForm
        initial={{
          name: initiative.name,
          type: initiative.type,
          currency: initiative.currency,
          objective: initiative.objective,
          estimated_total_budget: initiative.estimated_total_budget,
        }}
        submitLabel="Save Changes"
        pendingLabel="Saving…"
        onCancel={() => navigate(`/initiatives/${id}`)}
        onSubmit={async (payload) => {
          await updateInitiative.mutateAsync(payload)
          navigate(`/initiatives/${id}`)
        }}
      />
    </div>
  )
}
