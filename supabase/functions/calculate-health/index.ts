import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Scoring algorithm ────────────────────────────────────────────────────────

function calculateScore(
  tasks: any[],
  reminders: any[],
  events: any[]
): { score: number; status: string } {
  let score = 100;
  const now = Date.now();
  const todayDate = new Date();

  // ── Task signals ──────────────────────────────────────────────────────────
  const overdueTasks  = tasks.filter(t => t.due_date && new Date(t.due_date) < todayDate && t.status !== "complete");
  const urgentTasks   = tasks.filter(t => t.status === "urgent");
  const openTasks     = tasks.filter(t => t.status !== "complete");
  const completedTasks = tasks.filter(t => t.status === "complete");

  score -= overdueTasks.length * 8;
  score -= urgentTasks.length * 6;
  if (openTasks.length > 5) score -= 5;
  if (tasks.length > 0 && completedTasks.length === 0) score -= 10;

  // ── Reminder signals ──────────────────────────────────────────────────────
  const overdueReminders = reminders.filter(r => r.due_date && new Date(r.due_date) < todayDate);
  score -= overdueReminders.length * 5;
  if (reminders.length > 3) score -= 5;

  // ── Engagement signals (timeline events) ──────────────────────────────────
  const days30ago = new Date(now - 30 * 86_400_000);
  const days14ago = new Date(now - 14 * 86_400_000);
  const days7ago  = new Date(now -  7 * 86_400_000);
  const days3ago  = new Date(now -  3 * 86_400_000);

  const recent30 = events.filter(e => new Date(e.created_at) > days30ago);
  const recent7  = events.filter(e => new Date(e.created_at) > days7ago);

  if (events.length === 0 || recent30.length === 0) {
    score -= 15;
  } else if (recent7.length === 0) {
    score -= 8;
  }

  if (events.length > 0) {
    const sorted = [...events].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const lastDate = new Date(sorted[0].created_at);
    if (lastDate < days14ago) score -= 5;
    if (lastDate > days3ago)  score += 5;  // recency bonus
  }

  // ── Completion bonus ──────────────────────────────────────────────────────
  if (tasks.length > 0 && completedTasks.length === tasks.length) score += 10;

  // ── Floor / ceiling ───────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  const status = score >= 75 ? "stable" : score >= 40 ? "at-risk" : "critical";
  return { score, status };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const body = await req.json().catch(() => ({}));
    const clientIdFilter: string | null = body.client_id ?? null;

    // ── Fetch all data in parallel (one query per table) ───────────────────
    let clientsQuery = supabase.from("clients").select("id, name").eq("user_id", userId);
    if (clientIdFilter) clientsQuery = clientsQuery.eq("id", clientIdFilter);

    const { data: clients, error: clientsError } = await clientsQuery;
    if (clientsError) throw clientsError;
    if (!clients?.length) {
      return new Response(JSON.stringify({ updated: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientIds = clients.map(c => c.id);

    const [
      { data: allTasks },
      { data: allReminders },
      { data: allEvents },
    ] = await Promise.all([
      supabase.from("tasks").select("client_id, status, due_date").eq("user_id", userId),
      supabase.from("reminders").select("client_id, due_date").eq("user_id", userId).eq("is_done", false),
      supabase.from("timeline_events").select("client_id, created_at").in("client_id", clientIds),
    ]);

    // ── Score each client and batch-update ─────────────────────────────────
    const updates: Array<{ id: string; name: string; health_score: number; status: string }> = [];

    for (const client of clients) {
      const tasks     = (allTasks     ?? []).filter(t => t.client_id === client.id);
      const reminders = (allReminders ?? []).filter(r => r.client_id === client.id);
      const events    = (allEvents    ?? []).filter(e => e.client_id === client.id);

      const { score, status } = calculateScore(tasks, reminders, events);

      await supabase
        .from("clients")
        .update({ health_score: score, status })
        .eq("id", client.id);

      updates.push({ id: client.id, name: client.name, health_score: score, status });
    }

    return new Response(JSON.stringify({ updated: updates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("calculate-health error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
