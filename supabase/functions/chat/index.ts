import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Voyage embedding helper ──────────────────────────────────────────────────

async function getEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: text, model: "voyage-3" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// ─── RAG retrieval ────────────────────────────────────────────────────────────

async function retrieveContext(
  supabase: any,
  userMessage: string,
  clientId: string | null,
  voyageKey: string
): Promise<string> {
  try {
    const queryEmbedding = await getEmbedding(userMessage, voyageKey);
    if (!queryEmbedding) return "";

    const { data: matches } = await supabase.rpc("match_flow_documents", {
      query_embedding: queryEmbedding,
      filter_client_id: clientId,
      match_count: 5,
    });

    if (!matches?.length) return "";

    return matches
      .filter((m: any) => m.similarity > 0.5)
      .map((m: any) => m.content)
      .join("\n\n");
  } catch (e) {
    console.error("RAG retrieval error:", e);
    return "";
  }
}

// ─── Task 1: Embed conversation exchange after streaming ──────────────────────

async function embedConversation(
  supabase: any,
  userId: string,
  sessionId: string | null,
  userMessage: string,
  assistantResponse: string,
  voyageKey: string
): Promise<void> {
  try {
    if (!userMessage || !assistantResponse) return;
    const exchangeText = `User: ${userMessage}\n\nAssistant: ${assistantResponse}`;
    const embedding = await getEmbedding(exchangeText, voyageKey);
    if (!embedding) return;

    await supabase.from("flow_embeddings").insert({
      consultant_id: userId,
      session_id: sessionId ?? null,
      client_id: null,
      content: exchangeText,
      doc_type: "conversation",
      embedding,
    });
  } catch (e) {
    console.error("Conversation embedding error:", e);
  }
}

// ─── Task 3: Embed client profiles in background ──────────────────────────────

