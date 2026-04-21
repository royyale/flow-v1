import { useState } from "react";
import { Mail, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGmailIntegration } from "@/hooks/useGmailIntegration";
import { useWatchedClients } from "@/hooks/useWatchedClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SettingsView() {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const { data: gmailStatus, refetch: refetchGmail } = useGmailIntegration();
  const { data: watchedClients = [], addWatchedClient, removeWatchedClient } = useWatchedClients();

  const handleConnectGmail = async () => {
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/settings/gmail/callback`;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session.");
      const { data, error } = await supabase.functions.invoke("gmail-oauth", {
        body: { action: "start", redirectUri },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (!data?.authUrl) throw new Error("Could not create Gmail OAuth URL.");
      window.location.href = data.authUrl as string;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gmail connect failed.");
    } finally {
      setConnecting(false);
    }
  };

  const handleAddClient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clientName.trim() || !clientEmail.trim()) return;
    setSavingClient(true);
    try {
      await addWatchedClient(clientName, clientEmail);
      setClientName("");
      setClientEmail("");
      toast.success("Watched client added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add watched client.");
    } finally {
      setSavingClient(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure Gmail integration and watched clients.</p>
      </div>

      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" /> Gmail Integration
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {gmailStatus?.connected
                ? `Connected${gmailStatus.connectedAt ? ` on ${new Date(gmailStatus.connectedAt).toLocaleString()}` : ""}`
                : "No Gmail account connected yet."}
            </p>
          </div>
          <Button onClick={handleConnectGmail} disabled={connecting}>
            {connecting ? "Redirecting..." : gmailStatus?.connected ? "Reconnect Gmail" : "Connect Gmail"}
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchGmail()}>
          Refresh status
        </Button>
      </div>

      <div className="glass-card p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Watched Clients</h2>
        <p className="text-xs text-muted-foreground">
          Only emails from these contacts are processed for AI task extraction.
        </p>

        <form onSubmit={handleAddClient} className="grid grid-cols-3 gap-3">
          <Input
            placeholder="Client name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
          />
          <Input
            type="email"
            placeholder="Client email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            required
          />
          <Button type="submit" disabled={savingClient} className="gap-2">
            <Plus className="w-4 h-4" /> {savingClient ? "Adding..." : "Add"}
          </Button>
        </form>

        <div className="space-y-2">
          {watchedClients.map((client) => (
            <div key={client.id} className="flex items-center justify-between rounded-lg border border-border/40 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{client.client_name}</p>
                <p className="text-xs text-muted-foreground">{client.client_email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeWatchedClient(client.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {!watchedClients.length && (
            <p className="text-sm text-muted-foreground">No watched clients yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
