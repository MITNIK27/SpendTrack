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

// One fixed color per category code (A-Q) — assigned by position in the
// alphabet rather than by order of appearance, so a given category keeps the
// same color across filter changes instead of reshuffling whenever the mix
// of categories with spend changes. Built from exactly 4 hue families — red,
// green, yellow, blue — each with 4-5 shades to cover all 17 codes. The
// families are interleaved (round-robin) rather than grouped, so two
// same-hue shades never land next to each other alphabetically (an earlier
// attempt put near-identical reds on E and Q, which were indistinguishable
// in the chart).
const CATEGORY_COLORS = [
  "#ea1b3d", // A — red (bright)
  "#0fa958", // B — green (bright)
  "#ecb547", // C — yellow (bright)
  "#aa142d", // D — red (dark)
  "#4272FF", // E — blue (Travel & Accommodation, pinned per stakeholder request)
  "#0d8244", // F — green (dark)
  "#bf8208", // G — yellow (dark gold)
  "#4a6fa5", // H — blue (medium)
  "#c53030", // I — red (medium)
  "#3f6b4e", // J — green (forest)
  "#8c681f", // K — yellow (brown-gold)
  "#7fa8d9", // L — blue (pale)
  "#eb4c5e", // M — red (soft)
  "#6fae8c", // N — green (soft)
  "#d9a441", // O — yellow (pale gold)
  "#0a3d73", // P — blue (deep)
  "#a8692a", // Q — yellow (terracotta)
]

function categoryColor(code: string): string {
  const index = code.toUpperCase().charCodeAt(0) - "A".charCodeAt(0)
  return CATEGORY_COLORS[((index % CATEGORY_COLORS.length) + CATEGORY_COLORS.length) % CATEGORY_COLORS.length]
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

        <ChartCard title="Category-wise Spend Share">
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
