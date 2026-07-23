import { createFileRoute } from "@tanstack/react-router";

const RICH_ANSWER_RULES = `

## Scope — MANDATORY
You are strictly a hospital / health / IB Tech E-Health platform assistant for Ambo General Hospital.
- STAY ON-CONTEXT: only answer questions related to health, medicine, drugs, patient care, hospital operations, this platform, or the current user's role.
- If a question is clearly off-topic (celebrity gossip, sports scores, unrelated coding help, politics, personal chit-chat, etc.), politely decline in one short sentence and redirect the user back to health/hospital topics. Do NOT attempt to answer it.
- You MAY and SHOULD pull **fresh information from the open web** using your web-search grounding — trusted medical sites, drug databases, WHO/CDC/NIH news, hospital references. Never invent facts you can verify online.
- Prefer authoritative sources: MedlinePlus, WHO, CDC, NIH, Mayo Clinic, Drugs.com, RxList, PubMed, Ethiopian Ministry of Health (moh.gov.et), Wikipedia (starting point only).


## Response style — MANDATORY
When you answer, always:
- Use rich **Markdown**: clear headings, **bold**, tables, bullet & numbered lists.
- When comparing 2+ items (drugs, treatments, plans, prices), render a **markdown table**.
- When explaining a process or decision flow, include a compact **Mermaid diagram** in a \`\`\`mermaid code block (flowchart TD).
- When a picture would help (anatomy, drug, procedure, condition, pattern), **embed an image** using inline markdown: \`![caption](https://…)\`. Prefer images from Wikipedia Commons (\`upload.wikimedia.org\`), MedlinePlus, WHO, CDC, NIH — these are copyright-safe and load in any browser.
- Cite sources as **inline markdown links** to authoritative medical/hospital sources: MedlinePlus (medlineplus.gov), WHO (who.int), CDC (cdc.gov), NIH (nih.gov), Mayo Clinic (mayoclinic.org), Drugs.com, RxList, Ethiopian Ministry of Health (moh.gov.et) when relevant.
- For drug questions include a table with: **Drug · Dose · How to take · Common side effects · Cautions · Source link**.
- For news / "latest" questions, say the information reflects your latest training knowledge, list what is well established, and link to trusted news sources (WHO news, Reuters Health, NYT Health) so the user can verify.
- If the user is clearly asking you to *draw / generate / sketch / make* an image, tell them to click the 🎨 button in the composer — you will then generate the picture for them.
- Keep answers structured, warm and easy to scan. Never dump a wall of plain text.
`;

const SYSTEM_PROMPTS: Record<string, string> = {
  web_admin:
    "You are the IB Tech platform AI for the Web Admin / Owner of the IB Tech E-Health Platform serving Ambo General Hospital. Help with hospital onboarding, subscription pricing (base package: 100 rooms for 1 year; additional room price = 5% of the total yearly price × selected years; final total = base price + additional price × duration), service countdowns, room monitoring, user account management, and summaries of hospital activity." +
    RICH_ANSWER_RULES,
  hospital_admin:
    "You are the operations AI for the Hospital Admin / Director of Ambo General Hospital. Help summarize patients and rooms, detect patterns, plan branding, manage hospital managers and support director-level decisions." +
    RICH_ANSWER_RULES,
  manager:
    "You are the workflow AI for the Hospital Manager at Ambo General Hospital. Help with patient registration, payment approval, insurance handling, room allocation, case trends and operational questions. You may inspect payment screenshots that the manager attaches and report what you see — extract transaction id, amount and sender when visible." +
    RICH_ANSWER_RULES,
  doctor_room:
    "You are the clinical support AI in a Doctor's Room at Ambo General Hospital. Summarize patient case history, suggest workflow steps, compare drug options in tables, and produce visual summaries with Mermaid diagrams and embedded reference images. You do NOT give definitive diagnoses — you support the doctor's own clinical judgment. Always remind that final medical decisions belong to the clinician. If the doctor attaches an image (skin lesion, x-ray photo, prescription note), describe what you observe factually." +
    RICH_ANSWER_RULES,
  patient:
    "You are a warm patient assistant for Ambo General Hospital. Explain medical notes and prescriptions in simple, kind language, help patients understand their case history and next steps, and answer portal questions. Never give medical advice beyond explaining what is recorded; always suggest speaking to hospital staff for medical concerns. If the patient shares an image (prescription, receipt, report photo), read it and explain gently. Use pictures and diagrams when they help understanding." +
    RICH_ANSWER_RULES,
};

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type IncomingMsg = { role: string; content: string | ContentBlock[] };

function extractText(m: IncomingMsg): string {
  if (typeof m.content === "string") return m.content;
  return (m.content as ContentBlock[])
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join(" ");
}

/** Detect "please draw / make / generate an image of X" so we can auto-switch to image mode. */
function looksLikeImageRequest(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (!t) return false;
  return /\b(generate|make|create|draw|sketch|design|render|produce|show me)\b.*\b(image|picture|photo|illustration|diagram|poster|logo|sketch|drawing)\b/.test(
    t,
  ) || /^(image|picture|photo)[:\s]/i.test(t);
}

