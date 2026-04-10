import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysFromNow(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return "no date";
  const d = daysFromNow(dateStr)!;
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "due today";
  if (d === 1) return "due tomorrow";
  return `due in ${d}d`;
}

function buildSystemPrompt(
  clients: any[],
  tasks: any[],
  reminders: any[],
  today: string
): string {
  // ── Pre-process clients ──────────────────────────────────────────────────
  const atRisk = clients.filter((c) => c.status === "at-risk");
  const stable = clients.filter((c) => c.status !== "at-risk");

  const clientSummaries = clients.map((c) => {
    const clientTasks = tasks.filter((t) => t.client_id === c.id);
    const urgent = clientTasks.filter((t) => t.status === "urgent");
    const open = clientTasks.filter((t) => t.status !== "complete");
    const nextDeadline = clientTasks
      .filter((t) => t.due_date && t.status !== "complete")
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

    return [
      `CLIENT: ${c.name} (${c.role} @ ${c.company})`,
      `  Status: ${c.status} | Health score: ${c.health_score}/100`,
      `  Open tasks: ${open.length} | Urgent: ${urgent.length}`,
      nextDeadline
        ? `  Next deadline: "${nextDeadline.title}" — ${relativeDate(nextDeadline.due_date)}`
        : `  Next deadline: none`,
      urgent.length > 0
        ? `  Urgent items: ${urgent.map((t) => `"${t.title}"`).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  // ── Pre-process tasks ────────────────────────────────────────────────────
  const urgentTasks = tasks.filter((t) => t.status === "urgent");
  const overdueTasks = tasks.filter(
    (t) => t.due_date && daysFromNow(t.due_date)! < 0 && t.status !== "complete"
  );
  const dueTodayTasks = tasks.filter(
    (t) => t.due_date && daysFromNow(t.due_date) === 0 && t.status !== "complete"
  );

  // ── Pre-process reminders ────────────────────────────────────────────────
  const todayReminders = reminders.filter((r) => {
    if (!r.due_date) return false;
    return daysFromNow(r.due_date) === 0;
  });
  const upcomingReminders = reminders.filter((r) => {
    if (!r.due_date) return false;
    const d = daysFromNow(r.due_date)!;
    return d > 0 && d <= 7;
  });

  return `You are Clairo — an AI Chief of Staff for a boutique professional services firm.
Today is ${today}.

Your role: help the user run their client portfolio with the confidence and clarity of a 20-person firm. You know every client, every deadline, and every risk. Be concise, direct, and proactive. Lead with what matters most. Use markdown formatting.

━━━ PORTFOLIO SNAPSHOT ━━━
Total clients: ${clients.length} | At-risk: ${atRisk.length} | Stable: ${stable.length}
Urgent tasks: ${urgentTasks.length} | Overdue: ${overdueTasks.length} | Due today: ${dueTodayTasks.length}
Today's reminders: ${todayReminders.length}

━━━ AT-RISK CLIENTS ━━━
${
  atRisk.length > 0
    ? atRisk.map((c) => `⚠️ ${c.name} (${c.company}) — health score ${c.health_score}/100`).join("\n")
    : "None — all clients are stable."
}

━━━ URGENT & OVERDUE ━━━
${
  urgentTasks.length === 0 && overdueTasks.length === 0
    ? "No urgent or overdue tasks."
    : [
        ...urgentTasks.map((t) => `🔴 "${t.title}" — ${relativeDate(t.due_date)}`),
        ...overdueTasks
          .filter((t) => t.status !== "urgent")
          .map((t) => `⏰ "${t.title}" — ${relativeDate(t.due_date)}`),
      ].join("\n")
}

━━━ DUE TODAY ━━━
${
  dueTodayTasks.length > 0
    ? dueTodayTasks.map((t) => `📌 "${t.title}"`).join("\n")
    : "Nothing due today."
}

━━━ TODAY'S REMINDERS ━━━
${
  todayReminders.length > 0
    ? todayReminders.map((r) => `🔔 ${r.title} (${r.type})`).join("\n")
    : "No reminders for today."
}

━━━ ALL CLIENTS (FULL DETAIL) ━━━
${clientSummaries.join("\n\n")}

━━━ UPCOMING REMINDERS (next 7 days) ━━━
${
  upcomingReminders.length > 0
    ? upcomingReminders
        .map((r) => `• ${r.title} — ${relativeDate(r.due_date)}`)
        .join("\n")
    : "None."
}

━━━ INSTRUCTIONS ━━━
- When asked for a daily briefing or "what should I focus on", lead with the most urgent issues first, then at-risk clients, then what's due today. End with one clear recommended next action.
- When asked about a specific client, give their full picture: status, health score, open tasks, deadlines, and your recommended next step.
- When asked "what's pending" or "next steps", be specific — name the task, the client, and the deadline.
- Keep responses tight. Use bullet points for lists, bold for client names and task titles. No filler.
- You are a trusted advisor, not a search engine. Offer a perspective, not just data.`;
}

// ─── Main handler ────────────────────────────────────────────────────────────

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
      "https://urmebzjctesztdyzxaor.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybWViempjdGVzenRkeXp4YW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTc0ODQsImV4cCI6MjA5MDczMzQ4NH0.jg-OxOtzLQkQKQ4jZ5pbqwTccBC8jip1H0IIZS0hfoY",
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

    // ── Parse body ─────────────────────────────────────────────────────────
    const { messages } = await req.json();

    // ── Fetch context ──────────────────────────────────────────────────────
    const [{ data: clients }, { data: tasks }, { data: reminders }] =
      await Promise.all([
        supabase.from("clients").select("*").eq("user_id", userId),
        supabase.from("tasks").select("*").eq("user_id", userId),
        supabase
          .from("reminders")
          .select("*")
          .eq("user_id", userId)
          .eq("is_done", false),
      ]);

    const today = new Date().toISOString().split("T")[0];
    const systemPrompt = buildSystemPrompt(
      clients ?? [],
      tasks ?? [],
      reminders ?? [],
      today
    );

    // ── Call Claude API ────────────────────────────────────────────────────
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        stream: true,
        system: systemPrompt,
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Claude API error:", claudeResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Transform Claude SSE → OpenAI-compatible SSE ───────────────────────
    // AIChatRail expects OpenAI-style: choices[0].delta.content
    // Claude streams: content_block_delta with delta.text
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const reader = claudeResponse.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const event = JSON.parse(jsonStr);
              // Claude sends content_block_delta events with delta.type === "text_delta"
              if (
                event.type === "content_block_delta" &&
                event.delta?.type === "text_delta" &&
                event.delta?.text
              ) {
                // Re-emit as OpenAI-compatible format so AIChatRail works unchanged
                const openAIChunk = {
                  choices: [{ delta: { content: event.delta.text } }],
                };
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`)
                );
              }
              if (event.type === "message_stop") {
                await writer.write(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // ignore parse errors on individual lines
            }
          }
        }
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});