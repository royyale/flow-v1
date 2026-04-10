import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface DbClient {
  id: string;
  name: string;
  company: string;
  role: string;
  avatar: string;
  health_score: number;
  status: string;
  last_contact: string;
  next_deadline: string | null;
  open_tasks: number;
  open_issues: number;
  created_at: string;
}

export function useClients() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["clients", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as DbClient[];
    },
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["clients", user?.id] });

  const deleteClient = async (id: string) => {
    await supabase.from("clients").delete().eq("id", id);
    refetch();
  };

  return { ...query, refetch, deleteClient };
}