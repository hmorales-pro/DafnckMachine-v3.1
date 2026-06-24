"use client";

import { useRef, useState } from "react";
import type { Agent } from "@/lib/agents";

type Message = { role: "user" | "assistant"; content: string };

// Rendu Markdown minimal (gras, code, retours à la ligne) sans dépendance externe.
function renderMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/```([\s\S]*?)```/g, "<pre class='my-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-sm'>$1</pre>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>")
    .replace(/^> (.+)$/gm, "<blockquote class='border-l-2 border-white/20 pl-3 text-white/60'>$1</blockquote>")
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export default function ChatClient({ agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: agent.slug, messages: newMessages }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur serveur");
      }
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      );
    }
  }

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.length === 0 && (
          <div className="mt-8 text-center">
            <p className="text-white/50">
              Démarrez la conversation avec {agent.name}, ou choisissez un exemple :
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {agent.suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="mx-auto w-full max-w-xl rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/70 transition hover:border-white/25 hover:bg-white/[0.07]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-violet-600 text-white"
                  : "prose-chat border border-white/10 bg-white/[0.04] text-white/90"
              }`}
              dangerouslySetInnerHTML={
                m.role === "assistant"
                  ? { __html: renderMarkdown(m.content) }
                  : undefined
              }
            >
              {m.role === "user" ? m.content : undefined}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/50">
              {agent.name} rédige…
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-white/10 py-4"
      >
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={`Écrivez à ${agent.name}…`}
            className="max-h-40 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-40"
          >
            Envoyer
          </button>
        </div>
      </form>
    </>
  );
}
