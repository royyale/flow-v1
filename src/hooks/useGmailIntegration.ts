import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGmailIntegration() {
  return useQuery({
    queryKey: ["gmail-integration-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session.");
      const { data, error } = await supabase.functions.invoke("gmail-oauth", {
        body: { action: "status" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      return data as { connected: boolean; connectedAt: string | null };
    },
  });
}