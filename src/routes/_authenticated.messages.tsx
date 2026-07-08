import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCheck, FileText, Paperclip, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signedUrl } from "@/lib/media";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Secure Conversation — IB Tech E-Health" }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["messages"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("*").order("created_at");
      const withUrls = await Promise.all(
        (data ?? []).map(async (m) => ({
          ...m,
          attachment_signed: m.attachment_url ? await signedUrl("chat-files", m.attachment_url) : null,
        })),
      );
      return withUrls;
    },
  });

  // realtime + mark incoming as read
  useEffect(() => {
    const channel = supabase
      .channel("chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!user || !messages) return;
    const unreadIncoming = messages.filter((m) => m.sender_id !== user.id && !m.read).map((m) => m.id);
    if (unreadIncoming.length) {
      supabase.from("messages").update({ read: true }).in("id", unreadIncoming).then(() => {
        queryClient.invalidateQueries({ queryKey: ["messages"] });
      });
    }
    scrollRef.current?.scrollTo({ top: 999999 });
  }, [messages, user, queryClient]);

  const send = async () => {
    if ((!text.trim() && !file) || !user) return;
    setSending(true);
    try {
      let attachmentPath: string | null = null;
      let attachmentType: string | null = null;
      if (file) {
        attachmentPath = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const { error } = await supabase.storage.from("chat-files").upload(attachmentPath, file);
        if (error) throw new Error("Attachment upload failed");
        attachmentType = file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("audio/")
            ? "audio"
            : file.type === "application/pdf"
              ? "pdf"
              : "file";
      }
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        content: text.trim() || null,
        attachment_url: attachmentPath,
        attachment_type: attachmentType,
        attachment_name: file?.name ?? null,
      });
      if (error) throw error;
      setText("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate({ to: role === "web_admin" ? "/web-admin" : "/hospital-admin" })}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-display font-bold">Owner ↔ Hospital Director</h1>
            <p className="text-xs text-muted-foreground">Secure conversation · text, images, voice, PDFs & files</p>
          </div>
        </div>
        <div className="gold-divider" />
      </header>

      <div ref={scrollRef} className="mx-auto w-full max-w-3xl flex-1 space-y-3 overflow-y-auto px-4 py-6">
        {(messages ?? []).map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-card ${mine ? "rounded-br-sm gradient-hero text-primary-foreground" : "rounded-bl-sm bg-card"}`}
              >
                {m.attachment_signed && m.attachment_type === "image" && (
                  <a href={m.attachment_signed} target="_blank" rel="noreferrer">
                    <img src={m.attachment_signed} alt="" loading="lazy" className="mb-2 max-h-52 rounded-xl object-cover" />
                  </a>
                )}
                {m.attachment_signed && m.attachment_type === "audio" && (
                  <audio controls src={m.attachment_signed} className="mb-2 max-w-full" />
                )}
                {m.attachment_signed && (m.attachment_type === "pdf" || m.attachment_type === "file") && (
                  <a
                    href={m.attachment_signed}
                    target="_blank"
                    rel="noreferrer"
                    className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${mine ? "bg-primary-foreground/15" : "bg-muted"}`}
                  >
                    <FileText className="h-4 w-4" /> {m.attachment_name}
                  </a>
                )}
                {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {mine && (m.read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                </div>
              </div>
            </div>
          );
        })}
        {(messages ?? []).length === 0 && (
          <p className="pt-16 text-center text-sm text-muted-foreground">No messages yet. Start the conversation below.</p>
        )}
      </div>

      <div className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-border hover:bg-muted">
            <Paperclip className="h-4 w-4" />
            <input
              type="file"
              accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={file ? `📎 ${file.name} — add a note…` : "Write a message…"}
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring focus:ring-2"
          />
          <button
            onClick={send}
            disabled={sending || (!text.trim() && !file)}
            className="flex h-10 w-10 items-center justify-center rounded-xl gradient-gold text-gold-foreground disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
