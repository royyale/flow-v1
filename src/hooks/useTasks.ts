import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface DbTask {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
}

export function useTasks(clientId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["tasks", user?.id, clientId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("tasks").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as DbTask[];
    },
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["tasks"] });

  return { ...query, refetch };
}
