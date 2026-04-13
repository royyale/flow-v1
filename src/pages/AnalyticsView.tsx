import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BarChart2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 14) return "1w ago";
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function healthColors(score: number | null) {
  if (score == null) return { bg: "bg-muted/50", text: "text-muted-foreground" };
  if (score >= 75) return { bg: "bg-green-500/20",  text: "text-green-400" };
  if (score >= 40) return { bg: "bg-yellow-500/20", text: "text-yellow-400" };
  return { bg: "bg-red-500/20", text: "text-red-400" };
}

function statusColors(status: string) {
  if (status === "stable")   return { bg: "bg-green-500/20",  text: "text-green-400" };
  if (status === "at-risk")  return { bg: "bg-yellow-500/20", text: "text-yellow-400" };
  if (status === "critical") return { bg: "bg-red-500/20",    text: "text-red-400" };
  return { bg: "bg-muted/50", text: "text-muted-foreground" };
}

const DAY_SHORT  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDayLabel(d: Date): string {
  return `${DAY_SHORT[d.getDay()]} ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-sidebar-border/40 rounded-lg ${className}`} />;
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, valueColor = "text-primary",
}: {
  label: string;
  value: number | string;
  valueColor?: string;
}) {
  return (
    <div className="bg-sidebar border border-sidebar-border rounded-xl p-5">
      <p className={`text-3xl font-bold mb-1 ${valueColor}`}>{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsView() {
  const navigate = useNavigate();

  // ── Data fetching ────────────────────────────────────────────────────────

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["analytics-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, status, health_score");
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; name: string; company: string;
        status: string; health_score: number | null;
      }>;
    },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["analytics-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, status, priority, due_date, client_id, updated_at");
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; status: string; priority: string;
        due_date: string | null; client_id: string | null; updated_at: string;
      }>;
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["analytics-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("timeline_events")
        .select("client_id, created_at")
        .order("created_at", { ascending: false });
      return (data ?? []) as Array<{ client_id: string; created_at: string }>;
    },
  });

  const isLoading = clientsLoading || tasksLoading;

  // ── Derived metrics ──────────────────────────────────────────────────────

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

  const atRiskCount = clients.filter(c =>
    c.status === "at-risk" || c.status === "critical"
  ).length;

  const completedThisWeek = tasks.filter(t =>
    t.status === "complete" && new Date(t.updated_at) >= sevenDaysAgo
  ).length;

  const overdueCount = tasks.filter(t =>
    t.due_date && new Date(t.due_date) < todayMidnight && t.status !== "complete"
  ).length;

  // Tasks by status counts
  const statusLabels: Array<{ key: string; label: string; bar: string }> = [
    { key: "urgent",   label: "Urgent",   bar: "bg-red-500/70"     },
    { key: "pending",  label: "Pending",  bar: "bg-primary/60"     },
    { key: "waiting",  label: "Waiting",  bar: "bg-yellow-500/70"  },
    { key: "complete", label: "Complete", bar: "bg-green-500/70"   },
  ];
  const totalTasks = tasks.length;
  const statusCounts = Object.fromEntries(
    statusLabels.map(({ key }) => [key, tasks.filter(t => t.status === key).length])
  );

  // Tasks due in next 7 days
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const tasksDueByDay = next7Days.map((d, i) => {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return {
      date: d,
      isToday: i === 0,
      count: tasks.filter(t => {
        if (!t.due_date || t.status === "complete") return false;
        const dd = new Date(t.due_date);
        dd.setHours(0, 0, 0, 0);
        return dd >= d && dd < next;
      }).length,
    };
  });

  // Last activity per client (events already ordered desc, take first per client)
  const lastActivityByClient = new Map<string, string>();
  for (const e of events) {
    if (e.client_id && !lastActivityByClient.has(e.client_id)) {
      lastActivityByClient.set(e.client_id, e.created_at);
    }
  }

  // Open / urgent tasks per client
  const openByClient   = new Map<string, number>();
  const urgentByClient = new Map<string, number>();
  for (const t of tasks) {
    if (!t.client_id) continue;
    if (t.status !== "complete") openByClient.set(t.client_id, (openByClient.get(t.client_id) ?? 0) + 1);
    if (t.status === "urgent")   urgentByClient.set(t.client_id, (urgentByClient.get(t.client_id) ?? 0) + 1);
  }

  // Sort clients by health_score ASC (null treated as 0 = highest risk first)
  const sortedClients = [...clients].sort(
    (a, b) => (a.health_score ?? 0) - (b.health_score ?? 0)
  );

  // Productivity
  const completedCount   = statusCounts["complete"] ?? 0;
  const completionRate   = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const avgTasksPerClient = clients.length > 0
    ? (totalTasks / clients.length).toFixed(1)
    : "0.0";
  const fullyServedClients = clients.filter(c => (openByClient.get(c.id) ?? 0) === 0).length;

  // SVG ring dimensions
  const R             = 52;
  const circumference = 2 * Math.PI * R;
  const dashOffset    = circumference * (1 - completionRate / 100);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-8 max-w-6xl animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Consultant productivity &amp; client risk dashboard</p>
        </div>
      </div>

      {/* ── Section 1: Metric Cards ─────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Clients"          value={clients.length} />
          <MetricCard label="At-Risk Clients"         value={atRiskCount}
            valueColor={atRiskCount > 0 ? "text-red-400" : "text-primary"} />
          <MetricCard label="Completed This Week"     value={completedThisWeek} />
          <MetricCard label="Overdue Tasks"           value={overdueCount}
            valueColor={overdueCount > 0 ? "text-red-400" : "text-primary"} />
        </div>
      )}

      {/* ── Section 2: Client Risk Table ────────────────────────────────── */}
      <div className="bg-sidebar border border-sidebar-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-sidebar-border">
          <h2 className="text-sm font-semibold text-foreground">Client Risk Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Sorted by health score — lowest first</p>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sidebar-border">
                  {["Client", "Company", "Score", "Open", "Urgent", "Last Activity", "Status"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground text-sm">No clients yet</td>
                  </tr>
                ) : sortedClients.map(client => {
                  const hc    = healthColors(client.health_score);
                  const sc    = statusColors(client.status);
                  const open   = openByClient.get(client.id) ?? 0;
                  const urgent = urgentByClient.get(client.id) ?? 0;
                  return (
                    <tr
                      key={client.id}
                      onClick={() => navigate(`/clients/${client.id}`)}
                      className="border-b border-sidebar-border/40 hover:bg-sidebar-accent/40 cursor-pointer transition-colors last:border-0"
                    >
                      <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap">{client.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{client.company}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${hc.bg} ${hc.text}`}>
                          {client.health_score ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{open}</td>
                      <td className="px-5 py-3">
                        {urgent > 0
                          ? <span className="text-red-400 font-semibold">{urgent}</span>
                          : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {relativeTime(lastActivityByClient.get(client.id))}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${sc.bg} ${sc.text}`}>
                          {client.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 3: Task Breakdown ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Tasks by Status */}
        <div className="bg-sidebar border border-sidebar-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-5">Tasks by Status</h2>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : totalTasks === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet</p>
          ) : (
            <div className="space-y-4">
              {statusLabels.map(({ key, label, bar }) => {
                const count = statusCounts[key] ?? 0;
                const pct   = Math.round((count / totalTasks) * 100);
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-foreground font-medium">{count} <span className="text-muted-foreground font-normal">· {pct}%</span></span>
                    </div>
                    <div className="h-2 bg-sidebar-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${bar}`}
                        style={{ width: pct > 0 ? `${pct}%` : "2px" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Tasks Due This Week */}
        <div className="bg-sidebar border border-sidebar-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-5">Tasks Due This Week</h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : (
            <div className="space-y-1.5">
              {tasksDueByDay.map(({ date, isToday, count }) => (
                <div key={date.toISOString()} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isToday ? "bg-primary/10" : ""}`}>
                  <span className={`text-xs w-28 shrink-0 ${isToday ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                    {isToday ? "Today" : formatDayLabel(date)}
                  </span>
                  <div className="flex-1 h-1.5 bg-sidebar-border rounded-full overflow-hidden">
                    {count > 0 && (
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isToday ? "bg-primary" : "bg-primary/40"}`}
                        style={{ width: `${Math.min(count * 25, 100)}%` }}
                      />
                    )}
                  </div>
                  <span className={`text-xs w-4 text-right tabular-nums ${isToday ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 4: Productivity Score ────────────────────────────────── */}
      <div className="bg-sidebar border border-sidebar-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-6">Consultant Productivity</h2>
        {isLoading ? (
          <div className="flex items-center gap-10">
            <Skeleton className="w-[130px] h-[130px] rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-10 w-56" />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-10">
            {/* Circular progress ring */}
            <svg width="130" height="130" viewBox="0 0 130 130" className="shrink-0">
              {/* Track */}
              <circle
                cx="65" cy="65" r={R}
                fill="none" stroke="currentColor" strokeWidth="9"
                className="text-sidebar-border"
              />
              {/* Progress */}
              <circle
                cx="65" cy="65" r={R}
                fill="none" stroke="currentColor" strokeWidth="9"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className="text-primary"
                transform="rotate(-90 65 65)"
                style={{ transition: "stroke-dashoffset 0.7s ease" }}
              />
              {/* Percentage */}
              <text
                x="65" y="60"
                textAnchor="middle"
                fontSize="22"
                fontWeight="700"
                fill="currentColor"
                className="text-foreground"
              >
                {completionRate}%
              </text>
              {/* Label */}
              <text
                x="65" y="78"
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
                className="text-muted-foreground"
                opacity="0.6"
              >
                completion
              </text>
            </svg>

            {/* Stats */}
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Completion Rate</p>
                <p className="text-xs text-muted-foreground mt-0.5">{completedCount} of {totalTasks} tasks completed</p>
              </div>
              <div className="flex gap-10">
                <div>
                  <p className="text-2xl font-bold text-primary tabular-nums">{avgTasksPerClient}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Avg tasks / client</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary tabular-nums">{fullyServedClients}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Clients fully served</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
