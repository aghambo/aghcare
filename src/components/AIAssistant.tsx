import { useRef, useState } from "react";
import { ImageIcon, Loader2, Send, Sparkles, Wand2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { fileToBase64 } from "@/lib/media";

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type Msg = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
  display?: string;
  images?: string[]; // for user: attached; for assistant: generated
};

export function AIAssistant({
  actor,
  context,
  compact,
}: {
  actor: "web_admin" | "hospital_admin" | "manager" | "doctor_room" | "patient";
  context?: string;
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<{ dataUrl: string; file: File }[]>([]);
  const [busy, setBusy] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const next = await Promise.all(
      Array.from(files)
        .slice(0, 3)
        .map(async (f) => ({ dataUrl: `data:${f.type};base64,${await fileToBase64(f)}`, file: f })),
    );
    setImages((cur) => [...cur, ...next].slice(0, 3));
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && images.length === 0) || busy) return;

    const userContent: ContentBlock[] = [];
    if (text) userContent.push({ type: "text", text });
    for (const img of images) userContent.push({ type: "image_url", image_url: { url: img.dataUrl } });

    const userMsg: Msg = {
      role: "user",
      content: userContent.length === 1 && userContent[0].type === "text" ? text : userContent,
      display: text,
      images: images.map((i) => i.dataUrl),
    };

    const next = [...messages, userMsg];
    setMessages(next);
    const wasImageMode = imageMode;
    setInput("");
    setImages([]);
    setBusy(true);
    try {
      const wireMessages = next.map((m) => ({ role: m.role, content: m.content }));
      const resp = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: wireMessages,
          actor,
          context,
          mode: wasImageMode ? "image" : "chat",
        }),
      });
      const data = (await resp.json()) as { reply?: string; images?: string[]; error?: string };
      if (!resp.ok) {
        setMessages([...next, { role: "assistant", content: `⚠️ ${data.error ?? "AI request failed."}` }]);
      } else {
        setMessages([
          ...next,
          {
            role: "assistant",
            content: data.reply ?? "",
            images: data.images ?? [],
          },
        ]);
      }
    } catch {
      setMessages([...next, { role: "assistant", content: "⚠️ Network error. Please try again." }]);
    } finally {
      setBusy(false);
      setImageMode(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 60);
    }
  };

  return (
    <div className="glass flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 gradient-hero px-4 py-3 text-primary-foreground">
        <Sparkles className="h-4 w-4 text-gold" />
        <span className="text-sm font-bold">AI Assistant</span>
        <span className="ml-auto rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          {actor.replace("_", " ")}
        </span>
      </div>
      <div
        ref={scrollRef}
        className={`flex-1 space-y-3 overflow-y-auto p-4 ${compact ? "max-h-72" : "max-h-96"}`}
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ask anything, attach an image (screenshot, prescription, report), or hit the 🎨 button to
            generate an image. Answers support markdown, tables, images and links.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm gradient-hero px-4 py-2.5 text-sm text-primary-foreground"
                  : "prose prose-sm max-w-[90%] rounded-2xl rounded-bl-sm bg-muted/70 backdrop-blur px-4 py-2.5 text-sm [&_table]:text-xs [&_a]:text-primary [&_a]:underline"
              }
            >
              {m.role === "user" ? (
                <div className="space-y-2">
                  {m.images && m.images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {m.images.map((src, k) => (
                        <img
                          key={k}
                          src={src}
                          alt=""
                          className="h-20 w-20 rounded-lg object-cover ring-1 ring-white/40"
                        />
                      ))}
                    </div>
                  )}
                  {m.display && <div>{m.display}</div>}
                </div>
              ) : (
                <div className="space-y-2">
                  {typeof m.content === "string" && m.content && (
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  )}
                  {m.images && m.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 not-prose">
                      {m.images.map((src, k) => (
                        <a key={k} href={src} target="_blank" rel="noreferrer">
                          <img
                            src={src}
                            alt="AI generated"
                            className="max-h-64 rounded-xl ring-1 ring-border shadow-md"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {imageMode ? "Generating image…" : "Thinking…"}
          </div>
        )}
      </div>
      {images.length > 0 && (
        <div className="flex gap-2 border-t border-border/60 bg-muted/40 px-3 py-2">
          {images.map((img, i) => (
            <div key={i} className="relative">
              <img src={img.dataUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
              <button
                onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {imageMode && (
        <div className="border-t border-border/50 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold-foreground/80">
          🎨 Image mode — your next prompt will generate an image. Click the wand again to cancel.
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-border/50 bg-card/50 p-3 backdrop-blur">
        <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-input bg-background/60 text-muted-foreground hover:border-primary">
          <ImageIcon className="h-4 w-4" />
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addImages(e.target.files)}
          />
        </label>
        <button
          type="button"
          onClick={() => setImageMode((m) => !m)}
          title="Generate an image with AI"
          className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
            imageMode
              ? "border-gold bg-gold text-gold-foreground"
              : "border-input bg-background/60 text-muted-foreground hover:border-primary"
          }`}
        >
          <Wand2 className="h-4 w-4" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={imageMode ? "Describe the image to generate…" : "Ask the assistant…"}
          className="glass-input flex-1 rounded-xl px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
        />
        <button
          onClick={send}
          disabled={busy || (!input.trim() && images.length === 0)}
          className="flex h-9 w-9 items-center justify-center rounded-xl gradient-gold text-gold-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
