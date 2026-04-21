import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_MESSAGES_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

type GmailHeader = { name?: string; value?: string };

function parseAddress(fromHeader: string | undefined): { name: string; email: string } | null {
  if (!fromHeader) return null;
  const match = fromHeader.match(/^(.*)<(.+)>$/);
  if (match) return { name: match[1].trim().replace(/(^"|"$)/g, ""), email: match[2].trim().toLowerCase() };
  return { name: fromHeader, email: fromHeader.trim().toLowerCase() };
}

function getHeaderValue(headers: GmailHeader[], target: string): string | undefined {
  return headers.find((header) => header.name?.toLowerCase() === target.toLowerCase())?.value;
}

function decodeBase64Url(input: string): string {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return atob(padded);
  } catch {
    return "";
  }
}

function getEmailBody(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return "";

  const bodyData = (payload.body as Record<string, unknown> | undefined)?.data;
  if (typeof bodyData === "string" && bodyData.length > 0) {
    return decodeBase64Url(bodyData);
  }

  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (!parts?.length) return "";

  for (const part of parts) {
    const mimeType = part.mimeType;
    if (mimeType === "text/plain") {
      const data = (part.body as Record<string, unknown> | undefined)?.data;
      if (typeof data === "string" && data.length > 0) return decodeBase64Url(data);
    }
  }

  for (const part of parts) {
    const nested = getEmailBody(part);
    if (nested) return nested;
  }

  return "";
}

function getOAuthProjectHint(clientId: string): string {
  const firstSegment = clientId.split("-")[0];
  return firstSegment || "unknown";
}

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error("Failed to refresh Gmail token.");
  return data.access_token as string;
}