export const Route = createFileRoute("/api/ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            messages?: IncomingMsg[];
            actor?: string;
            context?: string;
            mode?: "chat" | "image";
          };
          const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
          if (!messages.length) {
            return Response.json({ error: "Messages are required" }, { status: 400 });
          }
          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return Response.json({ error: "AI is not configured" }, { status: 500 });
          }
          const actor = body.actor && SYSTEM_PROMPTS[body.actor] ? body.actor : "patient";
          let mode = body.mode === "image" ? "image" : "chat";

          // Auto-switch to image mode when the last user message clearly asks for a drawing.
          if (mode === "chat") {
            const lastUser = [...messages].reverse().find((m) => m.role === "user");
            if (lastUser && looksLikeImageRequest(extractText(lastUser))) {
              mode = "image";
            }
          }

          // ---------------- IMAGE GENERATION MODE ----------------
          if (mode === "image") {
            const lastUser = [...messages].reverse().find((m) => m.role === "user");
            const userBlocks: ContentBlock[] = Array.isArray(lastUser?.content)
              ? (lastUser!.content as ContentBlock[])
              : [{ type: "text", text: String(lastUser?.content ?? "") }];

            const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-image",
                modalities: ["image", "text"],
                messages: [
                  {
                    role: "system",
                    content:
                      "You are an image generator for a hospital platform. Produce clear, tasteful, professional images that fit medical, educational or informational contexts. When helpful, use an Ethiopian-inspired visual identity (warm earth tones, subtle woven patterns). Never generate graphic gore, explicit content, or images of identifiable real patients.",
                  },
                  { role: "user", content: userBlocks },
                ],
              }),
            });

            if (resp.status === 429) {
              return Response.json(
                { error: "The AI is receiving too many image requests. Try again shortly." },
                { status: 429 },
              );
            }
            if (resp.status === 402) {
              return Response.json(
                { error: "AI credits are exhausted. Please add credits in workspace settings." },
                { status: 402 },
              );
            }
            if (!resp.ok) {
              const t = await resp.text();
              console.error("AI image error", resp.status, t);
              return Response.json({ error: "Image generation failed" }, { status: 500 });
            }

            const data = (await resp.json()) as {
              choices: {
                message: {
                  content?: string;
                  images?: { image_url: { url: string } }[];
                };
              }[];
            };
            const msg = data.choices?.[0]?.message;
            const images = (msg?.images ?? [])
              .map((i) => i?.image_url?.url)
              .filter((u): u is string => !!u);
            const reply = msg?.content ?? (images.length ? "Here's the image you asked for." : "");

            if (!images.length) {
              return Response.json(
                { error: "The AI didn't return an image. Try rephrasing your prompt." },
                { status: 500 },
              );
            }

            return Response.json({ reply, images });
          }

          // ---------------- REGULAR CHAT MODE ----------------
          const system =
            SYSTEM_PROMPTS[actor] +
            (body.context ? `\n\nCurrent hospital data context:\n${body.context.slice(0, 6000)}` : "");

          // Gemini supports Google-search grounding via OpenRouter's `plugins: [{id:"web"}]`.
          // The gateway safely ignores unknown fields on non-supporting models.
          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": key,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "system", content: system }, ...messages],
              plugins: [{ id: "web", max_results: 8 }],
            }),
          });

          if (resp.status === 429) {
            return Response.json(
              { error: "The AI is receiving too many requests. Please try again in a moment." },
              { status: 429 },
            );
          }
          if (resp.status === 402) {
            return Response.json(
              { error: "AI credits are exhausted. Please add credits in workspace settings." },
              { status: 402 },
            );
          }
          if (!resp.ok) {
            const t = await resp.text();
            console.error("AI gateway error", resp.status, t);
            return Response.json({ error: "AI request failed" }, { status: 500 });
          }

          const data = (await resp.json()) as {
            choices: {
              message: {
                content: string;
                annotations?: { url_citation?: { url: string; title?: string } }[];
              };
            }[];
          };
          const raw = data.choices?.[0]?.message?.content ?? "";
          const annotations = data.choices?.[0]?.message?.annotations ?? [];
          const citationLinks = annotations
            .map((a) => a.url_citation)
            .filter((c): c is { url: string; title?: string } => !!c);
          const reply =
            citationLinks.length && !/\[.+\]\(https?:\/\//.test(raw)
              ? raw +
                "\n\n**Sources**\n" +
                citationLinks.map((c, i) => `${i + 1}. [${c.title ?? c.url}](${c.url})`).join("\n")
              : raw;

          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const lastUser = messages.filter((m) => m.role === "user").pop();
            const promptText = lastUser ? extractText(lastUser) : "";
            await supabaseAdmin.from("ai_interactions").insert({
              actor_role: actor,
              prompt: promptText.slice(0, 4000),
              response: reply.slice(0, 8000),
            });
          } catch (e) {
            console.error("ai log failed", e);
          }

          return Response.json({ reply });
        } catch (e) {
          console.error(e);
          return Response.json({ error: "Unexpected AI error" }, { status: 500 });
        }
      },
    },
  },
});
