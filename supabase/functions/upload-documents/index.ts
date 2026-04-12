import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Text extraction ──────────────────────────────────────────────────────────

async function extractText(fileBytes: Uint8Array, fileType: string): Promise<string> {
  // Plain text / markdown — just decode
  if (fileType.includes("text/plain") || fileType.includes("text/markdown")) {
    return new TextDecoder().decode(fileBytes);
  }

  // CSV — decode and clean
  if (fileType.includes("text/csv")) {
    return new TextDecoder().decode(fileBytes);
  }

  // PDF — send to Claude vision for extraction
  if (fileType.includes("pdf")) {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const base64 = btoa(String.fromCharCode(...fileBytes));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: "Extract all text content from this document. Return only the raw text, preserving structure where helpful. No commentary.",
            },
          ],
        }],
      }),
    });

    if (!response.ok) throw new Error("PDF extraction failed");
    const data = await response.json();
    return data.content?.[0]?.text ?? "";
  }

  // DOCX — basic XML text extraction (strips tags)
  if (fileType.includes("wordprocessingml") || fileType.includes("docx")) {
    try {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(fileBytes);
      // Extract text between XML tags — basic but effective for DOCX
      const matches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) ?? [];
      return matches
        .map(m => m.replace(/<[^>]+>/g, ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      return "";
    }
  }

  return "";
}

// ─── Chunk text for embedding ─────────────────────────────────────────────────

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) chunks.push(chunk.trim());
    i += chunkSize - overlap;
  }
  return chunks;
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

    // ── Parse multipart form ───────────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const clientId = formData.get("clientId") as string | null;
    const sessionId = formData.get("sessionId") as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const fileType = file.type;
    const fileName = file.name;

    // ── Upload to Supabase Storage ─────────────────────────────────────────
    const storagePath = `${user.id}/${sessionId ?? "general"}/${Date.now()}_${fileName}`;

    const { error: storageError } = await supabase.storage
      .from("flow-documents")
      .upload(storagePath, fileBytes, {
        contentType: fileType,
        upsert: false,
      });

    if (storageError) throw storageError;

    // ── Extract text ───────────────────────────────────────────────────────
    const extractedText = await extractText(fileBytes, fileType);

    // ── Save document record ───────────────────────────────────────────────
    const { data: doc, error: docError } = await supabase
      .from("flow_documents")
      .insert({
        consultant_id: user.id,
        client_id: clientId ?? null,
        session_id: sessionId ?? null,
        file_name: fileName,
        file_type: fileType,
        storage_path: storagePath,
        content_text: extractedText,
        embedded: false,
      })
      .select()
      .single();

    if (docError) throw docError;

    // ── Embed chunks into pgvector ─────────────────────────────────────────
    const VOYAGE_API_KEY = Deno.env.get("VOYAGE_API_KEY");

    if (VOYAGE_API_KEY && extractedText) {
      const chunks = chunkText(extractedText);

      for (const chunk of chunks) {
        // Get embedding from Voyage AI
        const embeddingRes = await fetch("https://api.voyageai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VOYAGE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: chunk,
            model: "voyage-3",
          }),
        });

        if (!embeddingRes.ok) continue;
        const embeddingData = await embeddingRes.json();
        const embedding = embeddingData.data?.[0]?.embedding;
        if (!embedding) continue;

        // Store embedding
        await supabase.from("flow_embeddings").insert({
          consultant_id: user.id,
          client_id: clientId ?? null,
          document_id: doc.id,
          session_id: sessionId ?? null,
          content: chunk,
          doc_type: "document",
          embedding,
        });
      }

      // Mark document as embedded
      await supabase
        .from("flow_documents")
        .update({ embedded: true })
        .eq("id", doc.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId: doc.id,
        fileName,
        extractedLength: extractedText.length,
        embedded: !!VOYAGE_API_KEY,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("upload-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});