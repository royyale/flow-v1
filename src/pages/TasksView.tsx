import { useState } from "react";
import { CheckSquare, Filter } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useClients } from "@/hooks/useClients";
import StatusBadge from "@/components/StatusBadge";
import AddTaskDialog from "@/components/AddTaskDialog";
import { format } from "date-fns";

export default function TasksView() {
  const [filter, setFilter] = useState<string>("all");
  const { data: tasks = [], refetch } = useTasks();
  const { data: clients = [] } = useClients();
  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  const clientName = (clientId: string | null) => {
    if (!clientId) return "No client";
    const c = clients.find(cl => cl.id === clientId);
    return c ? c.company : "—";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-primary" /> Tasks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tasks.filter(t => t.status === "urgent").length} urgent · {tasks.filter(t => t.status !== "complete").length} active
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            {(["all", "urgent", "pending", "waiting", "complete"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <AddTaskDialog onCreated={refetch} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground text-sm">No tasks yet. Add your first task!</p>
        </div>
      ) : (
        <div className="glass-card divide-y divide-border/30">
          {filtered.map((task) => (
            <div key={task.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-sm font-medium text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {clientName(task.client_id)} · Due {task.due_date ? format(new Date(task.due_date), "MMM d") : "—"}
                  {task.description && ` · ${task.description}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  task.priority === "high" ? "bg-destructive/10 text-destructive" :
                  task.priority === "medium" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"
                }`}>{task.priority}</span>
                <StatusBadge status={task.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
