import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_OAUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  return { user, supabase: userClient };
}

// @ts-ignore
Deno.serve({ verify_jwt: false }, async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, supabase } = await requireUser(req);
    const { action, code, redirectUri } = await req.json().catch(() => ({}));

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth secrets are not configured.");
    }

    if (action === "start") {
      if (!redirectUri) throw new Error("redirectUri is required.");

      const state = `${user.id}:${crypto.randomUUID()}`;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        scope: GMAIL_SCOPE,
        include_granted_scopes: "true",
        state,
      });

      return new Response(
        JSON.stringify({ authUrl: `${GOOGLE_OAUTH_ENDPOINT}?${params.toString()}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "exchange") {
      if (!code || !redirectUri) {
        throw new Error("code and redirectUri are required.");
      }

      const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(tokenData?.error_description ?? "Token exchange failed.");
      }

      const accessToken = tokenData.access_token as string;
      const refreshToken = tokenData.refresh_token as string | undefined;
      if (!accessToken) throw new Error("No access token returned by Google.");
      if (!refreshToken) {
        throw new Error("No refresh token returned. Reconnect Gmail and re-consent.");
      }

      const { error } = await supabase.from("email_integrations").upsert({
        user_id: user.id,
        gmail_access_token: accessToken,
        gmail_refresh_token: refreshToken,
        connected_at: new Date().toISOString(),
      });
      if (error) throw error;

      return new Response(
        JSON.stringify({ connected: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "status") {
      const { data, error } = await supabase
        .from("email_integrations")
        .select("connected_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;

      return new Response(
        JSON.stringify({ connected: !!data, connectedAt: data?.connected_at ?? null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    throw new Error("Unsupported action.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : 400;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
