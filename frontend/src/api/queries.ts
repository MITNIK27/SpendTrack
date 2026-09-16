import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, getDevUserEmail } from "@/api/client"
import type {
  ActivityLogEntry,
  AlertItem,
  Category,
  Initiative,
  InitiativeDetail,
  SearchInitiativeResult,
  SearchResponse,
  SpendRequest,
  SpendRequestReportRow,
  SpendSummaryFilters,
  SpendSummaryResponse,
  SpendTrendsResponse,
  UserRead,
} from "@/types/domain"

export function useCurrentUser() {
  return useQuery<UserRead>({
    queryKey: ["me", getDevUserEmail()],
    queryFn: () => api.get<UserRead>("/me"),
    enabled: !!getDevUserEmail(),
    retry: false,
  })
}

export function useCategories() {
  return useQuery<Category[]>({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/categories") })
}

export function useUsers() {
  return useQuery<UserRead[]>({ queryKey: ["users"], queryFn: () => api.get<UserRead[]>("/users") })
}

export function useInitiatives() {
  return useQuery<Initiative[]>({ queryKey: ["initiatives"], queryFn: () => api.get<Initiative[]>("/initiatives") })
}

export function useInitiative(id: string | undefined) {
  return useQuery<InitiativeDetail>({
    queryKey: ["initiative", id],
    queryFn: () => api.get<InitiativeDetail>(`/initiatives/${id}`),
    enabled: !!id,
  })
}

export function useCreateInitiative() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Initiative>("/initiatives", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["initiatives"] }),
  })
}

export function useUpdateInitiative(id: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch<Initiative>(`/initiatives/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["initiatives"] })
      qc.invalidateQueries({ queryKey: ["initiative", id] })
    },
  })
}

export function useSubmitInitiative(id: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (spendRequestIds: string[]) =>
      api.post<InitiativeDetail>(`/initiatives/${id}/submit`, { spend_request_ids: spendRequestIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["initiatives"] })
      qc.invalidateQueries({ queryKey: ["initiative", id] })
      qc.invalidateQueries({ queryKey: ["spend-requests"] })
    },
  })
}

/** Submits a single already-created draft spend request on its own — the
 * inline row action on Initiative Detail, distinct from bundling drafts into
 * the initiative's own submit (`useSubmitInitiative`). */
export function useSubmitSpendRequestById(initiativeId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (spendRequestId: string) => api.post<SpendRequest>(`/spend-requests/${spendRequestId}/submit`),
    onSuccess: (_data, spendRequestId) => {
      qc.invalidateQueries({ queryKey: ["spend-request", spendRequestId] })
      qc.invalidateQueries({ queryKey: ["spend-requests"] })
      if (initiativeId) qc.invalidateQueries({ queryKey: ["initiative", initiativeId] })
    },
  })
}

export interface ApproveBatchDecision {
  spend_request_id: string
  comment?: string
}

/** The everyday approval action: a hand-picked set of pending spend requests,
 * each with its own optional remark. Used by both the Initiative Detail
 * checklist (scoped to one initiative) and the cross-initiative Approvals
 * queue (no `initiativeId` to invalidate there). */
export function useApproveBatch(initiativeId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (decisions: ApproveBatchDecision[]) =>
      api.post<SpendRequest[]>("/spend-requests/approve-batch", { decisions }),
    onSuccess: (approved) => {
      qc.invalidateQueries({ queryKey: ["initiatives"] })
      qc.invalidateQueries({ queryKey: ["spend-requests"] })
      for (const sr of approved) {
        qc.invalidateQueries({ queryKey: ["spend-request", sr.id] })
        qc.invalidateQueries({ queryKey: ["initiative", sr.initiative_id] })
      }
      if (initiativeId) qc.invalidateQueries({ queryKey: ["initiative", initiativeId] })
    },
  })
}

/** Only allowed while every spend request under the initiative is still a draft
 * — the backend rejects (409) once any of them has been submitted. */
export function useDeleteInitiative() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/initiatives/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["initiatives"] }),
  })
}

export function useSpendRequest(id: string | undefined) {
  return useQuery<SpendRequest>({
    queryKey: ["spend-request", id],
    queryFn: () => api.get<SpendRequest>(`/spend-requests/${id}`),
    enabled: !!id,
  })
}

export function useCreateSpendRequest(initiativeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<SpendRequest>(`/initiatives/${initiativeId}/spend-requests`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["initiative", initiativeId] })
      qc.invalidateQueries({ queryKey: ["spend-requests"] })
    },
  })
}

export function useUpdateSpendRequest(id: string, initiativeId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch<SpendRequest>(`/spend-requests/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spend-request", id] })
      if (initiativeId) qc.invalidateQueries({ queryKey: ["initiative", initiativeId] })
    },
  })
}

