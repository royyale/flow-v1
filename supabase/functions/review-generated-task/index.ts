import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function errorResponse(
  status: number,
  error: string,
  code: string,
  details: string | null,
  hint: string,
) {
  return new Response(
    JSON.stringify({ error, code, details, hint }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

// @ts-ignore
Deno.serve({ verify_jwt: false }, async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    console.log(`[review-generated-task] auth_header_present=${Boolean(authHeader)}`);
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(401, "Unauthorized", "UNAUTHORIZED", null, "Missing or invalid auth header/session token.");
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.slice(7);
    const { data: { user }, error: userError } = await serviceSupabase.auth.getUser(token);
    console.log(
      `[review-generated-task] auth_lookup user_id=${user?.id ?? "none"} error=${userError?.message ?? "none"}`,
    );
    if (userError || !user) {
      return errorResponse(
        401,
        "Unauthorized",
        "UNAUTHORIZED",
        userError?.message ?? null,
        "No authenticated user resolved from token.",
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorResponse(400, "Invalid request body.", "INVALID_BODY", null, "Send JSON body with queueId and action.");
    }
    const { queueId, action } = body;
    console.log(`[review-generated-task] request_body=${JSON.stringify(body)}`);
    console.log(`[review-generated-task] queue_id=${queueId ?? "missing"} action=${action ?? "missing"}`);
    if (!queueId || !["approve", "dismiss"].includes(action)) {
      return errorResponse(
        400,
        "queueId and valid action are required.",
        "INVALID_INPUT",
        null,
        "Send queueId and action ('approve' or 'dismiss').",
      );
    }

    const { data: queued, error: queueError } = await supabase
      .from("ai_task_review_queue")
      .select("*")
      .eq("id", queueId)
      .eq("user_id", user.id)
      .maybeSingle();
    console.log(
      `[review-generated-task] queue_lookup queue_id=${queueId} found=${Boolean(queued)} status=${queued?.status ?? "none"} error=${queueError?.message ?? "none"}`,
    );
    if (queueError) {
      return errorResponse(400, queueError.message, queueError.code ?? "QUEUE_LOOKUP_FAILED", queueError.details ?? null, "Queue lookup failed; check RLS/policies.");
    }
    if (!queued) {
      return errorResponse(404, "Review item not found.", "QUEUE_NOT_FOUND", null, "Item may not belong to this user or does not exist.");
    }
    if (queued.status !== "pending") {
      return errorResponse(409, "Item already reviewed.", "ALREADY_REVIEWED", null, "This review item is already approved/dismissed.");
    }

    if (action === "approve") {
      const taskInsertPayload = {
        user_id: user.id,
        title: queued.task_title,
        due_date: queued.due_date,
        priority: queued.priority,
        status: "pending",
        description: `Generated from Gmail (${queued.sender_email})`,
      };
      console.log(`[review-generated-task] task_insert_payload=${JSON.stringify(taskInsertPayload)}`);
      const { data: taskInsertResult, error: taskError } = await supabase
        .from("tasks")
        .insert(taskInsertPayload)
        .select("id")
        .maybeSingle();
      console.log(
        `[review-generated-task] task_insert_result=${JSON.stringify(taskInsertResult)} error=${taskError?.message ?? "none"}`,
      );
      if (taskError) {
        return errorResponse(
          400,
          taskError.message,
          taskError.code ?? "TASK_INSERT_FAILED",
          taskError.details ?? null,
          "Task insert failed. Check RLS permissions and schema constraints.",
        );
      }
    }

    const queueUpdatePayload = {
      status: action === "approve" ? "approved" : "dismissed",
      reviewed_at: new Date().toISOString(),
    };
    console.log(`[review-generated-task] queue_update_payload=${JSON.stringify(queueUpdatePayload)}`);
    const { error: updateError } = await supabase
      .from("ai_task_review_queue")
      .update(queueUpdatePayload)
      .eq("id", queueId)
      .eq("user_id", user.id);
    console.log(`[review-generated-task] queue_update_error=${updateError?.message ?? "none"}`);
    if (updateError) {
      return errorResponse(
        400,
        updateError.message,
        updateError.code ?? "QUEUE_UPDATE_FAILED",
        updateError.details ?? null,
        "Queue status update failed. Check RLS permissions and status column constraints.",
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const errorCode = (error as { code?: string })?.code ?? null;
    const errorDetails = (error as { details?: string })?.details ?? null;
    const hint = "Edge function exception. Check logs for stack/context.";
    console.error(
      `[review-generated-task] error message=${message} code=${errorCode ?? "none"} details=${errorDetails ?? "none"}`,
    );
    return errorResponse(500, message, errorCode ?? "UNHANDLED_EXCEPTION", errorDetails, hint);
  }
});
