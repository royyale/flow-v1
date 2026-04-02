import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { Client } from "@/lib/mockData";
import HealthScore from "./HealthScore";

export default function ClientCard({ client }: { client: Client }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/clients/${client.id}`)}
      className="glass-card-hover p-4 text-left w-full group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary-foreground">
            {client.avatar}
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">{client.name}</p>
            <p className="text-xs text-muted-foreground">{client.company}</p>
          </div>
        </div>
        <HealthScore score={client.healthScore} size="sm" />
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
        <span>Last: {client.lastContact}</span>
        <span>Next: {client.nextDeadline}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">{client.openTasks} tasks</span>
          {client.openIssues > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="w-3 h-3" />
              {client.openIssues} issues
            </span>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}
