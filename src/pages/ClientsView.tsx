import { useState } from "react";
import { Users, Filter } from "lucide-react";
import { clients } from "@/lib/mockData";
import ClientCard from "@/components/ClientCard";

export default function ClientsView() {
  const [filter, setFilter] = useState<"all" | "at-risk" | "active" | "stable">("all");

  const filtered = filter === "all" ? clients : clients.filter((c) => c.status === filter);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Clients
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{clients.length} clients · {clients.filter(c => c.status === "at-risk").length} need attention</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {(["all", "at-risk", "active", "stable"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {f === "all" ? "All" : f === "at-risk" ? "At Risk" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {filtered.map((client) => (
          <ClientCard key={client.id} client={client} />
        ))}
      </div>
    </div>
  );
}
