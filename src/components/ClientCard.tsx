import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Trash2 } from "lucide-react";
import type { DbClient } from "@/hooks/useClients";
import { useClients } from "@/hooks/useClients";
import HealthScore from "./HealthScore";
export default function ClientCard({ client }: { client: DbClient }) {
  const navigate = useNavigate();
  const { deleteClient } = useClients();

  return (
    <button onClick={() => navigate(`/clients/${client.id}`)} className="glass-card-hover p-4 text-left w-full group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary-foreground">
            {client.avatar || client.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">{client.name}</p>
            <p className="text-xs text-muted-foreground">{client.company}</p>
          </div>
        </div>
        <HealthScore score={client.health_score} size="sm" />
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
        <span>{client.role}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">{client.open_tasks} tasks</span>
          {client.open_issues > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="w-3 h-3" /> {client.open_issues} issues
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete this client?")) deleteClient(client.id); }}
            className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </button>
  );
}
