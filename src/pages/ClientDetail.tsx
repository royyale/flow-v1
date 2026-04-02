import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Calendar, FileText, AlertTriangle, Clock, Edit2 } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useTasks } from "@/hooks/useTasks";
import HealthScore from "@/components/HealthScore";
import StatusBadge from "@/components/StatusBadge";
import AddTaskDialog from "@/components/AddTaskDialog";
import { format } from "date-fns";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: clients = [], refetch: refetchClients } = useClients();
  const { data: tasks = [], refetch: refetchTasks } = useTasks(id);

  const client = clients.find((c) => c.id === id);
  if (!client) return <div className="text-muted-foreground p-8">Client not found</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center text-lg font-bold text-secondary-foreground">
            {client.avatar || client.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{client.name}</h1>
            <p className="text-sm text-muted-foreground">{client.role} · {client.company}</p>
          </div>
          <EditClientDialog client={client} onSaved={refetchClients} />
          <HealthScore score={client.health_score} size="lg" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Open Tasks", value: tasks.filter(t => t.status !== "complete").length, icon: Clock, color: "text-primary" },
          { label: "Status", value: client.status, icon: AlertTriangle, color: client.status === "at-risk" ? "text-destructive" : "text-muted-foreground" },
          { label: "Health Score", value: client.health_score, icon: Mail, color: "text-muted-foreground" },
          { label: "Next Deadline", value: client.next_deadline ? format(new Date(client.next_deadline), "MMM d") : "—", icon: Calendar, color: "text-accent" },
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

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Tasks</h2>
          <AddTaskDialog onCreated={refetchTasks} clientId={id} />
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks for this client.</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Due {task.due_date ? format(new Date(task.due_date), "MMM d") : "—"}</p>
                </div>
                <StatusBadge status={task.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EditClientDialog({ client, onSaved }: { client: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(client.name);
  const [company, setCompany] = useState(client.company);
  const [role, setRole] = useState(client.role);
  const [status, setStatus] = useState(client.status);
  const [healthScore, setHealthScore] = useState(String(client.health_score));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const avatar = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    const { error } = await supabase.from("clients").update({
      name, company, role, status, avatar,
      health_score: parseInt(healthScore) || 75,
    } as any).eq("id", client.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Client updated!");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><Edit2 className="w-3.5 h-3.5" /> Edit</Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} required className="bg-muted border-border" />
          <Input placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} required className="bg-muted border-border" />
          <Input placeholder="Role" value={role} onChange={e => setRole(e.target.value)} className="bg-muted border-border" />
          <div className="grid grid-cols-2 gap-3">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="at-risk">At Risk</SelectItem>
                <SelectItem value="stable">Stable</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Health Score" value={healthScore} onChange={e => setHealthScore(e.target.value)} min={0} max={100} className="bg-muted border-border" />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
