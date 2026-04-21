import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { FunctionsHttpError } from "@supabase/supabase-js";

export interface ReviewQueueItem {
  id: string;
  source_email_id: string;
  sender_email: string;
  sender_name: string | null;
  task_title: string;
  due_date: string | null;
  priority: string;
  client_name: string | null;
  email_subject: string | null;
  email_snippet: string | null;
  status: "pending" | "approved" | "dismissed";
  created_at: string;
}

export function useReviewQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["review-queue", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_task_review_queue")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReviewQueueItem[];
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["review-queue", user?.id] });
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const invokeReviewAction = async (queueId: string, action: "approve" | "dismiss") => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session. Please sign in again.");
    console.log(`[review-queue] invoke review-generated-task action=${action} queueId=${queueId} auth_header=Bearer <token>`);

    try {
      const { error } = await supabase.functions.invoke("review-generated-task", {
        body: { queueId, action },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
    } catch (error) {
      if (error instanceof FunctionsHttpError) {
        const status = error.context.status;
        const rawBody = await error.context.clone().text();
        console.error(`[review-queue] FunctionsHttpError status=${status} raw_body=${rawBody}`);
        try {
          const payload = await error.context.json() as { error?: string; code?: string; details?: string; hint?: string };
          console.error(`[review-queue] FunctionsHttpError payload=${JSON.stringify(payload)}`);
          const parts = [
            payload.error,
            payload.code ? `code=${payload.code}` : "",
            payload.details ?? "",
            payload.hint ?? "",
          ]
            .filter(Boolean)
            .join(" | ");
          throw new Error(parts || `Approve task failed with HTTP ${status}.`);
        } catch {
          throw new Error(rawBody || `Approve task failed with HTTP ${status}.`);
        }
      }
      throw error;
    }
  };

  const approve = async (queueId: string) => {
    await invokeReviewAction(queueId, "approve");
    await refresh();
  };

  const dismiss = async (queueId: string) => {
    await invokeReviewAction(queueId, "dismiss");
    await refresh();
  };

  return { ...query, approve, dismiss, refresh };
}
