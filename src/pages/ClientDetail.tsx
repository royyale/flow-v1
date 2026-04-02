import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Calendar, FileText, AlertTriangle, Clock } from "lucide-react";
import { clients, tasks, timelineEvents } from "@/lib/mockData";
import HealthScore from "@/components/HealthScore";
import StatusBadge from "@/components/StatusBadge";

const typeIcons = {
  email: Mail,
  meeting: Calendar,
  task: FileText,
  note: FileText,
  issue: AlertTriangle,
};

const typeColors = {
  email: "text-primary",
  meeting: "text-accent",
  task: "text-muted-foreground",
  note: "text-muted-foreground",
  issue: "text-destructive",
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = clients.find((c) => c.id === id);
  if (!client) return <div className="text-muted-foreground p-8">Client not found</div>;

  const clientTasks = tasks.filter((t) => t.clientId === id);
  const timeline = timelineEvents.filter((e) => e.clientId === id);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center text-lg font-bold text-secondary-foreground">
            {client.avatar}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{client.name}</h1>
            <p className="text-sm text-muted-foreground">{client.role} · {client.company}</p>
          </div>
          <HealthScore score={client.healthScore} size="lg" />
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Open Tasks", value: client.openTasks, icon: Clock, color: "text-primary" },
          { label: "Open Issues", value: client.openIssues, icon: AlertTriangle, color: client.openIssues > 0 ? "text-destructive" : "text-muted-foreground" },
          { label: "Last Contact", value: client.lastContact, icon: Mail, color: "text-muted-foreground" },
          { label: "Next Deadline", value: client.nextDeadline, icon: Calendar, color: "text-accent" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className={`text-lg font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Tasks */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-foreground mb-4">Tasks</h2>
          {clientTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks for this client.</p>
          ) : (
            <div className="space-y-3">
              {clientTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Due {task.dueDate}</p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-foreground mb-4">Timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timeline events yet.</p>
          ) : (
            <div className="space-y-4">
              {timeline.map((event) => {
                const Icon = typeIcons[event.type];
                return (
                  <div key={event.id} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 ${typeColors[event.type]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{event.date}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
