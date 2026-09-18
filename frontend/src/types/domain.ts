export type UserRole = "member" | "approver" | "admin"

export interface UserRead {
  id: string
  email: string
  name: string
  role: UserRole
  is_active: boolean
}

export type DynamicFieldType = "text" | "number" | "boolean"

export interface DynamicFieldSchemaEntry {
  key: string
  label: string
  type: DynamicFieldType
  required: boolean
}

export interface Subcategory {
  id: string
  name: string
  dynamic_field_schema: DynamicFieldSchemaEntry[] | null
}

export interface Category {
  id: string
  code: string
  name: string
  requires_freetext_description: boolean
  subcategories: Subcategory[]
}

export type InitiativeStatus = "draft" | "active" | "closed" | "archived"

export interface Initiative {
  id: string
  name: string
  type: string | null
  owner: UserRead
  event_date: string | null
  location: string | null
  currency: "INR" | "USD"
  status: InitiativeStatus
  team_members: UserRead[]

  target_audience: string | null
  objective: string | null
  estimated_total_budget: string | null
  expected_leads_meetings: string | null

  created_at: string
}

export interface FinancialSummary {
  total_requested: string
  total_approved: string
  total_pending: string
  total_actual: string
  total_balance: string
  spend_request_count: number
}

export interface InitiativeDetail extends Initiative {
  spend_requests: SpendRequest[]
  financial_summary: FinancialSummary
}

export type SpendRequestStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "resubmitted"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "spent"
  | "closed"

export interface SpendRequestLineItem {
  id: string
  item: string
  amount: string
}

export interface SpendRequest {
  id: string
  initiative_id: string
  created_by: UserRead
  category: Category
  subcategory: Subcategory | null
  other_description: string | null
  description: string | null
  vendor: string | null
  requested_amount: string
  approved_amount: string | null
  actual_amount: string | null
  currency: "INR" | "USD"
  variance: string | null
  latest_decision_comment: string | null
  status: SpendRequestStatus
  current_cycle: number
  submitted_at: string | null
  decided_at: string | null
  spent_at: string | null
  team_members: UserRead[]

  vendor_quotation_amount: string | null
  dynamic_answers: Record<string, unknown> | null
  line_items: SpendRequestLineItem[]

  created_at: string
  updated_at: string
}

/** Statuses awaiting an approver decision — used to build the pending-approvals view. */
export const PENDING_DECISION_STATUSES: SpendRequestStatus[] = ["submitted", "under_review", "resubmitted"]

export interface SpendSummaryKPIs {
  fy_spend_approved: string
  fy_spend_actual: string
  fy_spend_available: string
}

export interface CategoryBreakdownRow {
  category_id: string
  category_code: string
  category_name: string
  approved: string
  actual: string
  balance: string
}

export interface SpendSummaryResponse {
  fiscal_year: number | null // null means "all time" (all_time filter was set)
  matched_spend_request_count: number
  kpis: SpendSummaryKPIs
  by_category: CategoryBreakdownRow[]
}

export interface MonthlyTrendPoint {
  month_label: string
  approved: string
  actual: string
}

export interface QuarterlyTrendPoint {
  quarter: number
  approved: string
  actual: string
}

export interface CategoryAverageRow {
  category_id: string
  category_code: string
  category_name: string
  average_monthly_approved: string
  average_monthly_actual: string
}

export interface SpendTrendsResponse {
  fiscal_year: number | null
  monthly: MonthlyTrendPoint[]
  quarterly: QuarterlyTrendPoint[]
  category_monthly_average: CategoryAverageRow[]
}

export interface SpendRequestReportRow {
  id: string
  description: string | null
  initiative_id: string
  initiative_name: string
  category_name: string
  requester_name: string
  vendor: string | null
  requested_amount: string
  approved_amount: string | null
  actual_amount: string | null
  status: SpendRequestStatus
  decided_at: string | null
  decided_by: string | null
  decision_comment: string | null
}

export interface SpendSummaryFilters {
  fiscal_year?: number
  quarter?: number
  month?: number
  category_id?: string
  subcategory_id?: string
  initiative_id?: string
  requester_id?: string
  status_filter?: string
  /** Bypasses fiscal-year scoping entirely — "all time" / past approvals regardless of period. */
  all_time?: boolean
}

export interface SearchInitiativeResult {
  id: string
  name: string
  status: InitiativeStatus
}

export interface SearchSpendRequestResult {
  id: string
  description: string | null
  initiative_id: string
  initiative_name: string
  category_name: string
  vendor: string | null
  status: SpendRequestStatus
  requested_amount: string
}

export interface SearchResponse {
  initiatives: SearchInitiativeResult[]
  spend_requests: SearchSpendRequestResult[]
}

export interface AlertItem {
  type: string
  severity: "warning" | "critical"
  message: string
  entity_type: "spend_request" | "initiative"
  entity_id: string
}

export interface ActivityLogEntry {
  id: string
  action: string
  actor: UserRead | null
  log_metadata: Record<string, unknown> | null
  created_at: string
}
