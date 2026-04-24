import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface DbReminder {
  id: string;
  client_id: string | null;
  title: string;
  due_date: string;
  type: string;
  is_done: boolean;
  created_at: string;
}

export function useReminders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["reminders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", user!.id)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as DbReminder[];
    },
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["reminders", user?.id] });

  return { ...query, refetch };
}