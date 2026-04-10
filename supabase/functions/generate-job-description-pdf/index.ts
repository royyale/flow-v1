import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

type RequestBody = {
  clientId: string;
  role: string;
  level?: string;
};

function wrapText(text: string, maxChars = 90) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (test.length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function markdownToPlainText(md: string) {
  return md
    .replace(/\r/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .trim();
}

async function getClient(supabase: ReturnType<typeof createClient>, clientId: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (error || !data) throw new Error("Client not found");
  return data as {
    id: string;
    name?: string;
    company?: string;
    role?: string;
  };
}

async function generateWithClaude(prompt: string) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 1400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Claude error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  return data?.content?.[0]?.text ?? "";
}

async function buildPdf(text: string) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const lines = text.split("\n");

  const addPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const drawLine = (line: string, isTitle = false) => {
    const font = isTitle ? fontBold : fontRegular;
    const size = isTitle ? 18 : 11;
    const leading = isTitle ? 26 : 15;
    const wrapped = wrapText(line, Math.max(30, Math.floor(contentWidth / (size * 0.55))));

    for (const part of wrapped) {
      if (y < margin + 20) addPage();
      page.drawText(part, {
        x: margin,
        y,
        size,
        font,
        color: rgb(0, 0, 0),
      });
      y -= leading;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trimEnd();
    if (!raw.trim()) {
      y -= 8;
      continue;
    }

    const isHeader = raw.startsWith("#");
    const isBullet = raw.startsWith("- ") || raw.startsWith("* ") || raw.startsWith("• ");

    if (isHeader) {
      drawLine(raw.replace(/^#{1,6}\s+/, ""), true);
      y -= 2;
    } else if (isBullet) {
      drawLine(raw.replace(/^[-*•]\s+/, "• "), false);
    } else {
      drawLine(raw, false);
    }
  }

  const bytes = await pdfDoc.save();
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase env vars");
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const body = (await req.json()) as RequestBody;
    const { clientId, role, level } = body;

    if (!clientId || !role) {
      return new Response(
        JSON.stringify({ error: "clientId and role are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const client = await getClient(supabase, clientId);

    const companyName = client.company || client.name || "the client";
    const prompt = `
You are Flow, an AI Chief of Staff for HR and recruiting consultants.

Write a professional job description for:
Company: ${companyName}
Role: ${role}
Level: ${level ?? "not specified"}

Use this structure:
# ${role}${level ? ` — ${level}` : ""}

## Overview
A concise paragraph describing the role and why it matters.

## Responsibilities
- 5 to 7 specific responsibilities.

## Qualifications
- 5 to 7 qualifications.

## Why This Role Matters
A short final paragraph explaining the impact.

Requirements:
- Make it polished and executive-friendly.
- Keep it practical and realistic.
- Avoid legalese.
- Use inclusive language.
- Output in clean Markdown only.
`;

    const markdown = await generateWithClaude(prompt);
    const plainText = markdownToPlainText(markdown);
    const pdfBytes = await buildPdf(plainText);

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="job-description-${clientId}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
