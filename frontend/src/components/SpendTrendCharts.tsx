import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  // Line, LineChart — only used by the hidden "Monthly Spend Trend" chart below; re-import alongside it.
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatMoney } from "@/lib/money"
import { useSpendTrends } from "@/api/queries"
import type { CategoryBreakdownRow, SpendSummaryFilters } from "@/types/domain"

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

// One explicit color per category code. Keyed by code (not derived from its
// position) so a given category keeps the same color across filter changes,
// and so a new category gets a deliberately chosen color that doesn't clash
// with the existing ones — add an entry here whenever a category is added.
const CATEGORY_COLORS: Record<string, string> = {
  A: "#E63946", // Conferences & Events — crimson
  B: "#00A878", // Advertising & Paid Promotion — emerald
  C: "#F2C14E", // Content & Creative — amber
  D: "#8E44AD", // Branding & Merchandise — violet
  E: "#3498DB", // Travel & Accommodation — azure
  F: "#D946A8", // Customer / Prospect Engagement — magenta
  G: "#F77F00", // Digital Marketing — orange
  H: "#3F51B5", // Marketing Technology — indigo
  I: "#FF6B6B", // PR & Communications — coral
  J: "#00A6A6", // Analyst / Industry Relations — teal
  K: "#6C5CE7", // Partnerships & Co-Marketing — purple
  L: "#22B8CF", // Website & Digital Presence — cyan
  M: "#E83E8C", // Awards & Recognition — raspberry
  N: "#7A9E3A", // Research & Intelligence — olive
  O: "#D4A017", // Memberships & Associations — mustard
  P: "#264653", // Internal Marketing Initiatives — deep navy
  Q: "#C1663A", // Others — terracotta
}

// Neutral grey for a code with no entry above, so it stays visible instead of
// silently reusing another category's color.
const FALLBACK_CATEGORY_COLOR = "#9CA3AF"

function categoryColor(code: string): string {
  return CATEGORY_COLORS[code.toUpperCase()] ?? FALLBACK_CATEGORY_COLOR
}

const QUARTER_LABELS: Record<number, string> = {
  1: "Q1 (Apr–Jun)",
  2: "Q2 (Jul–Sep)",
  3: "Q3 (Oct–Dec)",
  4: "Q4 (Jan–Mar)",
}

function n(amount: string): number {
  return Number(amount)
}

interface Props {
  filters: SpendSummaryFilters
  byCategory: CategoryBreakdownRow[]
  periodLabel: string
}

/** BI-style charts for the leadership dashboard — a monthly trend line, a
 * quarterly bar, a category spend-share donut, and average monthly spend by
 * category. Siddharth doesn't need to read the numbers row by row to get the
 * shape of where spend is going. */
export function SpendTrendCharts({ filters, byCategory, periodLabel }: Props) {
  const { data, isLoading } = useSpendTrends(filters)

  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-bold">Spend Trends</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-72 w-full bg-muted motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  // "Monthly Spend Trend" chart data — hidden, not deleted, alongside its
  // ChartCard below.
  // const monthlyData = data.monthly.map((m) => ({
  //   month_label: m.month_label,
  //   Approved: n(m.approved),
  //   Actual: n(m.actual),
  // }))

  const quarterlyData = data.quarterly.map((q) => ({
    label: QUARTER_LABELS[q.quarter] ?? `Q${q.quarter}`,
    Approved: n(q.approved),
    // Actual: n(q.actual), — re-enable once Actual figures are trustworthy
  }))

  const categoryShareData = byCategory
    .filter((c) => n(c.approved) > 0)
    .map((c) => ({ code: c.category_code, name: c.category_name, value: n(c.approved) }))
    .sort((a, b) => b.value - a.value)

  // "Average Monthly Spend by Category" chart data — hidden, not deleted,
  // alongside its ChartCard below.
  // const categoryAverageData = data.category_monthly_average.map((c) => ({
  //   label: c.category_code,
  //   fullName: `${c.category_code}. ${c.category_name}`,
  //   "Avg Monthly Approved": n(c.average_monthly_approved),
  //   "Avg Monthly Actual": n(c.average_monthly_actual),
  // }))

  const hasAnyData = categoryShareData.length > 0 || quarterlyData.length > 0

  if (!hasAnyData) return null

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-bold">Spend Trends</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* "Monthly Spend Trend" — hidden, not deleted (needs monthlyData above re-enabled too).
        <ChartCard title="Monthly Spend Trend">
          {monthlyData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month_label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatMoney(v, data.display_currency)} width={80} />
                <Tooltip formatter={(v: unknown) => formatMoney(v as number, data.display_currency)} />
                <Legend />
                <Line type="monotone" dataKey="Approved" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Actual" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        */}

        <ChartCard title="Quarterly Spend">
          {quarterlyData.every((q) => q.Approved === 0) ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={quarterlyData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatMoney(v, data.display_currency)} width={80} />
                <Tooltip formatter={(v: unknown) => formatMoney(v as number, data.display_currency)} />
                <Legend />
                <Bar dataKey="Approved" fill={CHART_COLORS[0]} />
                {/* <Bar dataKey="Actual" fill={CHART_COLORS[1]} /> — re-enable once Actual figures are trustworthy */}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`Category-wise Spend Share (${periodLabel})`}>
          {categoryShareData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Tooltip
                    formatter={(value: unknown, name: unknown, entry: { payload?: { percent?: number } }) => {
                      const percent = entry?.payload?.percent
                      const suffix = typeof percent === "number" ? ` (${Math.round(percent * 100)}%)` : ""
                      return [`${formatMoney(value as number, data.display_currency)}${suffix}`, name as string]
                    }}
                  />
                  <Pie data={categoryShareData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {categoryShareData.map((entry) => (
                      <Cell key={entry.code} fill={categoryColor(entry.code)} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs">
                {categoryShareData.map((entry) => (
                  <li key={entry.code} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: categoryColor(entry.code) }} />
                    <span className="truncate text-muted-foreground">{entry.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>

        {/* "Average Monthly Spend by Category" — hidden, not deleted (needs categoryAverageData above re-enabled too).
        <ChartCard title="Average Monthly Spend by Category">
          {categoryAverageData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryAverageData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatMoney(v, data.display_currency)} width={80} />
                <Tooltip
                  formatter={(v: unknown) => formatMoney(v as number, data.display_currency)}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                />
                <Legend />
                <Bar dataKey="Avg Monthly Approved" fill={CHART_COLORS[0]} />
                <Bar dataKey="Avg Monthly Actual" fill={CHART_COLORS[1]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        */}
      </div>
    </div>
  )
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`border border-border bg-card p-4 ${className ?? ""}`}>
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      {children}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      No matching spend for these filters.
    </div>
  )
}