async function embedClientProfiles(
  supabase: any,
  userId: string,
  clients: any[],
  tasks: any[],
  voyageKey: string
): Promise<void> {
  try {
    if (!clients.length) return;

    // Fetch all existing client_profile embeddings for this consultant
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("flow_embeddings")
      .select("client_id, created_at")
      .eq("consultant_id", userId)
      .eq("doc_type", "client_profile")
      .gte("created_at", cutoff);

    const recentClientIds = new Set((existing ?? []).map((r: any) => r.client_id));

    for (const client of clients) {
      if (recentClientIds.has(client.id)) continue;

      const clientTasks = tasks.filter((t: any) => t.client_id === client.id);
      const openCount = clientTasks.filter((t: any) => t.status !== "complete").length;

      const summary =
        `Client: ${client.name} | Company: ${client.company} | Role: ${client.role} | ` +
        `Status: ${client.status} | Health score: ${client.health_score}/100 | ` +
        `Open tasks: ${openCount}`;

      const embedding = await getEmbedding(summary, voyageKey);
      if (!embedding) continue;

      await supabase.from("flow_embeddings").insert({
        consultant_id: userId,
        client_id: client.id,
        session_id: null,
        content: summary,
        doc_type: "client_profile",
        embedding,
      });
    }
  } catch (e) {
    console.error("Client profile embedding error:", e);
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  clients: any[],
  tasks: any[],
  reminders: any[],
  today: string,
  ragContext: string
): string {
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
        ? `  Urgent items: ${urgent.map((t: any) => `"${t.title}"`).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const urgentTasks = tasks.filter((t) => t.status === "urgent");
  const overdueTasks = tasks.filter(
    (t) => t.due_date && daysFromNow(t.due_date)! < 0 && t.status !== "complete"
  );
  const dueTodayTasks = tasks.filter(
    (t) => t.due_date && daysFromNow(t.due_date) === 0 && t.status !== "complete"
  );
  const todayReminders = reminders.filter((r) => r.due_date && daysFromNow(r.due_date) === 0);
  const upcomingReminders = reminders.filter((r) => {
    if (!r.due_date) return false;
    const d = daysFromNow(r.due_date)!;
    return d > 0 && d <= 7;
  });

  return `You are Clairo — an AI Chief of Staff for a boutique professional services firm.
Today is ${today}.

Your role: help the user run their client portfolio with the confidence and clarity of a 20-person firm. You know every client, every deadline, and every risk. Be concise, direct, and proactive. Lead with what matters most. Use markdown formatting.
${
  ragContext
    ? `
━━━ RELEVANT CONTEXT FROM MEMORY ━━━
${ragContext}
`
    : ""
}
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
${dueTodayTasks.length > 0 ? dueTodayTasks.map((t) => `📌 "${t.title}"`).join("\n") : "Nothing due today."}

━━━ TODAY'S REMINDERS ━━━
${todayReminders.length > 0 ? todayReminders.map((r) => `🔔 ${r.title} (${r.type})`).join("\n") : "No reminders for today."}

━━━ ALL CLIENTS (FULL DETAIL) ━━━
${clientSummaries.join("\n\n")}

━━━ UPCOMING REMINDERS (next 7 days) ━━━
${upcomingReminders.length > 0 ? upcomingReminders.map((r) => `• ${r.title} — ${relativeDate(r.due_date)}`).join("\n") : "None."}

━━━ INSTRUCTIONS ━━━
- When asked for a daily briefing or "what should I focus on", lead with the most urgent issues first, then at-risk clients, then what's due today. End with one clear recommended next action.
- When asked about a specific client, give their full picture: status, health score, open tasks, deadlines, and your recommended next step.
- When asked "what's pending" or "next steps", be specific — name the task, the client, and the deadline.
- If relevant context from memory was provided above, reference it specifically in your answer.
- Keep responses tight. Use bullet points for lists, bold for client names and task titles. No filler.
- You are a trusted advisor, not a search engine. Offer a perspective, not just data.`;
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

    const jwt = authHeader.slice(7);
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // ── Refresh health scores in background (no await) ─────────────────────
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/calculate-health`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {});

    // ── Parse body ─────────────────────────────────────────────────────────
    const { messages, clientId, sessionId } = await req.json();

    // ── Fetch context (clients, tasks, reminders) ──────────────────────────
    const [{ data: clients }, { data: tasks }, { data: reminders }] =
      await Promise.all([
        supabase.from("clients").select("*").eq("user_id", userId),
        supabase.from("tasks").select("*").eq("user_id", userId),
        supabase.from("reminders").select("*").eq("user_id", userId).eq("is_done", false),
      ]);

    const VOYAGE_API_KEY = Deno.env.get("VOYAGE_API_KEY");

    // ── Task 3: Embed client profiles in background (no await) ────────────
    if (VOYAGE_API_KEY) {
      embedClientProfiles(supabase, userId, clients ?? [], tasks ?? [], VOYAGE_API_KEY);
    }

    // ── Task 2: RAG retrieval ──────────────────────────────────────────────
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user")?.content ?? "";
    const ragContext = VOYAGE_API_KEY
      ? await retrieveContext(supabase, lastUserMessage, clientId ?? null, VOYAGE_API_KEY)
      : "";

    const today = new Date().toISOString().split("T")[0];
    const systemPrompt = buildSystemPrompt(
      clients ?? [],
      tasks ?? [],
      reminders ?? [],
      today,
      ragContext
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
        messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
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

    // ── Stream back to client, accumulate full response for memory ─────────
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const reader = claudeResponse.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullAssistantText = "";

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
              if (
                event.type === "content_block_delta" &&
                event.delta?.type === "text_delta" &&
                event.delta?.text
              ) {
                fullAssistantText += event.delta.text;
                const openAIChunk = {
                  choices: [{ delta: { content: event.delta.text } }],
                };
                await writer.write(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
              }
              if (event.type === "message_stop") {
                await writer.write(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // ignore parse errors on individual SSE lines
            }
          }
        }

        // ── Task 1: Embed the exchange into memory (fire-and-forget) ──────
        if (VOYAGE_API_KEY && lastUserMessage && fullAssistantText) {
          embedConversation(
            supabase, userId, sessionId ?? null,
            lastUserMessage, fullAssistantText, VOYAGE_API_KEY
          );
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
