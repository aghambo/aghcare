import { useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

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
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const resp = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, actor, context }),
      });
      const data = (await resp.json()) as { reply?: string; error?: string };
      if (!resp.ok || !data.reply) {
        setMessages([...next, { role: "assistant", content: `⚠️ ${data.error ?? "AI request failed."}` }]);
      } else {
        setMessages([...next, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setMessages([...next, { role: "assistant", content: "⚠️ Network error. Please try again." }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 60);
    }
  };

  return (
    <div className="card-panel flex flex-col overflow-hidden">
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
            Ask anything — summaries, explanations, next steps. Answers appear here with rich
            formatting.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm gradient-hero px-4 py-2.5 text-sm text-primary-foreground"
                  : "prose prose-sm max-w-[90%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm [&_table]:text-xs"
              }
            >
              {m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask the assistant…"
          className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-xl gradient-gold text-gold-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
