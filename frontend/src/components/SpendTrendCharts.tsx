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
}

/** BI-style charts for the leadership dashboard — a monthly trend line, a
 * quarterly bar, a category spend-share donut, and average monthly spend by
 * category. Siddharth doesn't need to read the numbers row by row to get the
 * shape of where spend is going. */
export function SpendTrendCharts({ filters, byCategory }: Props) {
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

  const pieData = byCategory
    .filter((c) => n(c.approved) > 0)
    .map((c) => ({ name: `${c.category_code}. ${c.category_name}`, value: n(c.approved) }))

  // "Average Monthly Spend by Category" chart data — hidden, not deleted,
  // alongside its ChartCard below.
  // const categoryAverageData = data.category_monthly_average.map((c) => ({
  //   label: c.category_code,
  //   fullName: `${c.category_code}. ${c.category_name}`,
  //   "Avg Monthly Approved": n(c.average_monthly_approved),
  //   "Avg Monthly Actual": n(c.average_monthly_actual),
  // }))

  const hasAnyData = pieData.length > 0 || quarterlyData.length > 0

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

        <ChartCard title="Category-wise Spend Share">
          {pieData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Tooltip formatter={(v: unknown) => formatMoney(v as number, data.display_currency)} />
                <Legend />
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {pieData.map((entry, i) => (
                    <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card p-4">
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
