import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function GmailCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Connecting Gmail...");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const err = params.get("error");

      if (err) {
        setMessage("Google authorization was cancelled.");
        return;
      }

      if (!code) {
        setMessage("Missing authorization code.");
        return;
      }

      const redirectUri = `${window.location.origin}/settings/gmail/callback`;
      const { error } = await supabase.functions.invoke("gmail-oauth", {
        body: { action: "exchange", code, redirectUri },
      });

      if (error) {
        setMessage(`Failed to connect Gmail: ${error.message}`);
        return;
      }

      setMessage("Gmail connected. Redirecting to settings...");
      setTimeout(() => navigate("/settings", { replace: true }), 900);
    };

    run();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass-card p-8 text-center max-w-md">
        <h1 className="text-xl font-semibold text-foreground">Gmail Integration</h1>
        <p className="text-sm text-muted-foreground mt-3">{message}</p>
      </div>
    </div>
  );
}
