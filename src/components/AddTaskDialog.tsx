import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  onCreated: () => void;
  clientId?: string;
  trigger?: React.ReactNode;
}

export default function AddTaskDialog({ onCreated, clientId, trigger }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("pending");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [selectedClient, setSelectedClient] = useState(clientId || "");
  const [clients, setClients] = useState<{ id: string; name: string; company: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      supabase.from("clients").select("id, name, company").eq("user_id", user.id).then(({ data }) => {
        if (data) setClients(data as any);
      });
    }
  }, [open, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      client_id: selectedClient || null,
      title,
      description: description || null,
      status,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Task added!");
    setTitle(""); setDescription(""); setStatus("pending"); setPriority("medium"); setDueDate("");
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Add Task</Button>}
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>Add New Task</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Task title" value={title} onChange={e => setTitle(e.target.value)} required className="bg-muted border-border" />
          <Textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} className="bg-muted border-border" />
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Select client (optional)" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.company}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-muted border-border" />
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : "Add Task"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
