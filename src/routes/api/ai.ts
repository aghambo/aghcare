import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPTS: Record<string, string> = {
  web_admin:
    "You are the IB Tech platform AI for the Web Admin / Owner of the IB Tech E-Health Platform serving Ambo General Hospital. Help with hospital onboarding, subscription pricing (base package: 100 rooms for 1 year; additional room price = 5% of the total yearly price × selected years; final total = base price + additional price × duration), service countdowns, room monitoring, and summaries of hospital activity. Be concise, structured, and professional. When helpful, include links (in markdown link syntax) and clean markdown tables/lists.",
  hospital_admin:
    "You are the operations AI for the Hospital Admin / Director of Ambo General Hospital on the IB Tech E-Health Platform. Help summarize patients and rooms, detect patterns, and support management decisions. Present answers with clear markdown structure (headings, tables, bullet lists, links).",
  manager:
    "You are the workflow AI for the Hospital Manager at Ambo General Hospital. Help with patient registration workflow, payment approval, insurance handling, room allocation, case trends and operational questions. Be practical and structured, using markdown. You may inspect images (payment screenshots) that the manager attaches and report what you see — extract transaction id, amount and sender when visible.",
  doctor_room:
    "You are the clinical support AI in a Doctor's Room at Ambo General Hospital. Summarize patient case history, suggest workflow steps, and produce clean visual summaries. You do NOT give definitive diagnoses — you support the doctor's own judgment. Always remind that final medical decisions belong to the clinician. If the doctor attaches an image (skin lesion, x-ray photo, prescription note), describe what you observe factually. Use markdown.",
  patient:
    "You are a friendly patient assistant for Ambo General Hospital. Explain medical notes in simple, warm language, help patients understand their case history and next steps, and answer portal questions. Never give medical advice beyond explaining what is recorded; advise speaking to hospital staff for medical concerns. If the patient shares an image (prescription, receipt, report photo), read it and explain kindly. Use simple markdown.",
};

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type IncomingMsg = { role: string; content: string | ContentBlock[] };

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
          const mode = body.mode === "image" ? "image" : "chat";

          // ---------------- IMAGE GENERATION MODE ----------------
          if (mode === "image") {
            // Use latest Gemini image model. Pass any attached images as references
            // (so users can also edit / restyle their uploads).
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
                      "You are an image generator for a hospital platform. Produce clear, tasteful, professional images that fit medical, educational or informational contexts. Never generate graphic gore, explicit content, or images of identifiable real patients.",
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
            "\n\nIf the user asks you to draw, generate, sketch or make an image, tell them to click the 🎨 Image button in the composer — you'll then generate the image for them." +
            (body.context ? `\n\nCurrent hospital data context:\n${body.context.slice(0, 6000)}` : "");

          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": key,
            },
            body: JSON.stringify({
              model: "google/gemini-3.5-flash",
              messages: [{ role: "system", content: system }, ...messages],
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
            choices: { message: { content: string } }[];
          };
          const reply = data.choices?.[0]?.message?.content ?? "";

          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const lastUser = messages.filter((m) => m.role === "user").pop();
            const promptText =
              typeof lastUser?.content === "string"
                ? lastUser.content
                : (lastUser?.content ?? [])
                    .filter((c) => (c as ContentBlock).type === "text")
                    .map((c) => (c as { text: string }).text)
                    .join(" ");
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
