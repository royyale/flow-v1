import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  onCreated: () => void;
  trigger?: React.ReactNode;
}

export default function AddClientDialog({ onCreated, trigger }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const avatar = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    const { error } = await supabase.from("clients").insert({
      user_id: user.id,
      name,
      company,
      role,
      avatar,
      status,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Client added!");
    setName(""); setCompany(""); setRole(""); setStatus("active");
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Add Client</Button>}
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Client name" value={name} onChange={e => setName(e.target.value)} required className="bg-muted border-border" />
          <Input placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} required className="bg-muted border-border" />
          <Input placeholder="Role / Title" value={role} onChange={e => setRole(e.target.value)} className="bg-muted border-border" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="at-risk">At Risk</SelectItem>
              <SelectItem value="stable">Stable</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : "Add Client"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
