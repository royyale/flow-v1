import { useState } from "react";
import { CheckSquare, Filter } from "lucide-react";
import { tasks, type TaskStatus } from "@/lib/mockData";
import StatusBadge from "@/components/StatusBadge";

export default function TasksView() {
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-primary" />
            Tasks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tasks.filter(t => t.status === "urgent").length} urgent · {tasks.filter(t => t.status !== "complete").length} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {(["all", "urgent", "pending", "waiting", "complete"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card divide-y divide-border/30">
        {filtered.map((task) => (
          <div key={task.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
            <div className="flex-1 min-w-0 mr-4">
              <p className="text-sm font-medium text-foreground">{task.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {task.clientName} · Due {task.dueDate}
                {task.description && ` · ${task.description}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                task.priority === "high" ? "bg-destructive/10 text-destructive" : 
                task.priority === "medium" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"
              }`}>
                {task.priority}
              </span>
              <StatusBadge status={task.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
