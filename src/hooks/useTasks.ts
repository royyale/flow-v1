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

  const updateTask = async (id: string, updates: Partial<DbTask>) => {
    await supabase.from("tasks").update(updates).eq("id", id);
    refetch();
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    refetch();
  };

  const createTask = async (task: { title: string; description?: string; priority?: string; due_date?: string }) => {
    await supabase.from("tasks").insert({
      ...task,
      user_id: user!.id,
      status: "pending",
      priority: task.priority || "medium",
    });
    refetch();
  };

  return { ...query, refetch, updateTask, deleteTask, createTask };}
