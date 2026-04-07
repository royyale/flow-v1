import { format, isToday, isTomorrow, isPast, differenceInDays } from "date-fns";
import { Calendar, AlertTriangle, Clock, CheckCircle2, ArrowRight, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClients } from "@/hooks/useClients";
import { useTasks } from "@/hooks/useTasks";
import { useReminders } from "@/hooks/useReminders";
import { useAuth } from "@/hooks/useAuth";
import ClientCard from "@/components/ClientCard";
import StatusBadge from "@/components/StatusBadge";
import HealthScore from "@/components/HealthScore";

function formatRelativeDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  const diff = differenceInDays(d, new Date());
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  if (diff <= 7) return `In ${diff}d`;
  return format(d, "MMM d");
}

export default function TodayView() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: clients = [] } = useClients();
  const { data: tasks = [] } = useTasks();
  const { data: reminders = [] } = useReminders();

  const urgentTasks = tasks.filter((t) => t.status === "urgent");
  const atRiskClients = clients.filter((c) => c.status === "at-risk");
  const todayReminders = reminders.filter((r) => isToday(new Date(r.due_date)) && !r.is_done);
  const completedToday = tasks.filter((t) => t.status === "complete").length;
  const totalActive = tasks.filter((t) => t.status !== "complete").length;

  const today = new Date();
  const dayName = format(today, "EEEE");
  const dateStr = format(today, "MMMM d, yyyy");
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Good morning, {firstName}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {dayName}, {dateStr} · {urgentTasks.length} urgent items
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-lg bg-card/60 border border-border/30 text-muted-foreground hover:text-foreground transition-colors">
            <Bell className="w-5 h-5" />
            {todayReminders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {todayReminders.length}
              </span>
            )}
          </button>
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-semibold">
            {profile?.avatar_initials || "U"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Urgent", value: urgentTasks.length, icon: AlertTriangle, color: "text-destructive" },
          { label: "At-Risk Clients", value: atRiskClients.length, icon: AlertTriangle, color: "text-accent" },
          { label: "Active Tasks", value: totalActive, icon: Clock, color: "text-primary" },
          { label: "Completed", value: completedToday, icon: CheckCircle2, color: "text-success" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {urgentTasks.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Needs Attention Now
                </h2>
                <button onClick={() => navigate("/tasks")} className="text-xs text-primary hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-3">
                {urgentTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Due {formatRelativeDate(task.due_date)}</p>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {todayReminders.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Bell className="w-4 h-4 text-accent" />
                Reminders
              </h2>
              <div className="space-y-3">
                {todayReminders.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-accent/10">
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.type}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">{r.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tasks.length === 0 && clients.length === 0 && (
            <div className="glass-card p-8 text-center">
              <p className="text-muted-foreground text-sm">No data yet. Start by adding clients and tasks!</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {atRiskClients.length > 0 && (
            <div>
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-accent" />
                At-Risk Clients
              </h2>
              <div className="space-y-3">
                {atRiskClients.map((client) => (
                  <ClientCard key={client.id} client={client} />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground text-sm">All Clients</h2>
              <button onClick={() => navigate("/clients")} className="text-xs text-primary hover:underline">View all</button>
            </div>
            <div className="space-y-2">
              {clients.filter(c => c.status !== "at-risk").slice(0, 4).map((client) => (
                <button key={client.id} onClick={() => navigate(`/clients/${client.id}`)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/20 hover:bg-muted/50 transition-colors text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary-foreground">
                      {client.avatar || client.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm text-foreground">{client.name}</span>
                  </div>
                  <HealthScore score={client.health_score} size="sm" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}