export function useSubmitSpendRequest(id: string, initiativeId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<SpendRequest>(`/spend-requests/${id}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spend-request", id] })
      qc.invalidateQueries({ queryKey: ["spend-requests"] })
      if (initiativeId) qc.invalidateQueries({ queryKey: ["initiative", initiativeId] })
    },
  })
}

export interface ActualSpendInput {
  actual_amount: number
  actual_spend_date?: string
}

export function useRecordActualSpend(id: string, initiativeId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ActualSpendInput) => api.post<SpendRequest>(`/spend-requests/${id}/actual`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spend-request", id] })
      qc.invalidateQueries({ queryKey: ["spend-requests"] })
      qc.invalidateQueries({ queryKey: ["activity", "spend-request", id] })
      if (initiativeId) qc.invalidateQueries({ queryKey: ["initiative", initiativeId] })
    },
  })
}

export function useSpendRequests() {
  return useQuery<SpendRequest[]>({
    queryKey: ["spend-requests"],
    queryFn: () => api.get<SpendRequest[]>("/spend-requests"),
  })
}

export function useAlerts() {
  return useQuery<AlertItem[]>({ queryKey: ["reports", "alerts"], queryFn: () => api.get<AlertItem[]>("/reports/alerts") })
}

export function useGlobalSearch(q: string) {
  const trimmed = q.trim()
  return useQuery<SearchResponse>({
    queryKey: ["search", trimmed],
    queryFn: () => api.get<SearchResponse>(`/search?q=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length >= 2,
  })
}

/** Shared with the CSV export buttons so the download always matches what's on screen. */
export function spendSummaryQueryString(filters: SpendSummaryFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  return params.toString()
}

export function useSpendSummary(filters: SpendSummaryFilters) {
  const qs = spendSummaryQueryString(filters)
  return useQuery<SpendSummaryResponse>({
    queryKey: ["reports", "spend-summary", qs],
    queryFn: () => api.get<SpendSummaryResponse>(`/reports/spend-summary${qs ? `?${qs}` : ""}`),
  })
}

/** Monthly trend, quarterly bar, and average-monthly-by-category — the leadership
 * dashboard's charts. Same filters as the summary, so the charts and the KPI
 * tiles above them are always describing the same slice of data. */
export function useSpendTrends(filters: SpendSummaryFilters) {
  const qs = spendSummaryQueryString(filters)
  return useQuery<SpendTrendsResponse>({
    queryKey: ["reports", "spend-trends", qs],
    queryFn: () => api.get<SpendTrendsResponse>(`/reports/spend-trends${qs ? `?${qs}` : ""}`),
  })
}

export function useSpendRequestActivity(id: string | undefined, enabled = true) {
  return useQuery<ActivityLogEntry[]>({
    queryKey: ["activity", "spend-request", id],
    queryFn: () => api.get<ActivityLogEntry[]>(`/spend-requests/${id}/activity`),
    enabled: !!id && enabled,
  })
}

export function useSpendRequestRows(filters: SpendSummaryFilters, enabled = true) {
  const qs = spendSummaryQueryString(filters)
  return useQuery<SpendRequestReportRow[]>({
    queryKey: ["reports", "spend-requests", qs],
    queryFn: () => api.get<SpendRequestReportRow[]>(`/reports/spend-requests${qs ? `?${qs}` : ""}`),
    enabled,
  })
}

/** Cascading + searchable Initiative options for the leadership report's filter —
 * server-side since the initiative list can grow large enough that fetching
 * everything client-side stops being reasonable. */
export function useInitiativeOptions(query: string, categoryId?: string) {
  const params = new URLSearchParams()
  if (query.trim()) params.set("name", query.trim())
  if (categoryId) params.set("category_id", categoryId)
  const qs = params.toString()
  return useQuery<SearchInitiativeResult[]>({
    queryKey: ["initiative-options", qs],
    queryFn: () => api.get<SearchInitiativeResult[]>(`/initiatives${qs ? `?${qs}` : ""}`),
  })
}