async function extractTaskFromEmail(anthropic: Anthropic, emailBody: string, metadata: Record<string, string>) {
  const sanitizeJsonCandidate = (input: string): string => {
    const trimmed = input.trim();

    if (trimmed.startsWith("```json") && trimmed.endsWith("```")) {
      return trimmed.slice(7, -3).trim();
    }

    if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
      return trimmed.slice(3, -3).trim();
    }

    return trimmed;
  };

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system:
      "You extract exactly one actionable task from client email content. Return STRICT raw JSON only with keys: task_title, due_date, priority, client_name, source_email_id. Do not use markdown fences. Do not use backticks. Do not add explanations. Do not add any extra text. Use ISO date for due_date when present, otherwise null. priority must be one of high|medium|low.",
    messages: [
      {
        role: "user",
        content:
          `Email metadata: ${JSON.stringify(metadata)}\n\nEmail body:\n${emailBody}\n\n` +
          "Return only strict raw JSON with the required keys. No markdown, no backticks, no explanations, no extra text.",
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") throw new Error("Claude response missing text.");
  const sanitized = sanitizeJsonCandidate(textContent.text);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(sanitized);
  } catch {
    const safeRaw = textContent.text.slice(0, 800).replace(/\s+/g, " ").trim();
    throw new Error(`JSON parse failed; raw_output=${safeRaw}`);
  }

  return {
    task_title: String(parsed.task_title ?? "").trim(),
    due_date: parsed.due_date ? new Date(parsed.due_date).toISOString() : null,
    priority: ["high", "medium", "low"].includes(parsed.priority) ? parsed.priority : "medium",
    client_name: parsed.client_name ? String(parsed.client_name) : metadata.client_name ?? null,
    source_email_id: String(parsed.source_email_id ?? metadata.source_email_id),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!googleClientId || !googleClientSecret || !anthropicKey) {
      throw new Error("Missing required provider secrets.");
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const credentialSource = "Deno.env(GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)";
    const oauthProjectHint = getOAuthProjectHint(googleClientId);
    console.log(
      `[poll-gmail-inbox] credential_source=${credentialSource} oauth_client_id=${googleClientId} oauth_project_hint=${oauthProjectHint}`,
    );

    const { data: integrations, error: integrationsError } = await serviceSupabase
      .from("email_integrations")
      .select("user_id, gmail_access_token, gmail_refresh_token");
    if (integrationsError) throw integrationsError;

    const errors: string[] = [];
    const skippedReasons: Record<string, number> = {};
    let fetched = 0;
    let afterFilter = 0;
    let tasksCreated = 0;
    let processed = 0;

    const bumpReason = (reason: string) => {
      skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
    };

    console.log(`[poll-gmail-inbox] start integrations=${integrations?.length ?? 0}`);
    for (const integration of integrations ?? []) {
      console.log(`[poll-gmail-inbox] user=${integration.user_id} loading watched clients`);
      const watched = await serviceSupabase
        .from("watched_clients")
        .select("client_name, client_email")
        .eq("user_id", integration.user_id);
      if (watched.error) {
        const msg = `user=${integration.user_id} watched_clients_error=${watched.error.message}`;
        console.error(`[poll-gmail-inbox] ${msg}`);
        errors.push(msg);
        bumpReason("watched_clients_error");
        continue;
      }
      if (!watched.data?.length) {
        bumpReason("no_watched_clients");
        console.log(`[poll-gmail-inbox] user=${integration.user_id} has no watched clients`);
        continue;
      }

      const watchedByEmail = new Map(
        watched.data.map((c) => [c.client_email.toLowerCase(), c.client_name]),
      );

      let accessToken = integration.gmail_access_token;
      const query = "newer_than:2d";
      console.log(`[poll-gmail-inbox] user=${integration.user_id} fetching gmail list query="${query}"`);
      let listRes = await fetch(`${GMAIL_MESSAGES_ENDPOINT}?maxResults=10&q=newer_than:2d`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      console.log(`[poll-gmail-inbox] user=${integration.user_id} gmail_list_status=${listRes.status}`);

      if (listRes.status === 401) {
        console.log(`[poll-gmail-inbox] user=${integration.user_id} access token expired; refreshing`);
        accessToken = await refreshAccessToken(
          integration.gmail_refresh_token,
          googleClientId,
          googleClientSecret,
        );
        await serviceSupabase
          .from("email_integrations")
          .update({ gmail_access_token: accessToken })
          .eq("user_id", integration.user_id);

        listRes = await fetch(`${GMAIL_MESSAGES_ENDPOINT}?maxResults=10&q=newer_than:2d`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        console.log(`[poll-gmail-inbox] user=${integration.user_id} gmail_list_status_after_refresh=${listRes.status}`);
      }
      if (!listRes.ok) {
        const text = await listRes.text();
        const msg = `user=${integration.user_id} gmail_list_failed status=${listRes.status} body=${text.slice(0, 200)}`;
        console.error(`[poll-gmail-inbox] ${msg}`);
        errors.push(msg);
        if (listRes.status === 403 && text.toLowerCase().includes("not been used in project")) {
          const clearMsg = "Enable Gmail API in Google Cloud Console for the OAuth project used by this app.";
          console.error(`[poll-gmail-inbox] ${clearMsg}`);
          errors.push(clearMsg);
          const traceMsg =
            `google_api_403_trace oauth_client_id=${googleClientId} oauth_project_hint=${oauthProjectHint} credential_source=${credentialSource}`;
          console.error(`[poll-gmail-inbox] ${traceMsg}`);
          errors.push(traceMsg);
          bumpReason("gmail_api_disabled_or_unenabled");
        }
        bumpReason("gmail_list_failed");
        continue;
      }

      const listData = await listRes.json();
      const messages = listData.messages ?? [];
      fetched += messages.length;
      console.log(`[poll-gmail-inbox] user=${integration.user_id} fetched_messages=${messages.length}`);

      for (const message of messages) {
        const emailId = message.id as string | undefined;
        if (!emailId) {
          bumpReason("missing_email_id");
          continue;
        }

        const alreadyProcessed = await serviceSupabase
          .from("processed_emails")
          .select("email_id")
          .eq("user_id", integration.user_id)
          .eq("email_id", emailId)
          .maybeSingle();
        if (alreadyProcessed.error) {
          const msg = `user=${integration.user_id} processed_lookup_error email=${emailId} error=${alreadyProcessed.error.message}`;
          console.error(`[poll-gmail-inbox] ${msg}`);
          errors.push(msg);
          bumpReason("processed_lookup_error");
          continue;
        }
        if (alreadyProcessed.data) {
          bumpReason("already_processed");
          continue;
        }

        const detailRes = await fetch(`${GMAIL_MESSAGES_ENDPOINT}/${emailId}?format=full`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        console.log(
          `[poll-gmail-inbox] user=${integration.user_id} gmail_detail_status email=${emailId} status=${detailRes.status}`,
        );
        if (!detailRes.ok) {
          const text = await detailRes.text();
          const msg = `user=${integration.user_id} gmail_detail_failed email=${emailId} status=${detailRes.status} body=${text.slice(0, 200)}`;
          console.error(`[poll-gmail-inbox] ${msg}`);
          errors.push(msg);
          if (detailRes.status === 403 && text.toLowerCase().includes("not been used in project")) {
            const clearMsg = "Enable Gmail API in Google Cloud Console for the OAuth project used by this app.";
            console.error(`[poll-gmail-inbox] ${clearMsg}`);
            errors.push(clearMsg);
            const traceMsg =
              `google_api_403_trace oauth_client_id=${googleClientId} oauth_project_hint=${oauthProjectHint} credential_source=${credentialSource}`;
            console.error(`[poll-gmail-inbox] ${traceMsg}`);
            errors.push(traceMsg);
            bumpReason("gmail_api_disabled_or_unenabled");
          }
          bumpReason("gmail_detail_failed");
          continue;
        }
        const detail = await detailRes.json();
        const headers = (detail.payload?.headers ?? []) as GmailHeader[];
        const from = parseAddress(getHeaderValue(headers, "From"));
        const subject = getHeaderValue(headers, "Subject") ?? "";
        const snippet = detail.snippet ?? "";
        const fullBody = getEmailBody(detail.payload);
        const emailBodyForAi = fullBody || snippet;

        if (!from) {
          bumpReason("missing_from_header");
          continue;
        }
        const matchedClientName = watchedByEmail.get(from.email);
        if (!matchedClientName) {
          bumpReason("sender_not_watched");
          console.log(
            `[poll-gmail-inbox] user=${integration.user_id} skipped email=${emailId} sender=${from.email} not in watched list`,
          );
          continue;
        }

        afterFilter += 1;
        console.log(
          `[poll-gmail-inbox] user=${integration.user_id} qualifying email=${emailId} sender=${from.email} client=${matchedClientName}`,
        );

        let extracted: Awaited<ReturnType<typeof extractTaskFromEmail>>;
        try {
          extracted = await extractTaskFromEmail(anthropic, emailBodyForAi, {
            source_email_id: emailId,
            client_name: matchedClientName,
          });
        } catch (error) {
          const msg = `user=${integration.user_id} ai_extract_failed email=${emailId} error=${error instanceof Error ? error.message : "unknown"}`;
          console.error(`[poll-gmail-inbox] ${msg}`);
          errors.push(msg);
          bumpReason("ai_extract_failed");
          continue;
        }
        if (!extracted.task_title) {
          bumpReason("empty_task_title");
          continue;
        }

        const queueInsert = await serviceSupabase.from("ai_task_review_queue").upsert({
          user_id: integration.user_id,
          source_email_id: emailId,
          sender_email: from.email,
          sender_name: from.name,
          task_title: extracted.task_title,
          due_date: extracted.due_date,
          priority: extracted.priority,
          client_name: extracted.client_name,
          email_subject: subject,
          email_snippet: snippet,
          status: "pending",
        });
        if (queueInsert.error) {
          const msg = `user=${integration.user_id} queue_insert_failed email=${emailId} error=${queueInsert.error.message}`;
          console.error(`[poll-gmail-inbox] ${msg}`);
          errors.push(msg);
          bumpReason("queue_insert_failed");
          continue;
        }
        tasksCreated += 1;

        const processedInsert = await serviceSupabase.from("processed_emails").insert({
          email_id: emailId,
          user_id: integration.user_id,
          task_generated: true,
        });
        if (processedInsert.error) {
          const msg = `user=${integration.user_id} processed_insert_failed email=${emailId} error=${processedInsert.error.message}`;
          console.error(`[poll-gmail-inbox] ${msg}`);
          errors.push(msg);
          bumpReason("processed_insert_failed");
          continue;
        }
        processed += 1;
      }
    }

    console.log(
      `[poll-gmail-inbox] done fetched=${fetched} afterFilter=${afterFilter} tasksCreated=${tasksCreated} processed=${processed}`,
    );
    return new Response(
      JSON.stringify({ fetched, afterFilter, tasksCreated, processed, errors, skippedReasons }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
