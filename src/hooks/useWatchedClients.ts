import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface WatchedClient {
  id: string;
  client_name: string;
  client_email: string;
  created_at: string;
}

export function useWatchedClients() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["watched-clients", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watched_clients")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WatchedClient[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["watched-clients", user?.id] });

  const addWatchedClient = async (clientName: string, clientEmail: string) => {
    await supabase.from("watched_clients").insert({
      user_id: user!.id,
      client_name: clientName,
      client_email: clientEmail.trim().toLowerCase(),
    });
    refresh();
  };

  const removeWatchedClient = async (id: string) => {
    await supabase.from("watched_clients").delete().eq("id", id);
    refresh();
  };

  return { ...query, addWatchedClient, removeWatchedClient, refresh };
}
